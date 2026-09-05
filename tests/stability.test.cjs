const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({name, passed:true}); console.log('PASS ' + name); }
  catch(error) { results.push({name, passed:false, error:error.stack}); console.error('FAIL ' + name + '\n' + error.stack); }
}
function fixture() {
  return {
    Config_Stages: [{ Stage_ID: 'S01', Stage_Name: 'Audit stage', Is_Active: true, Budget_Allocated: 1000 }],
    Teams: [
      { Team_ID: 'T00', Team_Name: 'Audit staff', Invite_Code: 'AUDIT-STAFF' },
      { Team_ID: 'T01', Team_Name: 'Audit team A', Invite_Code: 'AUDIT-A' },
      { Team_ID: 'T02', Team_Name: 'Audit team B', Invite_Code: 'AUDIT-B' }
    ],
    Users: [
      { User_ID: 'U01', Name: 'Audit manager', Email: 'manager@example.invalid', Team_ID: 'T00', Role: 'SuperAdmin', Status: 'Active', Password: '' },
      { User_ID: 'U02', Name: 'Audit member A', Email: 'a@example.invalid', Team_ID: 'T01', Role: 'Member', Status: 'Active', Password: '' },
      { User_ID: 'U03', Name: 'Audit member B', Email: 'b@example.invalid', Team_ID: 'T02', Role: 'Member', Status: 'Active', Password: '' },
      { User_ID: 'U04', Name: 'Audit dual role', Email: 'dual@example.invalid', Team_ID: 'T02', Role: 'Admin', Student_Role: 'Member', Status: 'Active', Password: '' }
    ],
    Assignments: [{ Assignment_ID: 'A01', Stage_ID: 'S01', Title: 'Audit assignment', Body: 'Audit body', Submission_Mode: 'text', Target_Mode: 'all', Due_At: '2028-09-11 18:00', Created_At: '2026-09-05 10:00', Created_By_User_ID: 'U01', Status: '進行中', Allow_ReSubmit: true }],
    Assignment_Submissions: [], Assignment_Resources: [], Purchase_Items: [], Files: [], Notifications: [],
    Discussion_Comments: [], Design_Service_Settings: [], Design_Service_Orders: [], Calendar_Events: [], Work_Items: [], Recycle_Bin: [],
    Meta: { State_Revision: 1, NotificationSeeded: true, DiscussionSeeded: true }
  };
}


function submission(team = 'T02', user = 'U03') {
  return { Submission_ID:'SUB01', Assignment_ID:'A01', Team_ID:team, User_ID:user, Submission_Mode:'text', Text_Content:'Audit text', Submission_No:1, Status:'已繳交' };
}
function backend() {
  const c = vm.createContext({console, Utilities:{getUuid:() => crypto.randomUUID()}});
  vm.runInContext(fs.readFileSync(path.join(root,'gas/Code.gs'),'utf8'),c);
  c.nowString_ = () => '2026-09-05 12:00';
  c.getConfig_ = () => ({timeZone:'Asia/Taipei'});
  c.db = c.normalizeState_(fixture());
  c.loadState_ = () => clone(c.db);
  c.persistState_ = state => { c.db = c.normalizeState_(clone(state)); };
  c.requireSessionUser_ = (state,payload) => state.Users.find(u => u.User_ID === (payload.auditUser || 'U03'));
  c.buildClientStateResultForUser_ = (state,actor,extra) => ({state:c.filterStateForUser_(state,actor),currentUser:actor,...extra});
  return c;
}
async function backendTests() {
  await test('all classic page scripts and Apps Script parse successfully', () => {
    new vm.Script(fs.readFileSync(path.join(root,'gas/Code.gs'),'utf8'));
    JSON.parse(fs.readFileSync(path.join(root,'gas/appsscript.json'),'utf8'));
    for (const file of ['index.html','large-upload.html','gas/LargeUpload.html']) {
      const html=fs.readFileSync(path.join(root,file),'utf8');
      for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (/\bsrc\s*=|type\s*=\s*["']module["']/i.test(match[1])) continue;
        new vm.Script(match[2].replace(/<\?[\s\S]*?\?>/g,'{}'),{filename:file});
      }
    }
  });
  await test('IDs stay unique after deletion and between clients', () => {
    const c=backend(), first=c.generateSequentialId_('A',[],'Assignment_ID');
    const second=c.generateSequentialId_('A',[],'Assignment_ID');
    assert.notEqual(first,second);
  });
  await test('legacy cross-team submission ID collision is not dropped', () => {
    const c=backend(), s=c.db;
    s.Assignment_Submissions.push(submission('T01','U02'));
    c.mergeStudentSubmissions_(s,{Assignment_Submissions:[submission()]},s.Users[2]);
    assert.equal(s.Assignment_Submissions.filter(x=>x.Team_ID==='T02').length,1);
    assert.equal(new Set(s.Assignment_Submissions.map(x=>x.Submission_ID)).size,2);
  });
  await test('same request retried creates one submission and one set of notifications', () => {
    const c=backend(), p={requestId:'REQ_audit_unique_00001',submission:submission()};
    const first=c.handleSubmitAssignment_(p), notifications=c.db.Notifications.length;
    const second=c.handleSubmitAssignment_(p);
    assert.equal(first.submission.Request_ID,p.requestId);
    assert.equal(second.submission.Submission_ID,first.submission.Submission_ID);
    assert.equal(second.alreadySubmitted,true);
    assert.equal(c.db.Assignment_Submissions.length,1);
    assert.equal(c.db.Notifications.length,notifications);
    assert.throws(()=>c.handleSubmitAssignment_({...p,submission:{...p.submission,Text_Content:'changed'}}),/ALREADY_SUBMITTED/);
  });
  await test('comment collisions do not duplicate existing comments from other authors', () => {
    const c=backend();
    const original={Comment_ID:'CMT01',User_ID:'U02',Team_ID:'T01',Ref_Type:'assignment',Ref_ID:'A01',Kind:'comment',Message:'Existing comment'};
    c.db.Discussion_Comments.push(original);
    c.mergeStudentDiscussionComments_(c.db,{Discussion_Comments:[original]},c.db.Users[2]);
    assert.equal(c.db.Discussion_Comments.length,1);
    const own={...original,User_ID:'U03',Team_ID:'T02',Message:'New comment'};
    c.mergeStudentDiscussionComments_(c.db,{Discussion_Comments:[original,own,own]},c.db.Users[2]);
    assert.equal(c.db.Discussion_Comments.length,2);
    assert.equal(c.db.Discussion_Comments[1].User_ID,'U03');
    assert.notEqual(c.db.Discussion_Comments[1].Comment_ID,'CMT01');
  });
  await test('dual role can submit own team through dedicated and compatible save paths', () => {
    const c=backend();
    assert.ok(c.handleSubmitAssignment_({requestId:'REQ_audit_dual_00001',auditUser:'U04',submission:submission()}).submission);
    const d=backend(), actor=d.db.Users[3], incoming=d.filterStateForUser_(d.db,actor);
    incoming.Assignment_Submissions.push(submission('T02','U04'));
    const merged=d.mergeClientStateForActor_(d.db,incoming,actor);
    assert.equal(merged.Assignment_Submissions.length,1);
    const e=backend(), foreign=e.filterStateForUser_(e.db,e.db.Users[3]);
    foreign.Assignment_Submissions.push(submission('T01','U04'));
    assert.throws(()=>e.mergeClientStateForActor_(e.db,foreign,e.db.Users[3]),/FORBIDDEN/);
  });
  await test('submission rejects another team, missing text and unassigned targets', () => {
    const c=backend(), p={requestId:'REQ_audit_check_00001',submission:submission('T01')};
    assert.throws(()=>c.handleSubmitAssignment_(p),/FORBIDDEN/);
    assert.throws(()=>c.handleSubmitAssignment_({...p,submission:{...submission(),Text_Content:''}}),/請完成/);
    c.db.Assignments[0].Target_Mode='selected';c.db.Assignments[0].Target_Team_IDs=['T01'];
    assert.throws(()=>c.handleSubmitAssignment_({...p,submission:submission()}),/找不到/);
    assert.equal(c.db.Assignment_Submissions.length,0);
  });
  await test('restore collision stops every collection without partial changes', () => {
    const c=backend(), state=c.db, before=clone(state);
    const entry={Snapshot_JSON:{collections:{Assignments:[{...state.Assignments[0],Title:'Old'}],Assignment_Submissions:[submission()]}}};
    assert.throws(()=>c.restoreRecycleBinSnapshot_(state,entry),/RESTORE_CONFLICT/);
    assert.deepEqual(clone(state),before);
  });
  await test('nonconflicting restore preserves relationships', () => {
    const c=backend(), old={...c.db.Assignments[0],Assignment_ID:'A_deleted'};
    const child={...submission(),Assignment_ID:'A_deleted'};
    const result=c.restoreRecycleBinSnapshot_(c.db,{Snapshot_JSON:{collections:{Assignments:[old],Assignment_Submissions:[child]}}});
    assert.equal(result.restoredRecords,2);
    assert.equal(c.db.Assignment_Submissions[0].Assignment_ID,'A_deleted');
  });
  await test('ordinary students still receive no internal calendar or work data', () => {
    const c=backend();
    c.db.Calendar_Events=[{Event_ID:'CE_1',Title:'Private'}];c.db.Work_Items=[{Work_Item_ID:'WI_1'}];
    c.db.Recycle_Bin=[{Recycle_ID:'RB_1'}];c.db.Users[0].Password='FAKE';
    const s=c.filterStateForUser_(c.db,c.db.Users[2]);
    assert.equal(s.Calendar_Events.length+s.Work_Items.length+s.Recycle_Bin.length,0);
    assert.ok(s.Users.every(u=>u.Team_ID==='T02'&&!u.Password));
  });
}

async function browserTests() {
  const server=http.createServer((req,res)=>{
    if(req.url==='/'||req.url==='/index.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,'index.html')));}
    else {res.statusCode=404;res.end('audit not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const errors=[];
  try {
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',timezoneId:'Asia/Taipei'});
    await context.route(/https:\/\/script\.(google|googleusercontent)\.com\//,route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{state:fixture(),currentUser:null}})}));
    const page=await context.newPage();page.setDefaultTimeout(7000);
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
    await page.evaluate(seed=>{
      window.__seed=seed;window.__request=requestGas;window.__toast=showToast;
      window.__reset=(id='U01')=>{
        authEpoch++;closeWorkItemModal(true);closeDateTimePicker();
        assignmentSubmitInFlight=false;closeAssignmentDetailModal(true);
        state=JSON.parse(JSON.stringify(window.__seed));normalizeStateSchema();
        currentUser=state.Users.find(u=>u.User_ID===id);authSessionToken='AUDIT-FAKE';
        remoteSaveInFlight=false;remoteSavePromise=null;pendingRemoteSave=false;remoteMutationInFlight=false;
        workspaceHydrationInFlight=false;remoteStateRevision=1;gasConnectionStatus='remote';
        activeTab='overview';activeWorkspace=id==='U01'?'admin':'team';setSaveFeedback('idle','');
        assignmentSubmitDrafts.clear();sessionStorage.clear();showToast=window.__toast;
        pendingLargeAssignmentAssetUpload=null;
        document.getElementById('toast-notif').classList.remove('opacity-100');
        document.getElementById('toast-notif').classList.add('opacity-0');
        requestGas=async()=>({ok:true,data:{state:JSON.parse(JSON.stringify(state)),currentUser,stateRevision:2,invites:[],entries:[]}});
        renderAll();
      };window.__reset();
    },fixture());
    await test('all main desktop views render without errors',async()=>{
      await page.evaluate(()=>state.Config_Stages.push({...state.Config_Stages[0],Stage_ID:generateSequentialId('S',[],'Stage_ID'),Is_Active:false}));
      for(const tab of ['overview','notifications','files','calendar','work-items','design-service','purchase','teams','stages','recycle']) {
        await page.evaluate(tab=>{activeTab=tab;renderAll();},tab);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,tab);
      }
    });
    await test('untrusted names render only as text and unsafe URLs are blocked',async()=>{
      await page.evaluate(()=>{
        window.__reset();window.__marker=0;
        state.Users[1].Name='<img src="/bad-image" onerror="window.__marker=1">';
        state.Teams[1].Team_Name='<img src="/bad-team" onerror="window.__marker=2">';
        activeTab='teams';renderAll();
      });
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(()=>window.__marker),0);
      assert.equal(await page.evaluate(()=>escapeAttributeUrl('javascript:alert(1)')),'#');
    });
    await test('remember email never stores a password and removes legacy credentials',async()=>{
      const result=await page.evaluate(()=>{
        localStorage.setItem(REMEMBERED_LOGIN_KEY,JSON.stringify({email:'old@example.invalid',password:'FAKE-OLD-PASSWORD'}));
        persistRememberedLogin('new@example.invalid','FAKE-NEW-PASSWORD',true);
        const values=Object.values(localStorage).join('');
        return {leak:values.includes('FAKE-NEW-PASSWORD')||values.includes('FAKE-OLD-PASSWORD'),email:getRememberedLogin().email,legacy:localStorage.getItem(REMEMBERED_LOGIN_KEY)};
      });
      assert.equal(result.leak,false);assert.equal(result.email,'new@example.invalid');assert.equal(result.legacy,null);
    });
    await test('failed submission retains text and modal; retry uses same request and confirms once',async()=>{
      const result=await page.evaluate(async()=>{
        window.__reset('U03');activeTab='files';renderAll();openAssignmentDetailModal('A01');
        document.getElementById('assignment-submit-text').value='Audit text retained';
        const toasts=[], requests=[];showToast=(message,type)=>toasts.push({message,type});
        requestGas=async(action,payload)=>{
          if(action!=='submitAssignment')throw new Error('Wrong action');
          requests.push(payload);
          if(requests.length===1)throw new Error('Simulated offline');
          const item={...payload.submission,Submission_ID:'SUB_server_unique',User_ID:'U03',Request_ID:payload.requestId,Submission_No:1,Status:'已繳交'};
          const next=JSON.parse(JSON.stringify(state));next.Assignment_Submissions.unshift(item);
          return {ok:true,data:{state:next,currentUser,submission:item,stateRevision:3}};
        };
        await handleSubmitAssignment({preventDefault(){}});
        const kept=activeAssignmentId==='A01'&&document.getElementById('assignment-submit-text').value==='Audit text retained';
        const failedSuccess=toasts.some(t=>t.type==='success');
        await handleSubmitAssignment({preventDefault(){}});
        return {kept,failedSuccess,requests:requests.map(r=>r.requestId),saved:state.Assignment_Submissions.length,closed:activeAssignmentId==='',drafts:assignmentSubmitDrafts.size,toasts};
      });
      assert.equal(result.kept,true);assert.equal(result.failedSuccess,false);
      assert.equal(result.requests.length,2);assert.equal(result.requests[0],result.requests[1]);
      assert.equal(result.saved,1);assert.equal(result.closed,true);assert.equal(result.drafts,0);
    });
    await test('queued edits and their callers wait for the latest save',async()=>{
      const result=await page.evaluate(async()=>{
        window.__reset();let finish;const titles=[];
        requestGas=(action,payload)=>{
          const sent=JSON.parse(JSON.stringify(payload.state));titles.push(sent.Assignments[0].Title);
          const response={ok:true,data:{state:sent,currentUser:sent.Users[0],stateRevision:titles.length+1}};
          return titles.length===1?new Promise(resolve=>finish=()=>resolve(response)):Promise.resolve(response);
        };
        state.Assignments[0].Title='first';const first=syncStateToBackend();
        state.Assignments[0].Title='second';const queued=syncStateToBackend();
        finish();const saved=await Promise.all([first,queued]);
        return {titles,saved,title:state.Assignments[0].Title,busy:remoteSaveInFlight};
      });
      assert.deepEqual(result.titles,['first','second']);assert.equal(result.title,'second');
      assert.ok(result.saved.every(x=>x.ok));assert.equal(result.busy,false);
    });
    await test('uploaded attachment and text are restored from the tab draft',async()=>{
      const result=await page.evaluate(()=>{
        window.__reset('U03');state.Assignments[0].Submission_Mode='file-text';
        const draft=getAssignmentSubmissionDraft('A01');
        draft.text='Recovered draft';draft.asset={assignmentId:'A01',teamId:'T02',fileName:'audit.png',fileUrl:'https://drive.google.com/file/d/audit/view',driveFileId:'audit',driveFolderId:'folder'};
        persistAssignmentSubmissionDraft(draft);assignmentSubmitDrafts.clear();pendingLargeAssignmentAssetUpload=null;
        openAssignmentDetailModal('A01');
        return {text:document.getElementById('assignment-submit-text').value,valid:getAssignmentSubmitFormValidation(state.Assignments[0]).allPassed,asset:getPendingLargeAssignmentAsset('A01','T02').fileName};
      });
      assert.equal(result.text,'Recovered draft');assert.equal(result.asset,'audit.png');assert.equal(result.valid,true);
    });
    await test('failed publish keeps form and reuses the same draft ID',async()=>{
      const result=await page.evaluate(async()=>{
        window.__reset();openAssignmentPostModal();
        document.getElementById('assignment-post-title').value='Draft publication';
        document.getElementById('assignment-post-body').value='Keep this description';
        const form=document.querySelector('#assignment-post-modal-body form');
        requestGas=async()=>{throw new Error('Simulated offline');};
        await handlePublishAssignment({preventDefault(){},currentTarget:form});
        await handlePublishAssignment({preventDefault(){},currentTarget:form});
        return {count:state.Assignments.filter(x=>x.Title==='Draft publication').length,title:document.getElementById('assignment-post-title').value,body:document.getElementById('assignment-post-body').value};
      });
      assert.equal(result.count,1);assert.equal(result.title,'Draft publication');assert.equal(result.body,'Keep this description');
      await page.evaluate(()=>closeAssignmentPostModal());
    });
    await test('confirmed earlier submission unlocks a changed draft without dropping its text',async()=>{
      const result=await page.evaluate(()=>{
        window.__reset('U03');
        const draft=getAssignmentSubmissionDraft('A01');
        draft.requestId='REQ_previous_confirmation';draft.text='Updated text';persistAssignmentSubmissionDraft(draft);
        state.Assignment_Submissions.push({Submission_ID:'SUB_previous',Assignment_ID:'A01',Team_ID:'T02',User_ID:'U03',Request_ID:draft.requestId,Text_Content:'Earlier text'});
        const restored=getAssignmentSubmissionDraft('A01');
        return {requestId:restored.requestId,text:restored.text,message:restored.message};
      });
      assert.equal(result.requestId,'');assert.equal(result.text,'Updated text');assert.ok(result.message.includes('前次繳交已確認成功'));
    });
    await test('blocked browser storage does not turn cloud confirmation into failure',async()=>{
      const result=await page.evaluate(async()=>{
        window.__reset();const original=Storage.prototype.setItem;
        Storage.prototype.setItem=()=>{throw new Error('QuotaExceeded');};
        try {
          state.Assignments[0].Title='Saved without browser cache';
          return {written:writeLocalStateSnapshot(state),saved:await syncStateToBackend(),status:saveFeedbackState};
        }finally{Storage.prototype.setItem=original;}
      });
      assert.equal(result.written,false);assert.equal(result.saved.ok,true);assert.equal(result.status,'saved');
    });
    await test('large upload completion keeps a draft and ignores stale account messages',async()=>{
      const result=await page.evaluate(()=>{
        window.__reset('U03');
        const sessionKey='audit-upload';
        largeUploadSessions[sessionKey]={sessionKey,authEpoch,userId:currentUser.User_ID,kind:'assignment-asset',assignmentId:'A01',teamId:'T02'};
        const event={origin:location.origin,data:{source:LARGE_UPLOAD_MESSAGE_SOURCE,sessionKey,mode:'assignment-asset',status:'success',assignmentId:'A01',fileName:'template.pdf',driveFileId:'audit-file',fileUrl:'https://drive.google.com/file/d/audit-file/view'}};
        handleLargeUploadWindowMessage(event);
        assignmentSubmitDrafts.clear();
        const asset=getAssignmentSubmissionDraft('A01').asset;
        clearStoredSession();
        currentUser=state.Users[0];
        handleLargeUploadWindowMessage(event);
        return {asset,stale:pendingLargeAssignmentAssetUpload};
      });
      assert.equal(result.asset.driveFileId,'audit-file');assert.equal(result.stale,null);
    });
    await test('state conflict does not silently discard local changes',async()=>{
      const result=await page.evaluate(async()=>{
        window.__reset();state.Assignments[0].Title='UNSAVED';
        requestGas=async()=>{throw new Error('STATE_CONFLICT');};
        const saved=await syncStateToBackend();
        return {saved,title:state.Assignments[0].Title,status:saveFeedbackState};
      });
      assert.equal(result.saved.ok,false);assert.equal(result.title,'UNSAVED');assert.equal(result.status,'conflict');
    });
    await test('time fields preserve focus and Done closes with the selected value',async()=>{
      await page.evaluate(()=>{window.__reset();openWorkItemModal('');});
      await page.waitForTimeout(400);
      await page.getByRole('button',{name:'選擇到期時間',exact:true}).click();
      await page.getByRole('textbox',{name:'小時',exact:true}).fill('15');
      await page.getByRole('textbox',{name:'分鐘',exact:true}).click();
      assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'分鐘');
      await page.getByRole('textbox',{name:'分鐘',exact:true}).fill('27');
      await page.locator('#date-time-picker-portal').getByRole('button',{name:'完成',exact:true}).click();
      assert.equal(await page.locator('#date-time-picker-portal').isVisible(),false);
      assert.ok((await page.locator('#work-item-due').inputValue()).endsWith('T15:27'));
    });
    await test('invalid time gets a clear message instead of silently changing it',async()=>{
      await page.getByRole('button',{name:'選擇到期時間',exact:true}).click();
      await page.getByRole('textbox',{name:'小時',exact:true}).fill('99');
      await page.locator('#date-time-picker-portal').getByRole('button',{name:'完成',exact:true}).click();
      assert.equal(await page.locator('#date-time-picker-portal').isVisible(),true);
      assert.ok((await page.locator('[data-date-time-picker-error]').textContent()).includes('00–23'));
      await page.getByRole('textbox',{name:'小時',exact:true}).fill('16');
      await page.locator('#date-time-picker-portal').getByRole('button',{name:'完成',exact:true}).click();
    });
    await test('mobile modal stays within viewport and scrolls to its action buttons',async()=>{
      await page.evaluate(()=>{window.__reset();});await page.setViewportSize({width:390,height:844});
      await page.evaluate(()=>openWorkItemModal(''));await page.waitForTimeout(400);
      assert.equal(await page.evaluate(()=>{const r=document.getElementById('work-item-modal').firstElementChild.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}),true);
      if(process.env.AUDIT_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.AUDIT_SCREENSHOT_DIR,{recursive:true});
        await page.screenshot({path:path.join(process.env.AUDIT_SCREENSHOT_DIR,'mobile-work.png')});
      }
      await page.locator('#work-item-save').scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(()=>{const r=document.getElementById('work-item-save').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true);
      if(process.env.AUDIT_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.AUDIT_SCREENSHOT_DIR,'mobile-work-actions.png')});
    });
    await test('late save does not reopen a logged-out account',async()=>{
      const result=await page.evaluate(async()=>{
        window.__reset();let finish;
        requestGas=(action,payload)=>{
          if(action!=='saveState')return Promise.resolve({ok:true,data:{}});
          const next=JSON.parse(JSON.stringify(payload.state));
          return new Promise(resolve=>finish=()=>resolve({ok:true,data:{state:next,currentUser:next.Users[0]}}));
        };
        const saving=syncStateToBackend();await handleLogout();finish();await saving;
        return {user:currentUser,token:authSessionToken};
      });
      assert.equal(result.user,null);assert.equal(result.token,'');
    });
    await test('stale bootstrap error does not clear a newer login',async()=>{
      const result=await page.evaluate(async()=>{
        window.__reset('U02');let rejectOld;
        requestGas=()=>new Promise((resolve,reject)=>{rejectOld=reject;});
        const generation=++workspaceHydrationGeneration;
        const loading=bootstrapRemoteState({workspaceHydrationId:generation,suppressBootLoader:true});
        workspaceHydrationGeneration++;authEpoch++;currentUser=state.Users[2];authSessionToken='AUDIT-NEW';
        rejectOld(new Error('AUTH_EXPIRED'));await loading;
        return {user:currentUser.User_ID,token:authSessionToken};
      });
      assert.equal(result.user,'U03');assert.equal(result.token,'AUDIT-NEW');
    });
    await test('stalled login times out, releases button and keeps entered values',async()=>{
      await page.clock.install();
      await page.evaluate(()=>{
        window.__reset();currentUser=null;authSessionToken='';renderAll();
        document.getElementById('login-email').value='audit@example.invalid';
        document.getElementById('login-password').value='AUDIT-FAKE';
        requestGas=window.__request;window.fetch=()=>new Promise(()=>{});
        handleLogin({preventDefault(){}});
      });
      await page.clock.fastForward(31000);await page.clock.fastForward(1000);
      assert.equal(await page.evaluate(()=>loginSubmitInFlight),false);
      assert.equal(await page.locator('#login-email').inputValue(),'audit@example.invalid');
      assert.ok((await page.locator('#login-feedback').textContent()).includes('再次按'));
    });
    await test('no uncaught browser runtime errors',()=>assert.deepEqual(errors,[]));
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
async function runSuite() {
  await backendTests();await browserTests();
  const failed=results.filter(r=>!r.passed);
  const summary={total:results.length,passed:results.length-failed.length,failed:failed.length};
  console.log(JSON.stringify(summary));
  if(process.env.STABILITY_REPORT_PATH) {
    const sources=Object.fromEntries(['index.html','large-upload.html','gas/Code.gs','gas/LargeUpload.html','gas/appsscript.json'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
    fs.writeFileSync(process.env.STABILITY_REPORT_PATH,JSON.stringify({generatedAt:new Date().toISOString(),scope:'Isolated local mocks only; no live GAS mutations',summary,sources,results},null,2)+'\n');
  }
  if(failed.length)process.exitCode=1;
}
module.exports={fixture,backend};
if(require.main===module) runSuite().catch(error=>{console.error(error);process.exitCode=1;});
