const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const http = require('node:http');
const { chromium } = require('playwright');
const { fixture, backend } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error('FAIL ' + name + '\n' + error.stack); }
}
function context() {
  const c = backend();
  c.reads = [];
  c.writes = 0;
  c.locked = false;
  c.withLock_ = fn => { assert.equal(c.locked, false); c.locked = true; try { return fn(); } finally { c.locked = false; } };
  c.loadState_ = options => { c.reads.push(options); return clone(c.db); };
  c.persistState_ = (next, options) => { c.writes++; c.db = c.normalizeState_(clone(next)); c.db.Meta.State_Revision = options.nextRevision; };
  c.requireSessionUser_ = (state, payload) => {
    const user = state.Users.find(item => item.User_ID === (payload.auditUser || 'U03'));
    if (!user || user.Status !== 'Active') throw new Error('AUTH_EXPIRED');
    return user;
  };
  c.jsonResponse_ = (ok, data, error) => ({ ok, data, error: error && error.message });
  return c;
}
const message = (extra = {}) => ({ requestId: 'REQ_comment_fixture_0001', refType: 'assignment', refId: 'A01', message: 'Fixture comment', workspace: 'team', ...extra });
const dispatch = (c, payload) => c.doPost({ postData: { contents: JSON.stringify({ action: 'postDiscussionComment', ...payload }) } });
const completed = (extra = {}) => ({ status: 'success', mode: 'assignment-asset', sessionKey: 'SESSION_fixture', assignmentId: 'A01', assetReceipt: 'SYNTHETIC_RECEIPT', driveFileId: 'SYNTHETIC_DRIVE_ID', fileName: 'fixture.zip', fileUrl: 'https://example.invalid/file', ...extra });

async function backendTests() {
  await test('dedicated comment action is locked and uses fresh reads before and after commit', () => {
    const c = context(), original = c.loadState_;
    c.loadState_ = options => { assert.equal(c.locked, true); assert.equal(options.fresh, true); return original(options); };
    const response = dispatch(c, message({ userId: 'U01', authorRole: 'SuperAdmin', kind: 'system' }));
    assert.equal(response.ok, true);
    assert.equal(response.data.comment.User_ID, 'U03');
    assert.equal(response.data.comment.Author_Role, 'Member');
    assert.equal(response.data.comment.Kind, 'comment');
    assert.equal(c.writes, 1);
    assert.equal(c.db.Meta.State_Revision, 2);
  });
  await test('two same-team authors with stale client revisions retain both comments', () => {
    const c = context();
    const a = dispatch(c, message({ message: 'Author A', auditUser: 'U03', stateRevision: 1 }));
    const b = dispatch(c, message({ message: 'Author B', auditUser: 'U04', stateRevision: 1 }));
    assert.equal(a.ok && b.ok, true);
    assert.deepEqual(c.db.Discussion_Comments.map(item => item.Message), ['Author A', 'Author B']);
    assert.equal(new Set(c.db.Discussion_Comments.map(item => item.Comment_ID)).size, 2);
    assert.equal(c.db.Discussion_Comments[1].Author_Role, 'Member');
    assert.equal(c.db.Meta.State_Revision, 3);
  });
  await test('comment retry acknowledges one record and one set of notifications', () => {
    const c = context(), a = dispatch(c, message()), notices = c.db.Notifications.length;
    const b = dispatch(c, message());
    assert.equal(b.data.alreadyPosted, true);
    assert.equal(a.data.comment.Comment_ID, b.data.comment.Comment_ID);
    assert.equal(c.db.Discussion_Comments.length, 1);
    assert.equal(c.db.Notifications.length, notices);
    assert.equal(c.writes, 1);
    assert.equal(dispatch(c, message({ message: 'Changed payload' })).ok, false);
    assert.equal(c.writes, 1);
  });
  await test('lost confirmation after commit is safely retried without a second comment', () => {
    const c = context(), original = c.loadState_;
    c.loadState_ = options => { if (c.writes) throw new Error('Simulated read timeout'); return original(options); };
    assert.equal(dispatch(c, message()).ok, false);
    assert.equal(c.db.Discussion_Comments.length, 1);
    c.loadState_ = original;
    assert.equal(dispatch(c, message()).data.alreadyPosted, true);
    assert.equal(c.writes, 1);
  });
  await test('failed atomic comment save leaves the database and notices unchanged', () => {
    const c = context(), before = clone(c.db);
    c.persistState_ = () => { throw new Error('SAVE_NOT_CONFIRMED'); };
    assert.equal(dispatch(c, message()).ok, false);
    assert.deepEqual(clone(c.db), before);
  });
  await test('students cannot forge staff identity or comment outside assigned contexts', () => {
    const c = context();
    c.db.Assignments[0].Target_Mode = 'selected'; c.db.Assignments[0].Target_Team_IDs = ['T01'];
    assert.equal(dispatch(c, message({ workspace: 'admin', authorRole: 'SuperAdmin' })).ok, false);
    c.db.Files = [{ File_ID: 'F1', File_Group_Key: 'FG1', Team_ID: 'T01', File_Name: 'foreign.pdf', Version_No: 1 }];
    assert.equal(dispatch(c, message({ refType: 'file-group', refId: 'FG1' })).ok, false);
    assert.equal(c.writes, 0);
  });
  await test('staff comments use server identity and notify only eligible assigned teams', () => {
    const c = context(); c.db.Assignments[0].Target_Mode = 'selected'; c.db.Assignments[0].Target_Team_IDs = ['T02'];
    const response = dispatch(c, message({ auditUser: 'U01', workspace: 'admin' }));
    assert.equal(response.ok, true);
    assert.equal(response.data.comment.Author_Role, 'SuperAdmin');
    assert.deepEqual(c.db.Notifications.map(item => item.User_ID).sort(), ['U03', 'U04']);
  });
  await test('file comments append to own group and reject deleted groups on retry', () => {
    const c = context(); c.db.Files = [{ File_ID: 'F1', File_Group_Key: 'FG1', Team_ID: 'T02', File_Name: 'own.pdf', Version_No: 1 }];
    const p = message({ refType: 'file-group', refId: 'FG1' });
    assert.equal(dispatch(c, p).ok, true);
    c.db.Files = [];
    assert.equal(dispatch(c, p).ok, false);
  });
  await test('invalid, overlong and expired comment requests never write', () => {
    const c = context();
    for (const extra of [{ message: '' }, { message: 'x'.repeat(5001) }, { requestId: 'short' }, { refType: 'unknown' }]) {
      assert.equal(dispatch(c, message(extra)).ok, false);
    }
    c.db.Users[2].Status = 'Pending';
    assert.equal(dispatch(c, message()).ok, false);
    assert.equal(c.writes, 0);
  });
  await test('completed backend upload returns explicit completion, including legacy cached results', () => {
    const c = context();
    assert.equal(c.buildCompletedResumableResult_(completed()).complete, true);
    assert.throws(() => c.buildCompletedResumableResult_(completed({ assetReceipt: '' })), /UPLOAD_NOT_CONFIRMED/);
    c.loadResumableUploadSession_ = () => ({ status: 'completed', userId: 'U03', completedResult: completed() });
    c.verifyResumableUploadSession_ = () => { throw new Error('AUTH_REQUIRED'); };
    assert.throws(() => c.uploadResumableLargeUploadChunk({}), /AUTH_REQUIRED/);
    c.verifyResumableUploadSession_ = () => {};
    assert.equal(c.uploadResumableLargeUploadChunk({}).complete, true);
  });
  await test('retrying completed upload start authenticates and reuses the prior result', () => {
    const c = context();
    c.loadResumableUploadSession_ = () => ({ status: 'completed', completedResult: completed(), userId: 'U03', mode: 'assignment-asset', assignmentId: 'A01', sourceFileName: 'fixture.zip', fileSize: 20971829, mimeType: 'application/zip' });
    c.verifyResumableUploadSession_ = () => {};
    c.buildResumableUploadPreparation_ = () => { throw new Error('Must not create another upload'); };
    const p = { mode: 'assignment-asset', assignmentId: 'A01', sourceFileName: 'fixture.zip', fileSize: 20971829, mimeType: 'application/zip' };
    assert.equal(c.startResumableLargeUpload(p).complete, true);
    assert.throws(() => c.startResumableLargeUpload({ ...p, sourceFileName: 'changed.zip' }), /UPLOAD_CONTEXT_CHANGED/);
    assert.throws(() => c.startResumableLargeUpload({ ...p, auditUser: 'U02' }), /FORBIDDEN/);
  });
  await test('active upload start is reused and rejects a different source file', () => {
    const c = context();
    const preparation = { sessionKey: 'SESSION_fixture', currentUser: c.db.Users[2], mode: 'assignment-asset', teamId: 'T02', assignmentId: 'A01', sourceFileName: 'fixture.zip', fileSize: 20971829, mimeType: 'application/zip' };
    c.buildResumableUploadPreparation_ = () => preparation;
    c.loadResumableUploadSession_ = () => ({ ...preparation, userId: 'U03', status: 'active' });
    c.verifyResumableUploadSession_ = () => {};
    assert.equal(c.startResumableLargeUpload({ sessionKey: 'SESSION_fixture' }).status, 'started');
    c.loadResumableUploadSession_ = () => ({ ...preparation, userId: 'U03', status: 'active', sourceFileName: 'other.zip' });
    assert.throws(() => c.startResumableLargeUpload({ sessionKey: 'SESSION_fixture' }), /UPLOAD_CONTEXT_CHANGED/);
  });
  await test('last chunk finalizes once and stores the completed result before unlocking', () => {
    const c = context(); let finalizeCalls = 0, driveCalls = 0;
    let session = { sessionKey: 'SESSION_fixture', status: 'active', mode: 'assignment-asset', userId: 'U03', teamId: 'T02', assignmentId: 'A01', fileSize: 3 };
    c.loadResumableUploadSession_ = () => clone(session);
    c.verifyResumableUploadSession_ = () => {};
    c.Utilities.base64Decode = () => [1, 2, 3];
    c.uploadDriveResumableChunk_ = () => { driveCalls++; return { responseCode: 200, body: '{}' }; };
    c.buildResumableDriveResult_ = () => ({ fileId: 'SYNTHETIC_DRIVE_ID' });
    c.handleLargeAssignmentAssetFormUpload_ = () => { finalizeCalls++; return completed(); };
    c.saveResumableUploadSession_ = value => { assert.equal(c.locked, true); session = clone(value); };
    const p = { sessionKey: 'SESSION_fixture', totalSize: 3, totalChunks: 1, chunkStart: 0, chunkEnd: 2, chunkBase64: 'synthetic' };
    assert.equal(c.uploadResumableLargeUploadChunk(p).complete, true);
    assert.equal(c.uploadResumableLargeUploadChunk(p).complete, true);
    assert.equal(finalizeCalls, 1); assert.equal(driveCalls, 1);
    c.saveResumableUploadSession_ = () => { throw new Error('Cache unavailable'); };
    session.status = 'active'; delete session.completedResult;
    let trashed = false; c.trashNewUploadAfterFailure_ = () => { trashed = true; };
    assert.throws(() => c.uploadResumableLargeUploadChunk(p), /Cache unavailable/);
    assert.equal(trashed, false, 'A committed file must not be trashed because the completion cache failed');
  });
}

async function uploadPageTests() {
  for (const file of ['large-upload.html', 'gas/LargeUpload.html']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const start = source.indexOf('function isCompletedResumableResult(result)');
    const end = source.indexOf(file.startsWith('gas/') ? 'function closeWindow()' : 'function notifyOpener(result)', start);
    async function run(options = {}) {
      const progress = [], calls = [], size = 20971829;
      const answer = completed(options.answer || {});
      const server = async (action, payload) => {
        calls.push({ action, payload });
        if (action === 'startResumableLargeUpload') return options.completedStart ? answer : { chunkSize: 2097152 };
        if (options.invalidProgress) return { complete: false };
        return payload.chunkEnd === size - 1 ? answer : { complete: false, nextByte: payload.chunkEnd + 1 };
      };
      const c = vm.createContext({
        model: { mode: 'assignment-asset', sessionKey: 'SESSION_fixture', assignmentId: 'A01' },
        resumableChunkBytes: 2097152, setTransferProgress: (percent, label) => progress.push({ percent, label }),
        setStatus: () => {}, readChunkAsBase64: async () => 'synthetic', formatFileSize: String,
        buildUploadPayload: () => ({}), getFormUploadPayload: () => ({}),
        requestGas: server, callResumableServer: server,
        callChunkWithRetry: payload => server('uploadResumableLargeUploadChunk', payload),
        handleSuccess: result => { c.success = result; }, document: { getElementById: () => null },
        window: { setTimeout: fn => fn(), setInterval: () => 1, clearInterval: () => {} }
      });
      vm.runInContext(source.slice(start, end), c);
      const result = await c.handleResumableSubmit({ size });
      return { result: result || c.success, progress, calls };
    }
    await test(file + ' accepts verified legacy and explicit completion responses at 100 percent', async () => {
      for (const answer of [{}, { complete: true }]) {
        const r = await run({ answer });
        assert.equal(r.calls.length, 12);
        assert.equal(r.result.assetReceipt, 'SYNTHETIC_RECEIPT');
        assert.equal(r.progress.at(-1).percent, 100);
      }
    });
    await test(file + ' completed retry notifies the parent without uploading chunks again', async () => {
      const r = await run({ completedStart: true });
      assert.equal(r.calls.length, 1); assert.equal(r.progress.at(-1).percent, 100);
    });
    await test(file + ' refuses missing receipt, wrong context and unconfirmed byte progress', async () => {
      for (const answer of [{ assetReceipt: '' }, { sessionKey: 'OTHER_SESSION' }, { assignmentId: 'OTHER_ASSIGNMENT' }, { driveFileId: '' }]) {
        await assert.rejects(run({ answer }), /完整上傳確認/);
      }
      await assert.rejects(run({ invalidProgress: true }), /完整上傳確認/);
    });
  }
}

async function browserTests() {
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html;charset=utf-8'); res.end(fs.readFileSync(path.join(root, 'index.html'))); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const browserContext = await browser.newContext({ viewport: { width: 1100, height: 800 }, timezoneId: 'Asia/Taipei', reducedMotion: 'reduce' });
    await browserContext.route(/https:\/\/script\.(google|googleusercontent)\.com\//, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: { state: fixture(), currentUser: null } }) }));
    const page = await browserContext.newPage();
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
    await page.evaluate(seed => {
      window.seed = seed;
      window.resetCommentTest = () => {
        authEpoch++; cancelQueuedRemoteStateSync(); sessionStorage.clear();
        state = JSON.parse(JSON.stringify(window.seed)); normalizeStateSchema(); currentUser = state.Users[2];
        authSessionToken = 'SYNTHETIC_SESSION'; expiredSessionToken = ''; activeWorkspace = 'team'; activeTab = 'files';
        remoteSaveInFlight = false; remoteSavePromise = null; pendingRemoteSave = false; remoteMutationInFlight = false;
        remoteStateRevision = 1; gasConnectionStatus = 'remote'; setSaveFeedback('idle', '');
        discussionCommentDrafts.clear(); discussionCommentInFlight = false;
        assignmentSubmitInFlight = false; assignmentSubmitDrafts.clear(); assignmentWizardStep = 1;
        window.toasts = []; window.sentComments = [];
        showToast = (message, type) => window.toasts.push({ message, type });
        requestGas = async (action, payload) => {
          if (action !== 'postDiscussionComment') throw new Error('Unexpected action ' + action);
          window.sentComments.push(JSON.parse(JSON.stringify(payload)));
          return new Promise((resolve, reject) => {
            window.rejectComment = reject;
            window.finishComment = (extra = {}) => {
              const comment = { Comment_ID: 'CMT_SERVER_FIXTURE', Ref_Type: payload.refType, Ref_ID: payload.refId, Message: payload.message, User_ID: currentUser.User_ID, Team_ID: currentUser.Team_ID, Author_Name: currentUser.Name, Author_Role: 'Member', Kind: 'comment', Created_At: '2026-10-21 10:00' };
              const next = JSON.parse(JSON.stringify(window.seed)); next.Discussion_Comments = [comment];
              resolve({ ok: true, authEpoch, data: { state: next, currentUser, stateRevision: 2, requestId: payload.requestId, comment, ...extra } });
            };
          });
        };
        renderAll(); openAssignmentDetailModal('A01'); document.getElementById('assignment-history-disclosure').open = true;
      };
      window.resetCommentTest();
    }, fixture());
    await test('comment pending state retains text, prevents double clicks and does not announce success', async () => {
      await page.locator('#assignment-thread-input').fill('Pending fixture');
      await page.locator('#assignment-thread-input-submit').click();
      await page.evaluate(() => submitAssignmentDiscussionComment());
      assert.equal(await page.locator('#assignment-thread-input').inputValue(), 'Pending fixture');
      assert.equal(await page.locator('#assignment-thread-input-submit').isDisabled(), true);
      assert.deepEqual(await page.evaluate(() => ({ calls: sentComments.length, comments: state.Discussion_Comments.length, success: toasts.some(item => item.type === 'success') })), { calls: 1, comments: 0, success: false });
      await page.evaluate(() => renderAssignmentDetailModal());
      assert.equal(await page.locator('#assignment-thread-input').inputValue(), 'Pending fixture');
      assert.equal(await page.locator('#assignment-thread-input-submit').isDisabled(), true);
      await page.evaluate(() => window.finishComment());
      await page.waitForFunction(() => !discussionCommentInFlight);
      assert.equal(await page.locator('#assignment-thread-input').inputValue(), '');
      assert.equal(await page.evaluate(() => state.Discussion_Comments.length), 1);
      assert.equal(await page.evaluate(() => toasts.some(item => item.type === 'success')), true);
    });
    await test('comment timeout preserves draft across rerender and retries the identical request ID', async () => {
      await page.evaluate(() => window.resetCommentTest());
      await page.locator('#assignment-thread-input').fill('Retained fixture');
      await page.locator('#assignment-thread-input-submit').click();
      await page.evaluate(() => window.rejectComment(new Error('REQUEST_TIMEOUT')));
      await page.waitForFunction(() => !discussionCommentInFlight);
      assert.equal(await page.locator('#assignment-thread-input').inputValue(), 'Retained fixture');
      assert.equal(await page.locator('#assignment-thread-input').getAttribute('readonly'), '');
      assert.match(await page.locator('#assignment-thread-input-status').innerText(), /未確認/);
      await page.evaluate(() => { discussionCommentDrafts.clear(); renderAssignmentDetailModal(); });
      assert.equal(await page.locator('#assignment-thread-input').inputValue(), 'Retained fixture');
      await page.locator('#assignment-thread-input-submit').click();
      assert.equal(await page.evaluate(() => sentComments[0].requestId === sentComments[1].requestId), true);
      assert.equal(await page.evaluate(() => toasts.some(item => item.type === 'success')), false);
      await page.evaluate(() => window.finishComment({ alreadyPosted: true }));
      await page.waitForFunction(() => !discussionCommentInFlight);
      assert.match(await page.locator('#assignment-thread-input-status').innerText(), /沒有重複新增/);
      assert.equal(await page.locator('#assignment-thread-input').getAttribute('readonly'), null);
    });
    await test('interrupted pending comment restores a retryable draft instead of a stuck loading state', async () => {
      await page.evaluate(() => window.resetCommentTest());
      await page.locator('#assignment-thread-input').fill('Interrupted fixture');
      await page.locator('#assignment-thread-input-submit').click();
      await page.evaluate(() => {
        authEpoch++; discussionCommentInFlight = false; remoteMutationInFlight = false;
        discussionCommentDrafts.clear(); renderAssignmentDetailModal();
      });
      assert.equal(await page.locator('#assignment-thread-input').inputValue(), 'Interrupted fixture');
      assert.equal(await page.locator('#assignment-thread-input-submit').isDisabled(), false);
      assert.match(await page.locator('#assignment-thread-input-status').innerText(), /前次留言結果尚未確認/);
      assert.equal(await page.locator('#assignment-thread-input').getAttribute('readonly'), '');
      assert.equal(await page.evaluate(() => state.Discussion_Comments.length), 0);
    });
    await test('malformed acknowledgement and offline mode never clear text', async () => {
      await page.evaluate(() => window.resetCommentTest());
      await page.locator('#assignment-thread-input').fill('Unconfirmed fixture');
      await page.locator('#assignment-thread-input-submit').click();
      await page.evaluate(() => window.finishComment({ requestId: 'WRONG_REQUEST' }));
      await page.waitForFunction(() => !discussionCommentInFlight);
      assert.equal(await page.locator('#assignment-thread-input').inputValue(), 'Unconfirmed fixture');
      assert.equal(await page.evaluate(() => toasts.some(item => item.type === 'success')), false);
      await page.evaluate(() => { authSessionToken = ''; });
      await page.locator('#assignment-thread-input-submit').click();
      assert.equal(await page.evaluate(() => sentComments.length), 1);
      assert.equal(await page.locator('#assignment-thread-input').inputValue(), 'Unconfirmed fixture');
    });
    await test('comment drafts remain isolated between accounts and late auth responses are ignored', async () => {
      await page.evaluate(() => window.resetCommentTest());
      await page.locator('#assignment-thread-input').fill('Private draft');
      await page.locator('#assignment-thread-input-submit').click();
      await page.evaluate(() => {
        const finish = window.finishComment;
        authEpoch++; currentUser = state.Users[1]; discussionCommentInFlight = false; remoteMutationInFlight = false;
        renderAssignmentDetailModal(); finish();
      });
      assert.equal(await page.locator('#assignment-thread-input').inputValue(), '');
      assert.equal(await page.evaluate(() => state.Discussion_Comments.length), 0);
      assert.equal(await page.evaluate(() => toasts.some(item => item.type === 'success')), false);
    });
    await test('mobile comment retry stays visible and file thresholds agree at 18 MiB', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => window.resetCommentTest());
      await page.locator('#assignment-thread-input').fill('Mobile retry fixture');
      await page.locator('#assignment-thread-input-submit').click();
      await page.evaluate(() => window.rejectComment(new Error('REQUEST_TIMEOUT')));
      await page.waitForFunction(() => !discussionCommentInFlight);
      await page.locator('#assignment-thread-input-status').scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(await page.evaluate(() => [18 * 1024 * 1024, 18 * 1024 * 1024 + 1, 20 * 1024 * 1024, 2 * 1024 ** 3 + 1].map(size => needsResumableLargeUpload({ size }))), [false, true, true, false]);
      if (process.env.UPLOAD_COMMENTS_SCREENSHOT_PATH) await page.screenshot({ path: process.env.UPLOAD_COMMENTS_SCREENSHOT_PATH });
    });
    await test('two isolated browser sessions use the real request path and append both comments', async () => {
      const c = context(), queue = [], clients = [];
      try {
        for (const actor of ['U03', 'U04']) {
          const client = await browser.newContext({ viewport: { width: 1100, height: 800 }, reducedMotion: 'reduce' });
          clients.push(client);
          await client.route(/https:\/\/script\.(google|googleusercontent)\.com\//, async route => {
            const payload = JSON.parse(route.request().postData() || '{}');
            if (payload.action !== 'postDiscussionComment') {
              assert.notEqual(payload.action, 'saveState', 'Comment submission must not save a whole workbook');
              await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: { state: fixture(), currentUser: null } }) });
              return;
            }
            queue.push({ route, payload: { ...payload, auditUser: actor } });
            if (queue.length === 2) {
              for (const item of queue) {
                const response = dispatch(c, item.payload);
                await item.route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
              }
            }
          });
          const clientPage = await client.newPage();
          await clientPage.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
          await clientPage.evaluate(({ seed, actor }) => {
            authEpoch++; cancelQueuedRemoteStateSync();
            state = seed; normalizeStateSchema(); currentUser = state.Users.find(user => user.User_ID === actor);
            authSessionToken = 'SYNTHETIC_' + actor; expiredSessionToken = '';
            remoteSaveInFlight = false; remoteSavePromise = null; pendingRemoteSave = false; remoteMutationInFlight = false;
            gasConnectionStatus = 'remote'; remoteStateRevision = 1; setSaveFeedback('idle', '');
            activeWorkspace = 'team'; activeTab = 'files'; renderAll(); openAssignmentDetailModal('A01');
            document.getElementById('assignment-history-disclosure').open = true;
          }, { seed: fixture(), actor });
          await clientPage.locator('#assignment-thread-input').fill('Concurrent fixture ' + actor);
        }
        const pages = clients.map(client => client.pages()[0]);
        await pages[0].evaluate(() => { pendingRemoteSave = true; });
        await pages[0].locator('#assignment-thread-input-submit').click();
        await pages[0].waitForFunction(() => !discussionCommentInFlight);
        assert.equal(queue.length, 0, 'An unrelated unconfirmed save must block the mutation before network dispatch');
        assert.equal(await pages[0].locator('#assignment-thread-input').inputValue(), 'Concurrent fixture U03');
        await pages[0].evaluate(() => { pendingRemoteSave = false; });
        await Promise.all(pages.map(clientPage => clientPage.locator('#assignment-thread-input-submit').click()));
        for (const clientPage of pages) {
          await clientPage.waitForFunction(() => !discussionCommentInFlight);
          assert.equal(await clientPage.locator('#assignment-thread-input').inputValue(), '');
          assert.match(await clientPage.locator('#assignment-thread-input-status').innerText(), /雲端已確認/);
        }
        assert.equal(queue.length, 2);
        assert.deepEqual(c.db.Discussion_Comments.map(item => item.Message).sort(), ['Concurrent fixture U03', 'Concurrent fixture U04']);
      } finally { for (const client of clients) await client.close(); }
    });
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}

(async () => {
  await backendTests(); await uploadPageTests(); await browserTests();
  const report = { isolated: true, productionWrites: 0, results, passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length };
  if (process.env.UPLOAD_COMMENTS_REPORT_PATH) fs.writeFileSync(process.env.UPLOAD_COMMENTS_REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
  if (report.failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
