const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { fixture, backend } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error('FAIL ' + name + '\n' + error.stack); }
}

function seed() {
  const state = fixture();
  state.Meta.State_Revision = 5;
  state.Config_Stages.push({ Stage_ID: 'S02', Stage_Name: 'Isolated inactive stage', Is_Active: false, Budget_Allocated: 2000 });
  state.Assignments[0].Stage_ID = 'S02';
  state.Assignment_Resources = [{ Resource_ID: 'AR02', Assignment_ID: 'A01', File_Name: 'fixture.pdf' }];
  state.Calendar_Events = [{ Event_ID: 'CE02', Stage_ID: 'S02', Title: 'Fixture event', Starts_At: '2026-10-20 10:00', Ends_At: '2026-10-20 11:00' }];
  state.Work_Items = [{ Work_Item_ID: 'WI02', Stage_ID: 'S02', Title: 'Fixture work', Status: '待認養' }];
  state.Design_Service_Orders = [{ Service_Order_ID: 'DS02', Assignment_ID: 'A01', Title: 'Fixture order' }];
  state.Notifications = [
    { Notification_ID: 'N02', Ref_Type: 'stage', Ref_ID: 'S02', User_ID: 'U01' },
    { Notification_ID: 'NW02', Ref_Type: 'work-item', Ref_ID: 'WI02', User_ID: 'U01' }
  ];
  state.Discussion_Comments = [{ Comment_ID: 'C02', Ref_Type: 'stage', Ref_ID: 'S02', Message: 'Fixture comment' }];
  return state;
}

function context() {
  const c = backend();
  c.db = clone(seed());
  c.stale = clone(c.db); c.stale.Meta.State_Revision = 4;
  c.loadCalls = [];
  c.loadState_ = options => { c.loadCalls.push(clone(options)); return clone(options?.fresh ? c.db : c.stale); };
  c.persistState_ = (next, options = {}) => { c.db = clone(next); c.db.Meta.State_Revision = options.nextRevision || c.db.Meta.State_Revision + 1; c.stale = clone(c.db); };
  c.formatDateTime_ = value => new Date(value).toISOString().slice(0, 19).replace('T', ' ');
  c.appendActivityLogEntries_ = () => {};
  c.enqueueDeferredDriveTrash_ = () => ({ pending: 0, failed: 0, trashed: 0 });
  c.buildClientStateResultForUser_ = (state, actor, extra = {}) => ({ state: clone(state), currentUser: clone(actor), stateRevision: state.Meta.State_Revision, release: c.APP_RELEASE, ...extra });
  return c;
}

async function logic() {
  await test('fresh state reads bypass a stale script cache', () => {
    const c = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(root, 'gas/Code.gs'), 'utf8'), c);
    const old = clone(seed()), current = clone(seed()); old.Meta.State_Revision = 4;
    c.getCachedState_ = () => clone(old); c.setupSheets_ = () => {};
    c.nowString_ = () => '2026-10-17 17:00';
    c.getConfig_ = () => ({ spreadsheetId: 'ISOLATED_SHEET' });
    c.SpreadsheetApp = { openById: () => ({}) };
    c.readTable_ = (_, name) => clone(current[name] || []);
    c.readMetaSheet_ = () => clone(current.Meta); c.cacheState_ = () => {};
    c.ScriptApp = { getOAuthToken: () => 'ISOLATED_TOKEN' };
    c.UrlFetchApp = { fetch: url => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({
      valueRanges: new URL(url).searchParams.getAll('ranges').map(range => {
        const name = range.match(/^'([^']+)'/)[1], schema = c.TABLE_SCHEMAS[name];
        const rows = name === 'Meta' ? Object.entries(current.Meta).map(([Key, Value]) => ({ Key, Value })) : current[name] || [];
        return { range, values: [schema.headers, ...rows.map(row => schema.headers.map(key => c.serializeValue_(row[key], schema.types[key] || 'string')))] };
      })
    }) }) };
    assert.equal(c.loadState_().Meta.State_Revision, 4);
    assert.equal(c.loadState_({ fresh: true }).Meta.State_Revision, 5);
  });
  await test('fresh bootstrap reads under the script lock', () => {
    const c = context(); let locked = false;
    c.withLock_ = fn => { locked = true; try { return fn(); } finally { locked = false; } };
    c.requireSessionContext_ = () => ({ user: c.db.Users[0], session: {} });
    const load = c.loadState_;
    c.loadState_ = options => { assert.equal(locked, true); return load(options); };
    assert.equal(c.handleBootstrap_({ fresh: true, includeHeatmap: false }).stateRevision, 5);
    assert.equal(c.loadCalls[0].fresh, true);
  });
  await test('fresh API errors and partial results never fall back to cached data', () => {
    const c = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(root, 'gas/Code.gs'), 'utf8'), c);
    c.ScriptApp = { getOAuthToken: () => 'ISOLATED_TOKEN' };
    for (const [code, body] of [[403, {}], [200, { valueRanges: [] }], [200, { valueRanges: Array(16).fill({ values: [['WRONG_HEADER']] }) }]]) {
      c.UrlFetchApp = { fetch: () => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(body) }) };
      assert.throws(() => c.readFreshStateTables_({ spreadsheetId: 'ISOLATED' }), /SYNC_NOT_CONFIRMED/);
    }
  });
  await test('deletion compares the authoritative revision and reads back fresh confirmed data', () => {
    const c = context();
    const result = c.handleDeleteStage_({ auditUser: 'U01', stageId: 'S02', stateRevision: 5 });
    assert.equal(c.loadCalls[0].fresh, true);
    assert.equal(c.loadCalls.at(-1).fresh, true);
    assert.equal(result.deletedStage.Stage_ID, 'S02');
    assert.equal(result.recycleBinItem.Entity_ID, 'S02');
    assert.equal(c.db.Config_Stages.some(s => s.Stage_ID === 'S02'), false);
    assert.equal(c.db.Recycle_Bin.length, 1);
    assert.equal(c.db.Config_Stages[0].Is_Active, true);
  });
  await test('stale confirmation, wrong role and protected stages still cannot delete', () => {
    const c = context(), before = clone(c.db);
    assert.throws(() => c.handleDeleteStage_({ auditUser: 'U01', stageId: 'S02', stateRevision: 4 }), /STATE_CONFLICT/);
    c.requireSessionUser_ = () => { throw new Error('FORBIDDEN'); };
    assert.throws(() => c.handleDeleteStage_({ stageId: 'S02', stateRevision: 5 }), /FORBIDDEN/);
    c.requireSessionUser_ = () => c.db.Users[0];
    assert.throws(() => c.handleDeleteStage_({ stageId: 'S01', stateRevision: 5 }), /FORBIDDEN/);
    assert.deepEqual(c.db, before);
    c.db.Config_Stages = [c.db.Config_Stages[1]];
    assert.throws(() => c.handleDeleteStage_({ stageId: 'S02', stateRevision: 5 }), /至少要保留/);
  });
}

async function browserChecks() {
  const c = context(); let mode = '', requests = [], freshRequests = 0, deleteRequests = 0, releaseFresh;
  const payload = snapshot => ({ state: clone(snapshot), currentUser: clone(snapshot.Users[0]), stateRevision: snapshot.Meta.State_Revision, release: c.APP_RELEASE });
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html;charset=utf-8'); res.end(fs.readFileSync(path.join(root, 'index.html'))); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const browserContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', timezoneId: 'Asia/Taipei' });
    await browserContext.route(/https:\/\/script\.(google|googleusercontent)\.com\//, async route => {
      const request = route.request();
      const p = request.method() === 'POST' ? JSON.parse(request.postData()) : Object.fromEntries(new URL(request.url()).searchParams);
      requests.push({ ...p, method: request.method() });
      let result;
      try {
        if (p.action === 'getRegistrationOptions') result = { registrationOptions: { leader: true, member: true, activation: true, shapePrint: true }, registrationOptionsRevision: 0 };
        else if (p.action === 'bootstrap' && p.fresh) {
          freshRequests++;
          if (mode === 'expired') throw new Error('AUTH_EXPIRED: isolated expired session');
          if (mode === 'delay') await new Promise(resolve => { releaseFresh = resolve; });
          if (mode === 'unrelated') { c.db.Config_Stages[0].Budget_Allocated++; c.db.Meta.State_Revision++; mode = ''; }
          if (mode === 'related') { c.db.Assignments[0].Body = 'Changed fixture instructions'; c.db.Meta.State_Revision++; mode = ''; }
          if (mode === 'removed') { c.db.Config_Stages = c.db.Config_Stages.filter(s => s.Stage_ID !== 'S02'); c.db.Meta.State_Revision++; }
          if (mode === 'active') { c.db.Config_Stages.forEach(s => s.Is_Active = s.Stage_ID === 'S02'); c.db.Meta.State_Revision++; }
          result = payload(c.db);
          if (mode === 'stale') result.stateRevision--;
        } else if (p.action === 'deleteStage') {
          deleteRequests++;
          if (mode === 'conflict') { c.db.Meta.State_Revision++; mode = ''; }
          result = c.handleDeleteStage_({ ...p, auditUser: 'U01' });
          if (mode === 'timeout') throw new Error('REQUEST_TIMEOUT: isolated timeout after commit');
        } else result = { ...payload(seed()), currentUser: null };
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: result }) });
      } catch (error) { await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, error: { message: error.message } }) }); }
    });
    const page = await browserContext.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
    const reset = async () => {
      c.db = clone(seed()); c.stale = clone(c.db); requests = []; freshRequests = 0; deleteRequests = 0; mode = '';
      await page.evaluate(data => {
        authEpoch++; cancelQueuedRemoteStateSync(); remoteMutationInFlight = false; stageDeleteInFlight = false;
        pendingStageDeleteContext = null; document.getElementById('stage-delete-modal').classList.add('hidden');
        document.getElementById('session-expired-modal').classList.add('hidden');
        state = data; normalizeStateSchema(); currentUser = state.Users[0]; authSessionToken = 'ISOLATED_MANAGER'; expiredSessionToken = '';
        remoteStateRevision = data.Meta.State_Revision; gasConnectionStatus = 'remote'; activeWorkspace = 'admin'; activeTab = 'settings';
        remoteSaveInFlight = false; remoteSavePromise = null; pendingRemoteSave = false; workspaceHydrationInFlight = false;
        setSaveFeedback('idle', ''); renderAll(); window.__toasts = [];
        window.__originalToast ||= showToast;
        showToast = (message, type) => window.__toasts.push({ message, type });
        openStageDeleteModal('S02');
      }, seed());
    };
    const confirm = async () => { await page.evaluate(() => confirmStageDelete()); };
    await test('unrelated cloud updates do not create a repeated deletion conflict', async () => {
      await reset(); mode = 'unrelated'; await confirm();
      assert.equal(deleteRequests, 1); assert.equal(freshRequests, 1);
      assert.equal(c.db.Recycle_Bin.length, 1);
      assert.equal(c.db.Config_Stages[0].Budget_Allocated, 1001);
      assert.ok(requests.find(p => p.action === 'bootstrap' && p.fresh && p.method === 'POST'));
      assert.equal(await page.evaluate(() => state.Config_Stages.some(s => s.Stage_ID === 'S02')), false);
    });
    await test('changed target content requires a new explicit confirmation even with unchanged counts', async () => {
      await reset(); mode = 'related'; await confirm();
      assert.equal(deleteRequests, 0);
      assert.match(await page.locator('#stage-delete-modal-feedback').innerText(), /再次確認/);
      assert.match(await page.locator('#stage-delete-modal-confirm').innerText(), /再次確認/);
      await confirm(); assert.equal(deleteRequests, 1); assert.equal(c.db.Recycle_Bin.length, 1);
    });
    await test('a race after preflight refreshes the dialog but never automatically retries deletion', async () => {
      await reset(); mode = 'conflict'; await confirm();
      assert.equal(deleteRequests, 1); assert.equal(c.db.Recycle_Bin.length, 0);
      assert.match(await page.locator('#stage-delete-modal-feedback').innerText(), /不會自動/);
      await confirm(); assert.equal(deleteRequests, 2); assert.equal(c.db.Recycle_Bin.length, 1);
    });
    await test('rejected stale refresh does not claim the newest state was applied', async () => {
      await reset(); mode = 'stale'; await confirm();
      assert.equal(deleteRequests, 0);
      assert.match(await page.locator('#stage-delete-modal-feedback').innerText(), /尚未取得/);
      assert.equal(await page.evaluate(() => remoteStateRevision), 5);
    });
    await test('unconfirmed local edits block deletion without discarding them', async () => {
      await reset(); await page.evaluate(() => { state.Config_Stages[0].Budget_Allocated = 1234; setSaveFeedback('error', 'Fixture unsaved'); });
      await confirm(); assert.equal(deleteRequests, 0); assert.equal(freshRequests, 0);
      assert.equal(await page.evaluate(() => state.Config_Stages[0].Budget_Allocated), 1234);
    });
    await test('another mutation or disconnected session blocks deletion without a local fallback', async () => {
      await reset(); await page.evaluate(() => { remoteMutationInFlight = true; }); await confirm();
      assert.equal(freshRequests, 0); assert.equal(deleteRequests, 0);
      await reset(); await page.evaluate(() => { gasConnectionStatus = 'fallback'; }); await confirm();
      assert.equal(freshRequests, 0); assert.equal(deleteRequests, 0);
      assert.equal(await page.evaluate(() => state.Config_Stages.length), 2);
    });
    await test('expired session opens re-login confirmation without replaying deletion', async () => {
      await reset(); mode = 'expired'; await confirm();
      assert.equal(deleteRequests, 0);
      assert.equal(await page.locator('#session-expired-modal').isVisible(), true);
      assert.equal(await page.evaluate(() => stageDeleteInFlight), false);
    });
    await test('generated record timestamps alone do not cause a confirmation loop', async () => {
      await reset();
      const fingerprints = await page.evaluate(() => {
        const before = getStageDeleteContext('S02').fingerprint;
        state.Assignment_Resources[0].Created_At = '2026-10-17 17:00';
        state.Assignment_Resources[0].Updated_At = '2026-10-17 17:01';
        return { before, after: getStageDeleteContext('S02').fingerprint };
      });
      assert.equal(fingerprints.before, fingerprints.after);
    });
    await test('edits made while checking cloud state remain retained and block deletion', async () => {
      await reset(); mode = 'delay';
      const pending = confirm();
      await page.waitForFunction(() => stageDeleteInFlight);
      await page.evaluate(() => { state.Config_Stages[0].Budget_Allocated = 4321; });
      while (!releaseFresh) await new Promise(resolve => setTimeout(resolve, 5));
      releaseFresh(); releaseFresh = null; await pending;
      assert.equal(deleteRequests, 0);
      assert.equal(await page.evaluate(() => state.Config_Stages[0].Budget_Allocated), 4321);
      assert.match(await page.locator('#stage-delete-modal-feedback').innerText(), /修改已保留/);
    });
    await test('double click while checking sends only one delete request', async () => {
      await reset(); mode = 'delay'; const pending = confirm();
      await page.waitForFunction(() => stageDeleteInFlight);
      await page.evaluate(() => confirmStageDelete());
      while (!releaseFresh) await new Promise(resolve => setTimeout(resolve, 5));
      releaseFresh(); releaseFresh = null; mode = ''; await pending;
      assert.equal(freshRequests, 1); assert.equal(deleteRequests, 1); assert.equal(c.db.Recycle_Bin.length, 1);
    });
    await test('already removed or newly active stages are not deleted', async () => {
      for (const scenario of ['removed', 'active']) {
        await reset(); mode = scenario; await confirm();
        assert.equal(deleteRequests, 0); assert.equal(c.db.Recycle_Bin.length, 0);
        assert.equal(await page.locator('#stage-delete-modal').isVisible(), false);
      }
    });
    await test('timeout after a committed delete is recovered without a second delete', async () => {
      await reset(); mode = 'timeout'; await confirm();
      assert.equal(deleteRequests, 1); assert.equal(c.db.Recycle_Bin.length, 1);
      assert.match(await page.locator('#stage-delete-modal-feedback').innerText(), /結果還不能確認/);
      mode = ''; await confirm();
      assert.equal(deleteRequests, 1); assert.equal(c.db.Recycle_Bin.length, 1);
    });
    await test('impact list includes resources, calendar, work, service orders and stage discussion', async () => {
      await reset();
      const text = await page.locator('#stage-delete-modal-impact').innerText();
      for (const label of ['項目附件', '行事曆事件', '工作事項', '代做案件', '相關通知', '留言註解']) assert.ok(text.includes(label), label);
      assert.match(await page.locator('#stage-delete-modal-message').innerText(), /30 天內復原/);
    });
    await test('mobile impact list scrolls while confirmation actions remain reachable', async () => {
      await reset(); await page.setViewportSize({ width: 390, height: 500 });
      const size = await page.locator('#stage-delete-modal-confirm').boundingBox();
      assert.ok(size.y >= 0 && size.y + size.height <= 500);
      const body = await page.locator('#stage-delete-modal [role="dialog"] > div').first().evaluate(el => ({ scroll: el.scrollHeight, client: el.clientHeight }));
      assert.ok(body.scroll > body.client);
      if (process.env.STAGE_DELETE_SCREENSHOT_PATH) await page.screenshot({ path: process.env.STAGE_DELETE_SCREENSHOT_PATH });
    });
    await test('toast messages stay inside the dialog and cannot cover mobile confirmation', async () => {
      await page.evaluate(() => window.__originalToast('Isolated connection notice', 'warning'));
      assert.match(await page.locator('#stage-delete-modal-feedback').innerText(), /Isolated connection/);
      assert.equal(await page.locator('#toast-notif').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
      assert.equal(await page.locator('#stage-delete-modal-confirm').evaluate(el => {
        const rect = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      }), true);
    });
    await test('no uncaught browser errors in the stage deletion flow', () => { assert.deepEqual(errors, []); });
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}

(async () => {
  await logic(); await browserChecks();
  const report = { createdAt: new Date().toISOString(), passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results };
  if (process.env.STAGE_DELETE_REPORT_PATH) fs.writeFileSync(process.env.STAGE_DELETE_REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
  if (report.failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
