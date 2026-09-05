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

  await inspect('H01 only authenticated upload entrypoints remain public',()=>{
    const source=fs.readFileSync(path.join(root,'gas/Code.gs'),'utf8');
    const names=[...source.matchAll(/^function (\w+)\(/gm)].map(m=>m[1]);
    assert.equal(new Set(names).size,names.length,'No duplicate declarations');
    assert.deepEqual(names.filter(n=>!n.endsWith('_')).sort(),['doGet','doPost','processLargeUploadForm','startResumableLargeUpload','uploadResumableLargeUploadChunk'].sort());
    return {status:'pass'};
  });
  await inspect('H02 filename or forged file ID cannot establish submission',()=>{
    const c=context();c.db.Assignments[0].Submission_Mode='file';
    for(const extra of [{},{Drive_File_ID:'UNRELATED_FAKE_FILE'}]) {
      assert.throws(()=>c.handleSubmitAssignment_({requestId:'REQ_health_nofile_001',submission:submission({File_Name:'not-uploaded.pdf',Text_Content:'',...extra})}),/ASSET_INVALID/);
    }
    assert.equal(c.db.Assignment_Submissions.length,0);return {status:'pass'};
  });
  await inspect('H03 unverified legacy submission file is kept out of cleanup',()=>{
    const c=context();let queued=[];
    c.db.Assignment_Submissions=[submission({File_Name:'legacy.pdf',Drive_File_ID:'UNRELATED_FAKE_FILE'})];
    c.enqueueDeferredDriveTrash_=ids=>{queued=clone(ids);return {};};
    c.handleDeleteAssignment_({assignmentId:'A01',auditUser:'U01',stateRevision:1});
    assert.ok(!queued.includes('UNRELATED_FAKE_FILE'));return {status:'pass'};
  });
  await inspect('H04 failed atomic batch preserves old data and commits changed tables together',()=>{
    const c=context(), storage={};let fail=true,calls=[];
    Object.keys(c.TABLE_SCHEMAS).forEach((name,i)=>{storage[name]={id:i+1,rows:[clone(c.TABLE_SCHEMAS[name].headers)]};});
    storage.Assignments.rows.push(['A_OLD','S01','Old title']);
    const sheet=name=>({getSheetId:()=>storage[name].id,getLastRow:()=>storage[name].rows.length,getMaxRows:()=>1000,getMaxColumns:()=>100,
      getRange:(r,col,n,w)=>({getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>storage[name].rows[r-1+i]?.[col-1+j]??''))})});
    const spreadsheet={getSheetByName:sheet,getId:()=> 'ISOLATED_TEST'};
    c.SpreadsheetApp={flush(){}};c.CacheService={getScriptCache:()=>({remove(){}})};c.ScriptApp={getOAuthToken:()=> 'FAKE'};
    c.UrlFetchApp={fetch:(url,options)=>{
      const requests=JSON.parse(options.payload).requests;calls.push(requests);
      if(!fail) {
        const next=clone(storage);
        requests.filter(r=>r.updateCells).forEach(({updateCells:u})=>{
          const table=Object.values(next).find(t=>t.id===u.range.sheetId);
          table.rows=u.rows.map(r=>r.values.map(cell=>Object.values(cell.userEnteredValue||{})[0]??''));
        });
        Object.assign(storage,next);
      }
      return {getResponseCode:()=>fail?400:200};
    }};
    const before=clone(storage);
    assert.throws(()=>c.commitTablesAtomically_(spreadsheet,{Assignments:c.db.Assignments,Meta:[{Key:'revision',Value:2}]}),/SAVE_NOT_CONFIRMED/);
    assert.deepEqual(storage,before);assert.equal(calls.length,1);assert.equal(calls[0].length,2);
    fail=false;c.commitTablesAtomically_(spreadsheet,{Assignments:c.db.Assignments,Meta:[{Key:'revision',Value:2}]});
    assert.equal(storage.Assignments.rows[1][0],'A01');assert.equal(storage.Meta.rows[1][0],'revision');
    const count=calls.length;c.commitTablesAtomically_(spreadsheet,{Assignments:c.db.Assignments,Meta:[{Key:'revision',Value:2}]});
    assert.equal(calls.length,count);return {status:'pass'};
  });
  await inspect('H05 partial restore stays retryable without restoring rows twice',()=>{
    const c=context();c.db.Recycle_Bin=[{Recycle_ID:'RB_health',Entity_Type:'assignment',Entity_ID:'A_old',Title:'Old assignment',Status:'deleted',Expires_At:'2099-01-01 00:00',Drive_File_IDs:['F1','F2'],Snapshot_JSON:{collections:{Assignments:[{...c.db.Assignments[0],Assignment_ID:'A_old'}]}}}];
    c.removeDeferredDriveTrashItems_=()=>({removed:1});let calls=[];
    c.restoreDriveFiles_=ids=>{calls.push(clone(ids));return calls.length===1?{restored:1,failed:1,failedIds:['F2']}:{restored:1,failed:0,failedIds:[]};};
    const first=c.handleRestoreRecycleBinItem_({recycleId:'RB_health',auditUser:'U01',stateRevision:1});
    assert.equal(first.restoredRecycleBinItem.Status,'restore_pending');
    const second=c.handleRestoreRecycleBinItem_({recycleId:'RB_health',auditUser:'U01',stateRevision:1});
    assert.equal(second.restoredRecycleBinItem.Status,'restored');assert.deepEqual(calls,[['F1','F2'],['F2']]);
    assert.equal(c.db.Assignments.filter(a=>a.Assignment_ID==='A_old').length,1);return {status:'pass'};
  });
  await inspect('H06 orphan restore refuses before any row changes',()=>{
    const c=context(),before=clone(c.db);
    assert.throws(()=>c.restoreRecycleBinSnapshot_(c.db,{Snapshot_JSON:{collections:{Assignment_Resources:[{Resource_ID:'AR_orphan',Assignment_ID:'A_missing',File_Name:'template.pdf'}]}}}),/RESTORE_PARENT_MISSING/);
    assert.deepEqual(clone(c.db),before);return {status:'pass'};
  });
  await inspect('H07 only latest non-rejected submission suppresses reminders',()=>{
    const c=context();c.db.Assignment_Submissions=[submission({Status:'退回修正'})];
    assert.equal(c.hasAssignmentSubmissionForTeam_(c.db,'A01','T02'),false);
    c.db.Assignment_Submissions.push(submission({Submission_ID:'SUB_latest',Submission_No:2}));
    assert.equal(c.hasAssignmentSubmissionForTeam_(c.db,'A01','T02'),true);return {status:'pass'};
  });
  await inspect('H08 dual role recipients receive team notices and leader escalation',()=>{
    const c=context();assert.ok(c.getActiveStudentRecipientsForTeam_(c.db,'T02').some(u=>u.User_ID==='U04'));
    assert.ok(c.getAssignmentAnnouncementRecipients_(c.db,c.db.Assignments[0]).some(u=>u.User_ID==='U04'));
    c.db.Users[3].Student_Role='Leader';assert.ok(c.getActiveLeaderRecipientsForTeam_(c.db,'T02').some(u=>u.User_ID==='U04'));
    return {status:'pass'};
  });
  await inspect('H09 retries failed recipients only with bounded attempts and no duplicate site notice',()=>{
    const c=context(),attempts={};
    c.db.Assignments[0].Due_At=new Date(Date.now()+9*3600000).toISOString().slice(0,16).replace('T',' ');c.db.Assignments[0].Notify_By_Email=true;
    c.getAssignmentReminderSettings_=()=>({enabled:true,offsetsHours:[24],sendEmail:true,sendSiteNotifications:true});
    c.getAssignmentReminderBucket_=()=>({code:'before_24h',priority:'normal'});c.getAssignmentEscalationBucket_=()=>null;
    c.sendSystemEmail_=email=>{attempts[email]=(attempts[email]||0)+1;if(email==='b@example.invalid')throw new Error('Mail outage');};
    for(let i=0;i<5;i++)c.runScheduledAssignmentRemindersInternal_(c.db);
    assert.equal(attempts['b@example.invalid'],3);assert.equal(attempts['dual@example.invalid'],1);
    const notifications=c.db.Notifications.length;c.runScheduledAssignmentRemindersInternal_(c.db);assert.equal(c.db.Notifications.length,notifications);
    c.db.Assignment_Submissions=[submission({Status:'退回修正'})];c.runScheduledAssignmentRemindersInternal_(c.db);
    assert.equal(attempts['dual@example.invalid'],2,'Rejection starts a new reminder cycle');return {status:'pass'};
  });
  await inspect('H10 completed upload authenticates before disclosing result',()=>{
    const c=context();let verified=false;
    c.loadResumableUploadSession_=()=>({status:'completed',completedResult:{fileUrl:'https://example.invalid/private-file'}});
    c.verifyResumableUploadSession_=()=>{verified=true;throw new Error('AUTH_REQUIRED');};
    assert.throws(()=>c.uploadResumableLargeUploadChunk({sessionKey:'FAKE_KNOWN_UPLOAD_KEY'}),/AUTH_REQUIRED/);
    assert.equal(verified,true);return {status:'pass'};
  });
  await receiptTests();
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
      window.__seed=seed;window.__toasts=[];window.__realRequestGas=requestGas;
      window.__reset=(id='U01')=>{
        authEpoch++;state=JSON.parse(JSON.stringify(window.__seed));normalizeStateSchema();
        currentUser=state.Users.find(u=>u.User_ID===id);authSessionToken='HEALTH_FAKE';
        cancelQueuedRemoteStateSync();remoteSaveInFlight=false;remoteSavePromise=null;pendingRemoteSave=false;remoteMutationInFlight=false;
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
    await inspect('R07 actual request transport preserves concurrent edits for any response',async()=>{
      await page.evaluate(async()=>{
        window.__reset();requestGas=window.__realRequestGas;
        const originalFetch=window.fetch,cloud=cloneStateSnapshot(state);let finish;
        window.fetch=()=>new Promise(resolve=>finish=()=>resolve({ok:true,text:async()=>JSON.stringify({ok:true,data:{state:cloud,currentUser:cloud.Users[0],stateRevision:2}})}));
        try {
          const pending=requestGas('updateCalendarEvent',{});
          state.Assignments[0].Title='CONCURRENT_CHANGE';
          finish();const response=await pending;
          applyBackendStateResponse(response);
          if(state.Assignments[0].Title!=='CONCURRENT_CHANGE')throw new Error('Lost edits');
          cancelQueuedRemoteStateSync();
        }finally{window.fetch=originalFetch;}
      });return {status:'pass'};
    });
    await inspect('R08 dirty state blocks background refresh before network access',async()=>{
      await page.evaluate(async()=>{
        window.__reset();requestGas=window.__realRequestGas;setSaveFeedback('error','Fixture unsaved');
        let fetched=false;const originalFetch=window.fetch;window.fetch=()=>{fetched=true;throw new Error('Must not fetch');};
        try {
          for(const action of ['bootstrap','claimWorkItem']) {
            let rejected=false;try{await requestGas(action,{});}catch(e){rejected=/UNSAVED_CHANGES/.test(e.message);}
            if(!rejected)throw new Error('Did not protect dirty state');
          }
          if(fetched)throw new Error('Fetched despite unsaved changes');
        }finally{window.fetch=originalFetch;}
      });return {status:'pass'};
    });
    await inspect('R09 older response cannot roll back newer cloud revision',async()=>{
      await page.evaluate(()=>{
        window.__reset();remoteStateRevision=10;
        const cloud=cloneStateSnapshot(state);cloud.Assignments[0].Title='OLD_RESPONSE';
        if(applyBackendStateResponse({data:{state:cloud,stateRevision:9}})!==false)throw new Error('Stale response applied');
        if(state.Assignments[0].Title==='OLD_RESPONSE')throw new Error('Rolled back');
      });return {status:'pass'};
    });
    await inspect('R10 pending restore exposes an explicit retry action',async()=>{
      await page.evaluate(()=>{
        window.__reset();state.Recycle_Bin=[{Recycle_ID:'RB_pending',Status:'restore_pending',Title:'Attachment retry',Drive_File_IDs:['F1']}];
        activeTab='recycle';renderAll();
      });
      await page.getByRole('button',{name:'重試附件復原',exact:true}).waitFor({state:'visible'});
      if(process.env.HEALTH_SCREENSHOT_PATH)await page.screenshot({path:process.env.HEALTH_SCREENSHOT_PATH,fullPage:true});
      return {status:'pass'};
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


function cryptoContext() {
  const c=context(),props={ASSET_RECEIPT_SECRET:'FIXTURE_ONLY_SECRET'};
  c.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v;}})};
  Object.assign(c.Utilities,{
    base64EncodeWebSafe:value=>Buffer.from(value).toString('base64url'),
    base64DecodeWebSafe:value=>Array.from(Buffer.from(value,'base64url')),
    computeHmacSha256Signature:(value,key)=>Array.from(crypto.createHmac('sha256',key).update(value).digest()),
    newBlob:value=>({getDataAsString:()=>Buffer.from(value).toString('utf8')})
  });
  return c;
}
function assetSubmission(c) {
  const file={fileId:'TEST_DRIVE_FILE',folderId:'TEST_FOLDER',fileName:'test.pdf'};
  return submission({Text_Content:'',File_Name:file.fileName,Drive_File_ID:file.fileId,Drive_Folder_ID:file.folderId,
    Asset_Receipt:c.issueAssignmentAssetReceipt_(c.db.Users[2],c.db.Assignments[0],file)});
}
async function receiptTests() {
  await inspect('R01 signed upload is accepted once and its result is idempotent',()=>{
    const c=cryptoContext();c.db.Assignments[0].Submission_Mode='file';
    const candidate=assetSubmission(c),payload={requestId:'REQ_verified_asset_001',submission:candidate};
    const first=c.handleSubmitAssignment_(payload),second=c.handleSubmitAssignment_(payload);
    assert.equal(first.submission.Submission_ID,second.submission.Submission_ID);
    assert.equal(c.db.Assignment_Submissions.length,1);
    assert.match(first.submission.Google_Drive_URL,/TEST_DRIVE_FILE/);
    c.db.Assignment_Submissions[0].Status='退回修正';
    assert.throws(()=>c.handleSubmitAssignment_({...payload,requestId:'REQ_verified_asset_002'}),/ASSET_ALREADY_USED/);
    return {status:'pass'};
  });
  await inspect('R02 receipt rejects altered ownership, IDs, filename and signature',()=>{
    const c=cryptoContext(),candidate=assetSubmission(c),actor=c.db.Users[2],assignment=c.db.Assignments[0];
    for(const extra of [{Drive_File_ID:'VICTIM'},{Drive_Folder_ID:'OTHER'},{File_Name:'other.pdf'},{Asset_Receipt:candidate.Asset_Receipt+'x'}])
      assert.throws(()=>c.validateAssignmentAssetReceipt_({...candidate,...extra},actor,assignment,false),/ASSET_INVALID/);
    assert.throws(()=>c.validateAssignmentAssetReceipt_(candidate,c.db.Users[1],assignment,false),/ASSET_INVALID/);
    assert.throws(()=>c.validateAssignmentAssetReceipt_(candidate,actor,{Assignment_ID:'OTHER'},false),/ASSET_INVALID/);
    return {status:'pass'};
  });
  await inspect('R03 expired receipt cannot submit but still verifies historical ownership',()=>{
    const c=cryptoContext(),candidate=assetSubmission(c);
    const payload=JSON.parse(Buffer.from(candidate.Asset_Receipt.split('.')[0],'base64url'));
    payload.expires=1;
    const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');
    candidate.Asset_Receipt=encoded+'.'+crypto.createHmac('sha256','FIXTURE_ONLY_SECRET').update(encoded).digest('base64url');
    assert.throws(()=>c.validateAssignmentAssetReceipt_(candidate,c.db.Users[2],c.db.Assignments[0],false),/ASSET_INVALID/);
    assert.equal(c.isVerifiedSubmissionAsset_(candidate),true);return {status:'pass'};
  });
  await inspect('R04 cleanup validates receipt and root and rejects restored entries',()=>{
    const c=cryptoContext(),candidate=assetSubmission(c);let trashed=0;
    c.getConfig_=()=>({driveRootFolderId:'ROOT'});
    const parents=()=>{let yielded=false;return {hasNext:()=>!yielded,next:()=>{yielded=true;return {getId:()=> 'ROOT'};}};};
    c.DriveApp={getFileById:()=>({getParents:parents,setTrashed:()=>{trashed++;}})};
    c.db.Recycle_Bin=[{Status:'deleted',Snapshot_JSON:{collections:{Assignment_Submissions:[candidate]}}}];
    c.trashDriveFiles_(['VICTIM']);assert.equal(trashed,0);
    c.trashDriveFiles_(['TEST_DRIVE_FILE']);assert.equal(trashed,1);
    c.db.Recycle_Bin[0].Status='restore_pending';c.trashDriveFiles_(['TEST_DRIVE_FILE']);assert.equal(trashed,1);
    c.restoreDriveFiles_(['TEST_DRIVE_FILE']);assert.equal(trashed,2);
    c.DriveApp.getFileById=()=>({getParents:()=>({hasNext:()=>false}),setTrashed:()=>{trashed++;}});
    c.restoreDriveFiles_(['TEST_DRIVE_FILE']);assert.equal(trashed,2);
    c.trashNewUploadAfterFailure_({fileId:'NEW_UPLOAD'});assert.equal(trashed,2);
    c.db.Recycle_Bin=[];
    c.DriveApp.getFileById=()=>({getParents:parents,setTrashed:()=>{trashed++;}});
    c.trashNewUploadAfterFailure_({fileId:'NEW_UPLOAD'});assert.equal(trashed,3);
    return {status:'pass'};
  });
  await inspect('R05 completed upload also rejects revoked account session',()=>{
    const c=context();c.loadResumableUploadSession_=()=>({status:'completed',completedResult:{fileUrl:'PRIVATE'}});
    c.verifyResumableUploadSession_=()=>{};c.requireSessionUser_=()=>{throw new Error('AUTH_EXPIRED');};
    assert.throws(()=>c.uploadResumableLargeUploadChunk({sessionKey:'FAKE'}),/AUTH_EXPIRED/);return {status:'pass'};
  });
  await inspect('R06 persistence confirms data before any announcement email',()=>{
    const c=context(),source=fs.readFileSync(path.join(root,'gas/Code.gs'),'utf8');
    const start=source.indexOf('function persistState_('),end=source.indexOf('\nfunction ',start+1);
    const persist=vm.runInContext('('+source.slice(start,end)+')',c),events=[];
    c.setupSheets_=()=>{};c.SpreadsheetApp={openById:()=>({})};
    c.writeStateTables_=()=>{events.push('write');throw new Error('write failure');};
    c.sendPendingAssignmentAnnouncementEmails_=()=>{events.push('mail');return [];};
    assert.throws(()=>persist(c.db),/write failure/);assert.deepEqual(events,['write']);
    events.length=0;c.writeStateTables_=()=>events.push('write');persist(c.db);
    assert.deepEqual(events,['write','mail']);return {status:'pass'};
  });
}

async function additionalTests() {
  await inspect('R11 announcement and escalation retain per-recipient delivery results',()=>{
    const c=context(),calls={};c.db.Assignments[0].Notify_By_Email=true;
    c.sendSystemEmail_=email=>{calls[email]=(calls[email]||0)+1;if(email==='b@example.invalid')throw new Error('Mail fixture');};
    for(let i=0;i<5;i++)c.sendAssignmentAnnouncementEmail_(c.db,c.db.Assignments[0]);
    assert.equal(calls['b@example.invalid'],3);assert.equal(calls['dual@example.invalid'],1);
    const delivery={},before=clone(calls);
    for(let i=0;i<5;i++)c.sendAssignmentEscalationEmails_(c.db,c.getActiveStudentRecipientsForTeam_(c.db,'T02'),c.db.Assignments[0],c.db.Teams[2],{code:'late',audience:'leader'},delivery);
    assert.equal(calls['b@example.invalid']-before['b@example.invalid'],3);
    assert.equal(calls['dual@example.invalid']-before['dual@example.invalid'],1);return {status:'pass'};
  });
  await inspect('R12 legacy reminder history does not blindly resend already-sent mail',()=>{
    const c=context(),recipients=c.getActiveStudentRecipientsForTeam_(c.db,'T02');
    const entry=c.getReminderDeliveryEntry_({old:{emailCount:recipients.length,notificationCount:2,dueAt:'D'}},'new','old',recipients,'D',true);
    assert.equal(entry.siteDone,true);
    recipients.forEach(u=>assert.equal(c.shouldAttemptReminderEmail_(entry.delivery,u.Email),false));
    const partial=c.getReminderDeliveryEntry_({old:{emailCount:1,dueAt:'D'}},'new','old',recipients,'D',true);
    assert.equal(partial.needsReview,true);
    const failed=c.getReminderDeliveryEntry_({old:{emailCount:0,dueAt:'D'}},'new','old',recipients,'D',true);
    recipients.forEach(u=>assert.equal(c.shouldAttemptReminderEmail_(failed.delivery,u.Email),true));
    return {status:'pass'};
  });
  await inspect('R13 migration checks API first and preserves existing reminder scheduling intent',()=>{
    const c=context(),events=[];let apiOk=false;
    c.UrlFetchApp={fetch:()=>({getResponseCode:()=>apiOk?200:403})};
    c.ScriptApp={getOAuthToken:()=> 'FAKE',getProjectTriggers:()=>[{getHandlerFunction:()=> 'runScheduledAssignmentReminders'}]};
    c.setupSheets_=()=>events.push('schema');c.getAssetReceiptSecret_=()=>events.push('secret');
    c.CacheService={getScriptCache:()=>({remove(){}})};
    c.installAssignmentReminderTrigger_=()=>events.push('reminder');
    c.removeDeferredDriveTrashTriggers_=()=>events.push('removeCleanup');
    c.loadDeferredDriveTrashQueue_=()=>[{fileId:'FAKE'}];c.scheduleDeferredDriveTrashRetry_=()=>events.push('cleanup');
    assert.throws(()=>c.migrateHealthRelease_(),/Google Sheets API/);assert.equal(events.length,0);
    apiOk=true;c.migrateHealthRelease_();assert.deepEqual(events,['schema','secret','reminder','removeCleanup','cleanup']);
    events.length=0;c.ScriptApp.getProjectTriggers=()=>[];c.loadDeferredDriveTrashQueue_=()=>[];
    c.migrateHealthRelease_();assert.ok(!events.includes('reminder'));assert.ok(!events.includes('cleanup'));return {status:'pass'};
  });
}

async function main() {
  await logicAudit();await additionalTests();await browserAudit();
  const sources=Object.fromEntries(['index.html','large-upload.html','gas/Code.gs','gas/LargeUpload.html','gas/appsscript.json'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
  const publicPath='/tmp/shapeprint-health-published-20260905.html';
  const published=fs.existsSync(publicPath)?{sha256:crypto.createHash('sha256').update(fs.readFileSync(publicPath)).digest('hex'),includesLocalRelease:fs.readFileSync(publicPath,'utf8').includes('2026.09.05-stability.1')}:null;
  const summary=Object.fromEntries(['issue','pass','unverified','harness-error'].map(status=>[status,results.filter(r=>r.status===status).length]));
  const report={generatedAt:new Date().toISOString(),scope:'Isolated local fake-data audit; no production GAS calls or real file/email operations',summary,sources,published,results};
  fs.writeFileSync(path.join(root,'audit/full-health-fixes-results-2026-09-05.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(summary));if(summary['harness-error'] || summary.issue)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
