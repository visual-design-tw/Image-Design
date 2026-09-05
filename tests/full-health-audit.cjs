const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const http=require('node:http');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {fixture,backend}=require('./stability.test.cjs');
const root=path.resolve(__dirname,'..');
const clone=x=>JSON.parse(JSON.stringify(x));
const results=[];
async function inspect(name,fn) {
  try {
    const result=await fn();results.push({name,...result});
    console.log(result.status.toUpperCase()+' '+name+' '+JSON.stringify(result.evidence||{}));
  }catch(error){results.push({name,status:'harness-error',error:error.stack});console.error(name+' '+error.stack);}
}
function context() {
  const c=backend();
  c.Logger={log(){}};c.withLock_=fn=>fn();c.appendActivityLogEntries_=()=>{};
  c.getConfig_=()=>({timeZone:'Asia/Taipei',frontendBaseUrl:'https://example.invalid',passwordResetExpiryMinutes:30});
  c.formatDateTime_=d=>new Date(d).toISOString().slice(0,19).replace('T',' ');
  c.getTimeZoneOffsetString_=()=>'+08:00';
  c.requireSessionUser_=(state,p,roles)=>{
    const user=state.Users.find(x=>x.User_ID===(p.auditUser||'U03'));
    if(!user||user.Status!=='Active')throw new Error('AUTH_EXPIRED');
    if(roles&&roles.length&&!roles.includes(user.Role))throw new Error('FORBIDDEN');
    return user;
  };
  return c;
}
function submission(extra={}) {
  return {Submission_ID:'SUB_health',Assignment_ID:'A01',Team_ID:'T02',User_ID:'U03',Text_Content:'Health fixture',Status:'已繳交',Submission_No:1,...extra};
}
async function logicAudit() {
  await inspect('H01 public maintenance helper has no application authorization',()=>{
    const c=context();let writes=0;
    c.requireSessionUser_=()=>{throw new Error('Authorization must be required');};
    c.buildDemoState_=()=>({fixtureOnly:true});c.persistState_=()=>writes++;
    c.seedDemoData();
    return {status:writes?'issue':'pass',evidence:{writesWithoutSession:writes,boundary:'Local function only. HTML-service callability checked against official docs, not production.'}};
  });
  await inspect('H02 submission accepts filename without uploaded bytes or Drive receipt',()=>{
    const c=context();c.db.Assignments[0].Submission_Mode='file';
    const result=c.handleSubmitAssignment_({requestId:'REQ_health_nofile_001',submission:submission({File_Name:'not-uploaded.pdf',Text_Content:''})});
    return {status:result.submission&&!result.submission.Drive_File_ID?'issue':'pass',evidence:{accepted:!!result.submission,driveId:result.submission.Drive_File_ID}};
  });
  await inspect('H03 client-supplied unrelated Drive ID enters the deletion queue',()=>{
    const c=context();c.db.Assignments[0].Submission_Mode='file';let queued=[];
    c.handleSubmitAssignment_({requestId:'REQ_health_forged_001',submission:submission({File_Name:'reference.pdf',Drive_File_ID:'UNRELATED_FAKE_FILE',Google_Drive_URL:'https://drive.google.com/file/d/UNRELATED_FAKE_FILE/view'})});
    c.enqueueDeferredDriveTrash_=ids=>{queued=clone(ids);return {};};
    c.handleDeleteAssignment_({assignmentId:'A01',auditUser:'U01',stateRevision:1});
    return {status:queued.includes('UNRELATED_FAKE_FILE')?'issue':'pass',evidence:{queued,realDriveCalls:0}};
  });
  await inspect('H04 interrupted table write loses previous rows',()=>{
    const c=context();const schema=c.TABLE_SCHEMAS.Assignments;let rows=[clone(schema.headers),['A_OLD','S01','Existing title']];
    const sheet={getLastColumn:()=>schema.headers.length,clearContents:()=>{rows=[];},getRange:(r,col,n,w)=>({
      getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>rows[r-1+i]?.[col-1+j]||'')),
      setValues:values=>{if(r>1)throw new Error('Simulated Sheets write error');rows[0]=clone(values[0]);}
    })};
    let error='';try{c.writeTable_({getSheetByName:()=>sheet},'Assignments',c.db.Assignments);}catch(e){error=e.message;}
    return {status:error&&rows.length===1?'issue':'pass',evidence:{error,remainingDataRows:rows.length-1}};
  });
  await inspect('H05 failed Drive restore is marked restored and cannot be retried',()=>{
    const c=context();c.db.Recycle_Bin=[{Recycle_ID:'RB_health',Entity_Type:'assignment',Entity_ID:'A_old',Title:'Old assignment',Status:'deleted',Expires_At:'2099-01-01 00:00',Drive_File_IDs:['FAKE_FILE'],Snapshot_JSON:{collections:{Assignments:[{...c.db.Assignments[0],Assignment_ID:'A_old'}]}}}];
    c.removeDeferredDriveTrashItems_=()=>({removed:1});c.restoreDriveFiles_=()=>({restored:0,failed:1});
    const result=c.handleRestoreRecycleBinItem_({recycleId:'RB_health',auditUser:'U01',stateRevision:1});let retry='';
    try{c.handleRestoreRecycleBinItem_({recycleId:'RB_health',auditUser:'U01',stateRevision:1});}catch(e){retry=e.message;}
    return {status:result.restoredRecycleBinItem.Status==='restored'&&retry?'issue':'pass',evidence:{status:result.restoredRecycleBinItem.Status,failedFiles:result.driveRestoreSummary.failed,retry}};
  });
  await inspect('H06 orphaned resource can be restored before its deleted assignment',()=>{
    const c=context();c.restoreRecycleBinSnapshot_(c.db,{Snapshot_JSON:{collections:{Assignment_Resources:[{Resource_ID:'AR_orphan',Assignment_ID:'A_missing',File_Name:'template.pdf'}]}}});
    const orphan=c.db.Assignment_Resources.find(x=>!c.db.Assignments.some(a=>a.Assignment_ID===x.Assignment_ID));
    return {status:orphan?'issue':'pass',evidence:{orphanResource:orphan?.Resource_ID}};
  });
  await inspect('H07 rejected submission suppresses deadline and escalation reminders',()=>{
    const c=context();c.db.Assignment_Submissions=[submission({Status:'退回修正'})];
    const skipped=c.hasAssignmentSubmissionForTeam_(c.db,'A01','T02');
    return {status:skipped?'issue':'pass',evidence:{rejectedButConsideredSubmitted:skipped}};
  });
  await inspect('H08 dual-role team member is omitted from reminder recipients',()=>{
    const c=context();const ids=c.getActiveStudentRecipientsForTeam_(c.db,'T02').map(x=>x.User_ID);
    return {status:!ids.includes('U04')?'issue':'pass',evidence:{recipients:clone(ids),missingDualRole:'U04'}};
  });
  await inspect('H09 failed reminder emails receive no retry within same reminder bucket',()=>{
    const c=context();let attempts=0;
    c.db.Assignments[0].Due_At=new Date(Date.now()+9*3600000).toISOString().slice(0,16).replace('T',' ');c.db.Assignments[0].Notify_By_Email=true;
    c.getAssignmentReminderSettings_=()=>({enabled:true,offsetsHours:[24],sendEmail:true,sendSiteNotifications:false});
    c.getAssignmentReminderBucket_=()=>({code:'before_24h',priority:'normal'});c.getAssignmentEscalationBucket_=()=>null;
    c.sendSystemEmail_=()=>{attempts++;throw new Error('Simulated mail outage');};
    const first=c.runScheduledAssignmentRemindersInternal_(c.db);const afterFirst=attempts;
    assert.ok(afterFirst>0,'Fixture must exercise actual email attempts');
    const second=c.runScheduledAssignmentRemindersInternal_(c.db);
    return {status:afterFirst>0&&attempts===afterFirst?'issue':'pass',evidence:{firstAttempts:afterFirst,secondAttempts:attempts-afterFirst,emailsSent:first.emailsSent+second.emailsSent}};
  });
  await inspect('H10 completed upload result is returned before session verification',()=>{
    const c=context();let verified=false;
    c.loadResumableUploadSession_=()=>({status:'completed',completedResult:{fileUrl:'https://example.invalid/private-file'}});
    c.verifyResumableUploadSession_=()=>{verified=true;throw new Error('AUTH_REQUIRED');};
    const result=c.uploadResumableLargeUploadChunk({sessionKey:'FAKE_KNOWN_UPLOAD_KEY'});
    return {status:result.fileUrl&&!verified?'issue':'pass',evidence:{sessionVerified:verified,resultReturned:!!result.fileUrl,requiresKnownSessionKey:true}};
  });
  await inspect('C01 session expiry, disabled account and roles are rejected',()=>{
    const c=context();c.hashSessionToken_=x=>x;c.loadAuthSessions_=()=>[{Session_ID:'FAKE',Token_Hash:'FAKE',User_ID:'U03',Expires_At_Millis:Date.now()+60000,Revoked_At:''}];
    assert.throws(()=>c.requireSessionContext_(c.db,{}),/AUTH_REQUIRED/);
    assert.throws(()=>c.requireSessionContext_(c.db,{sessionToken:'FAKE'},['SuperAdmin']),/FORBIDDEN/);
    c.db.Users[2].Status='Pending';assert.throws(()=>c.requireSessionContext_(c.db,{sessionToken:'FAKE'}),/AUTH_EXPIRED/);
    c.db.Users[2].Status='Active';c.loadAuthSessions_=()=>[];assert.throws(()=>c.requireSessionContext_(c.db,{sessionToken:'FAKE'}),/AUTH_EXPIRED/);
    return {status:'pass'};
  });
  await inspect('C02 private calendars and work actions reject ordinary students',()=>{
    const c=context();assert.throws(()=>c.handleCreateCalendarEvent_({auditUser:'U03'}),/FORBIDDEN/);
    assert.throws(()=>c.handleCreateWorkItem_({auditUser:'U03'}),/FORBIDDEN/);
    const s=c.filterStateForUser_(c.db,c.db.Users[2]);assert.equal(s.Calendar_Events.length+s.Work_Items.length+s.Recycle_Bin.length,0);
    return {status:'pass'};
  });
  await inspect('C03 work ownership and completed-work transitions are enforced',()=>{
    const c=context();c.db.Work_Items=[{Work_Item_ID:'W_health',Title:'Work',Status:'已完成',Assigned_To_User_ID:'U04'}];
    assert.throws(()=>c.handleUpdateWorkItemProgress_({auditUser:'U04',workItemId:'W_health',progressAction:'start',stateRevision:1}),/已完成/);
    assert.throws(()=>c.handleUpdateWorkItemProgress_({auditUser:'U04',workItemId:'W_health',progressAction:'reopen',stateRevision:1}),/FORBIDDEN/);
    c.db.Work_Items[0].Status='進行中';c.db.Work_Items[0].Assigned_To_User_ID='U01';
    assert.throws(()=>c.handleUpdateWorkItemProgress_({auditUser:'U04',workItemId:'W_health',progressAction:'complete',stateRevision:1}),/FORBIDDEN/);
    return {status:'pass'};
  });
  await inspect('C04 notification clear cannot remove another account notifications',()=>{
    const c=context();c.db.Notifications=[{Notification_ID:'N_own',User_ID:'U03'},{Notification_ID:'N_other',User_ID:'U02'}];
    c.handleClearNotifications_({scope:'selected',notificationIds:['N_own','N_other']});
    assert.deepEqual(clone(c.db.Notifications.map(n=>n.Notification_ID)),['N_other']);return {status:'pass'};
  });
  await inspect('C05 reviews reject own-team conflict and outdated versions',()=>{
    const c=context();c.db.Assignment_Submissions=[submission()];
    assert.throws(()=>c.handleReviewAssignmentSubmission_({auditUser:'U04',submissionId:'SUB_health',decision:'通過',stateRevision:1}),/Conflict of interest/);
    c.db.Assignment_Submissions.push(submission({Submission_ID:'SUB_new',Submission_No:2}));
    assert.throws(()=>c.handleReviewAssignmentSubmission_({auditUser:'U01',submissionId:'SUB_health',decision:'通過',stateRevision:1}),/STALE_SUBMISSION/);
    assert.throws(()=>c.handleReviewAssignmentSubmission_({auditUser:'U01',submissionId:'SUB_new',decision:'退回修正',stateRevision:1}),/審核意見/);return {status:'pass'};
  });
  await inspect('C06 invalid calendar range and missing work assignee are rejected',()=>{
    const c=context();assert.throws(()=>c.buildCalendarEventFromPayload_({title:'Bad range',startsAt:'2026-09-05 12:00',endsAt:'2026-09-04 12:00'},c.db.Users[0]),/結束/);
    assert.throws(()=>c.buildWorkItemFromPayload_(c.db,{title:'Bad assignee',assignedToUserId:'U03'},c.db.Users[0]),/形印/);return {status:'pass'};
  });
}

async function browserAudit() {
  const server=http.createServer((req,res)=>{const file=req.url.startsWith('/large-upload')?'large-upload.html':'index.html';res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync(path.join(root,file)));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const errors=[];
  try {
    const browserContext=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Taipei',reducedMotion:'reduce'});
    await browserContext.route(/https:\/\/script\.(google|googleusercontent)\.com\//,r=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{state:fixture(),currentUser:null}})}));
    const page=await browserContext.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
    await page.evaluate(seed=>{
      window.__seed=seed;window.__toasts=[];
      window.__reset=(id='U01')=>{
        authEpoch++;state=JSON.parse(JSON.stringify(window.__seed));normalizeStateSchema();
        currentUser=state.Users.find(u=>u.User_ID===id);authSessionToken='HEALTH_FAKE';
        remoteSaveInFlight=false;remoteSavePromise=null;pendingRemoteSave=false;remoteMutationInFlight=false;
        workItemSaveInFlight=false;workItemActionInFlight=false;topbarRefreshInFlight=false;recycleRestoreInFlight=false;
        workspaceHydrationInFlight=false;remoteStateRevision=1;gasConnectionStatus='remote';
        activeTab='overview';activeWorkspace=id==='U01'?'admin':'team';setSaveFeedback('idle','');
        showToast=(message,type)=>window.__toasts.push({message,type});window.__toasts=[];
        requestGas=async()=>({ok:true,data:{state:JSON.parse(JSON.stringify(state)),currentUser,stateRevision:2}});
        renderAll();
      };window.__reset();
    },fixture());
    await inspect('H11 work action response overwrites edits made while waiting',async()=>{
      const evidence=await page.evaluate(async()=>{
        window.__reset();let finish;
        requestGas=()=>{const snapshot=JSON.parse(JSON.stringify(state));return new Promise(resolve=>finish=()=>resolve({ok:true,data:{state:snapshot,currentUser:snapshot.Users[0],stateRevision:2}}));};
        const action=submitWorkItemAction('updateWorkItem',{},'');
        state.Assignments[0].Title='UNSAVED_NEW_TITLE';finish();await action;
        return {finalTitle:state.Assignments[0].Title,expected:'UNSAVED_NEW_TITLE'};
      });return {status:evidence.finalTitle!==evidence.expected?'issue':'pass',evidence};
    });
    await inspect('H12 manual refresh discards pending edits without confirmation',async()=>{
      const evidence=await page.evaluate(async()=>{
        window.__reset();const cloud=JSON.parse(JSON.stringify(state));state.Assignments[0].Title='UNSAVED_LOCAL';setSaveFeedback('error','Unsaved fixture');
        requestGas=async()=>({ok:true,data:{state:cloud,currentUser:cloud.Users[0],stateRevision:2}});
        await handleManualCloudRefresh();return {title:state.Assignments[0].Title,toasts:window.__toasts};
      });return {status:evidence.title!=='UNSAVED_LOCAL'?'issue':'pass',evidence};
    });
    await inspect('H13 restore UI claims files restored despite failed file restore result',async()=>{
      const evidence=await page.evaluate(async()=>{
        window.__reset();state.Recycle_Bin=[{Recycle_ID:'RB_health',Status:'deleted',Title:'Fixture'}];
        requestGas=async()=>({ok:true,data:{state:JSON.parse(JSON.stringify(state)),currentUser,driveRestoreSummary:{restored:0,failed:1}}});
        await restoreRecycleBinItem('RB_health');return {toasts:window.__toasts};
      });return {status:evidence.toasts.some(t=>t.type==='success'&&t.message.includes('檔案也會'))?'issue':'pass',evidence};
    });
    await inspect('H14 failed work claim leaves button saying claiming',async()=>{
      const evidence=await page.evaluate(async()=>{
        window.__reset('U04');activeWorkspace='admin';state.Work_Items=[{Work_Item_ID:'W_health',Title:'Fixture work',Status:'待認養',Assigned_To_User_ID:'',Priority:'一般'}];activeTab='work-items';renderAll();
        requestGas=async()=>{throw new Error('Simulated network failure');};
        await claimWorkItem('W_health');return {labels:getWorkItemActionButtons('W_health').map(x=>({text:x.textContent,disabled:x.disabled}))};
      });return {status:evidence.labels.some(x=>x.text==='認養中…'&&!x.disabled)?'issue':'pass',evidence};
    });
    await inspect('C07 desktop and mobile main tabs have no page-level horizontal overflow',async()=>{
      const overflows=[];let pages=0;
      for(const size of [{width:1440,height:1000},{width:390,height:844},{width:320,height:740}]) {
        await page.setViewportSize(size);
        for(const id of ['U01','U03','U04']) {
          await page.evaluate(id=>{window.__reset(id);if(id==='U04')activeWorkspace='admin';},id);
          for(const tab of (id==='U03'?['overview','notifications','files']:['overview','notifications','files','calendar','work-items','design-service','purchase','teams','stages','recycle'])) {
            await page.evaluate(tab=>{activeTab=tab;renderAll();},tab);pages++;
            const width=await page.evaluate(()=>document.documentElement.scrollWidth);
            if(width>size.width+1)overflows.push({width:size.width,id,tab,scrollWidth:width});
          }
        }
      }
      return {status:overflows.length?'issue':'pass',evidence:{viewsChecked:pages,overflows}};
    });
    await inspect('C08 custom menu opens and keyboard Escape closes it',async()=>{
      await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{window.__reset();openWorkItemModal('');});await page.waitForTimeout(400);
      const trigger=page.locator('[data-soft-select-native-for^="work-item-priority-"] button').first();
      await trigger.click();assert.equal(await trigger.getAttribute('aria-expanded'),'true');
      await page.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');return {status:'pass'};
    });
    await inspect('C10 resumable upload retries the same chunk and finishes with confirmation',async()=>{
      const upload=await browserContext.newPage();upload.on('pageerror',e=>errors.push(e.message));const chunks=[];
      const model={mode:'assignment-asset',sessionToken:'HEALTH_FAKE',sessionKey:'HEALTH_UPLOAD',assignmentId:'A01',title:'Health upload',sourceFileName:'health.pdf',maxDirectMb:1,maxResumableMb:8,resumableChunkMb:2};
      await upload.route(/https:\/\/script\.(google|googleusercontent)\.com\//,async r=>{
        const payload=r.request().method()==='GET'?{action:'largeUploadModel'}:r.request().postDataJSON();let data=model;
        if(payload.action==='startResumableLargeUpload')data={chunkSize:2*1024*1024};
        if(payload.action==='uploadResumableLargeUploadChunk') {
          chunks.push([payload.chunkStart,payload.chunkEnd]);
          if(chunks.length===1)return r.fulfill({contentType:'application/json',body:JSON.stringify({ok:false,error:{message:'Simulated transient connection failure'}})});
          data=payload.chunkEnd+1===payload.totalSize?{complete:true,driveFileId:'FAKE_UPLOADED',fileName:'health.pdf'}:{complete:false,nextByte:payload.chunkEnd+1};
        }
        await r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data})});
      });
      await upload.goto('http://127.0.0.1:'+server.address().port+'/large-upload.html?sessionToken=HEALTH_FAKE&sessionKey=HEALTH_UPLOAD',{waitUntil:'networkidle'});
      await upload.locator('#upload-file').setInputFiles({name:'health.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(5*1024*1024)});
      await upload.locator('#submit-button').click();
      await upload.waitForFunction(()=>document.getElementById('submit-label').textContent==='已完成');
      assert.deepEqual(chunks[0],chunks[1]);assert.equal(chunks.length,4);assert.equal(chunks.at(-1)[1],5*1024*1024-1);
      await upload.close();return {status:'pass',evidence:{syntheticBytes:5*1024*1024,chunkRequests:chunks.length,firstChunkRepeated:true,realDriveCalls:0}};
    });
    await inspect('C09 no uncaught browser errors across exercised pages',()=>({status:errors.length?'issue':'pass',evidence:{errors}}));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}

async function main() {
  await logicAudit();await browserAudit();
  const sources=Object.fromEntries(['index.html','large-upload.html','gas/Code.gs','gas/LargeUpload.html','gas/appsscript.json'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
  const publicPath='/tmp/shapeprint-health-published-20260905.html';
  const published=fs.existsSync(publicPath)?{sha256:crypto.createHash('sha256').update(fs.readFileSync(publicPath)).digest('hex'),includesLocalRelease:fs.readFileSync(publicPath,'utf8').includes('2026.09.05-stability.1')}:null;
  const summary=Object.fromEntries(['issue','pass','unverified','harness-error'].map(status=>[status,results.filter(r=>r.status===status).length]));
  const report={generatedAt:new Date().toISOString(),scope:'Isolated local fake-data audit; no production GAS calls or real file/email operations',summary,sources,published,results};
  fs.writeFileSync(path.join(root,'audit/full-health-results-2026-09-05.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(summary));if(summary['harness-error'])process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
