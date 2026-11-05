const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { fixture } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const keys = ['leader', 'member', 'activation', 'shapePrint'];
const allOpen = Object.fromEntries(keys.map(key => [key, true]));
const allClosed = Object.fromEntries(keys.map(key => [key, false]));
const checks = [];
function pass(name) { checks.push(name); console.log('PASS ' + name); }
function backendContext() {
  const c = vm.createContext({ console, Utilities: { getUuid: () => crypto.randomUUID() } });
  vm.runInContext(fs.readFileSync(path.join(root, 'gas/Code.gs'), 'utf8'), c);
  c.nowString_ = () => '2026-10-17 10:00';
  c.getConfig_ = () => ({ spreadsheetId: 'MOCK', timeZone: 'Asia/Taipei' });
  c.db = c.normalizeState_(fixture());
  c.db.Users.push({ ...c.db.Users[0], User_ID: 'TEACHER', Email: 'teacher@example.invalid', Name: 'Test teacher' });
  c.fullReads = 0;
  c.loadState_ = () => { c.fullReads++; return clone(c.db); };
  c.persistState_ = (state, options = {}) => {
    const next = c.mergeSensitiveState_(c.normalizeState_(clone(state)), options.existingState || c.db, options);
    next.Meta = c.coerceValue_(c.serializeValue_(next.Meta, 'json'), 'json');
    next.Meta.State_Revision = options.nextRevision || c.db.Meta.State_Revision + 1;
    c.db = c.normalizeState_(clone(next));
  };
  c.SpreadsheetApp = { openById: id => { assert.equal(id, 'MOCK'); return {}; } };
  c.readMetaSheet_ = () => clone(c.db.Meta);
  c.requireSessionUser_ = (state, payload, roles) => {
    const id = payload.auditUser || String(payload.sessionToken || '').replace('TEST-', '');
    const user = state.Users.find(item => item.User_ID === id);
    if (!user || user.Status !== 'Active') throw new Error('AUTH_EXPIRED');
    if (roles && !roles.includes(user.Role)) throw new Error('FORBIDDEN');
    return user;
  };
  c.lockCalls = 0;
  c.withLock_ = fn => { c.lockCalls++; return fn(); };
  c.jsonResponse_ = (ok, data, error) => ({ ok, data, error: error ? { message: error.message } : undefined });
  c.appendActivityLogEntries_ = () => {};
  c.buildHeatmapStats_ = () => ({});
  c.hashPassword_ = () => 'TEST-HASH';
  c.verifyPassword_ = () => true;
  c.issueSession_ = user => ({ token: 'TEST-' + user.User_ID, expiresAt: '2026-10-18 10:00' });
  const cache = new Map();
  c.CacheService = { getScriptCache: () => ({ get: key => cache.get(key), put: (key, value) => cache.set(key, value), remove: key => cache.delete(key) }) };
  c.hashSessionToken_ = value => crypto.createHash('sha256').update(value).digest('hex');
  c.loadLoginUser_ = email => clone(c.db.Users.find(user => user.Email === email));
  c.isPasswordHash_ = () => true;
  return c;
}
function dispatch(c, payload) { return c.doPost({ postData: { contents: JSON.stringify(payload) } }); }
function update(c, options, id = 'U01', revision = c.getRegistrationOptionsRevision_(c.db)) {
  return c.handleUpdateRegistrationOptions_({ auditUser: id, registrationOptions: options, registrationOptionsRevision: revision });
}
function backendChecks() {
  const c = backendContext();
  const reads = c.fullReads;
  for (const response of [c.doGet({ parameter: { action: 'getRegistrationOptions' } }), dispatch(c, { action: 'getRegistrationOptions' })]) {
    assert.equal(response.ok, true);
    assert.deepEqual(clone(response.data.registrationOptions), allOpen);
    assert.deepEqual(Object.keys(response.data).sort(), ['registrationOptions', 'registrationOptionsRevision', 'release']);
    assert.ok(!JSON.stringify(response).includes('example.invalid'));
  }
  assert.equal(c.fullReads, reads);
  pass('public GET and POST return only four flags and revision without loading private workbook data');
  const initial = clone(c.db);
  const desired = { ...allOpen, leader: false, activation: false };
  const response = dispatch(c, { action: 'updateRegistrationOptions', sessionToken: 'TEST-U01', registrationOptions: desired, registrationOptionsRevision: 0 });
  assert.equal(response.ok, true, JSON.stringify(response));
  assert.deepEqual(clone(response.data.registrationOptions), desired);
  assert.equal(response.data.registrationOptionsRevision, 1);
  assert.equal(c.db.Meta.State_Revision, 2);
  assert.equal(c.lockCalls, 1);
  for (const key of ['Users', 'Teams', 'Assignments', 'Assignment_Submissions', 'Assignment_Resources']) assert.deepEqual(c.db[key], initial[key]);
  assert.deepEqual(clone(c.handleGetRegistrationOptions_().registrationOptions), desired);
  pass('manager settings commit together, survive JSON storage and are visible to another device');
  for (const id of ['U02', 'U03', 'U04', 'EXPIRED']) {
    const before = clone(c.db);
    assert.throws(() => update(c, allClosed, id), /FORBIDDEN|AUTH_EXPIRED/);
    assert.equal(JSON.stringify(c.db), JSON.stringify(before));
  }
  update(c, allClosed, 'TEACHER');
  pass('only shape-print leader and teacher roles can save; staff members, students and expired sessions cannot');
  const before = clone(c.db);
  for (const options of [null, [], { leader: true }, { ...allOpen, member: 'false' }, { ...allOpen, extra: true }]) {
    assert.throws(() => update(c, options), /四種/);
    assert.equal(JSON.stringify(c.db), JSON.stringify(before));
  }
  for (const revision of [undefined, null, -1, '2', 0.5]) {
    assert.throws(() => c.handleUpdateRegistrationOptions_({ auditUser: 'U01', registrationOptions: allOpen, registrationOptionsRevision: revision }), /SETTINGS_CONFLICT/);
  }
  assert.throws(() => update(c, allOpen, 'U01', 0), /SETTINGS_CONFLICT/);
  const revision = c.db.Meta.State_Revision;
  update(c, allClosed, 'U01', 0);
  assert.equal(c.db.Meta.State_Revision, revision);
  pass('malformed settings and conflicting edits are rejected; retrying an already-saved choice is idempotent');
  const oldClient = clone(c.db);
  oldClient.Meta = { State_Revision: c.db.Meta.State_Revision, Registration_Options: allOpen, Registration_Options_Revision: 100 };
  c.handleSaveState_({ auditUser: 'U01', state: oldClient, stateRevision: c.db.Meta.State_Revision });
  assert.deepEqual(clone(c.getRegistrationOptions_(c.db)), allClosed);
  update(c, { ...allClosed, leader: true });
  assert.equal(c.db.Meta.Registration_Options.leader, true);
  pass('old client saveState cannot overwrite settings and unrelated workbook edits do not create settings conflicts');
  update(c, allClosed);
  const actions = [
    ['registerLeader', { teamName: 'New test team', name: 'Test leader', email: 'newleader@example.invalid', password: 'test-password' }],
    ['registerMember', { inviteCode: 'AUDIT-B', name: 'Test member', email: 'newmember@example.invalid', password: 'test-password' }],
    ['activatePending', { name: 'Test pending', email: 'pending@example.invalid', password: 'test-password' }],
    ['registerShapePrintMember', { token: 'TEST-INVITE', name: 'Test shape print', email: 'shape@example.invalid', password: 'test-password' }]
  ];
  c.loadShapePrintInvites_ = () => { throw new Error('closed invite must not be read or consumed'); };
  for (const [action, payload] of actions) {
    const before = clone(c.db);
    const result = dispatch(c, { action, ...payload });
    assert.equal(result.ok, false);
    assert.match(result.error.message, /REGISTRATION_CLOSED/);
    assert.equal(JSON.stringify(c.db), JSON.stringify(before));
  }
  pass('all four closed registration actions reject direct requests before account, team or invitation changes');
  update(c, allOpen);
  c.db.Users.push({ User_ID: 'PENDING', Name: 'Pending', Email: 'pending@example.invalid', Password: '', Team_ID: 'T02', Role: 'Member', Status: 'Pending' });
  const invite = { Invite_ID: 'INV_TEST', Invitee_Email: 'shape@example.invalid', Status: 'active', Created_At: '2026-10-17 10:00', Expires_At: '2026-10-18 10:00' };
  c.loadShapePrintInvites_ = () => [invite]; c.cleanupShapePrintInvites_ = () => false;
  c.getActiveShapePrintInvite_ = () => invite; c.persistShapePrintInvites_ = () => {};
  for (const [action, payload] of actions) {
    const result = dispatch(c, { action, ...payload });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.ok(result.data.currentUser.User_ID);
  }
  update(c, allClosed);
  const login = c.handleLogin_({ email: 'newleader@example.invalid', password: 'test-password' });
  assert.ok(login.currentUser.User_ID);
  pass('reopening restores all four real registration handlers and existing users can still log in when all entries close');
}

async function browserChecks() {
  const c = backendContext();
  let failPublic = false, failSave = false, saveDelay = 0;
  const requests = [];
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(root, 'index.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const errors = [];
  try {
    const makeContext = async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Taipei', reducedMotion: 'reduce' });
      await context.route(/https:\/\/script\.(google|googleusercontent)\.com\//, async route => {
        const req = route.request();
        const payload = req.method() === 'POST' ? JSON.parse(req.postData()) : Object.fromEntries(new URL(req.url()).searchParams);
        requests.push(payload);
        if (payload.action === 'updateRegistrationOptions' && saveDelay) await new Promise(resolve => setTimeout(resolve, saveDelay));
        let response;
        if ((payload.action === 'getRegistrationOptions' && failPublic) || (payload.action === 'updateRegistrationOptions' && failSave)) {
          response = { ok: false, error: { message: '測試連線暫時中斷，尚未儲存。' } };
        } else if (['getRegistrationOptions', 'updateRegistrationOptions', 'registerMember'].includes(payload.action)) response = dispatch(c, payload);
        else if (payload.action === 'listShapePrintInvites') response = { ok: true, data: { invites: [] } };
        else response = { ok: true, data: { state: fixture(), currentUser: null } };
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
      });
      const page = await context.newPage(); page.setDefaultTimeout(8000);
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
      return page;
    };
    failPublic = true;
    const guest = await makeContext();
    await guest.evaluate(() => openAuthView('register'));
    await guest.waitForFunction(() => registrationOptionsStatus === 'error');
    assert.equal(await guest.locator('#registration-option-tabs button:visible').count(), 0);
    assert.equal(await guest.locator('#form-register form:visible').count(), 0);
    assert.ok((await guest.locator('#registration-options-message').textContent()).includes('無法確認'));
    assert.equal(await guest.locator('#btn-login-submit').isDisabled(), false);
    failPublic = false;
    await guest.locator('#registration-options-retry').click();
    await guest.waitForFunction(() => registrationOptionsStatus === 'ready');
    assert.equal(await guest.locator('#registration-option-tabs button:visible').count(), 4);
    pass('unknown policy never flashes open forms; failed background loading keeps login usable and explicit retry recovers');
    const manager = await makeContext();
    const seedManager = async (id = 'U01') => {
      await manager.evaluate(({ data, id }) => {
        authEpoch++; cancelQueuedRemoteStateSync(); state = data; normalizeStateSchema();
        currentUser = state.Users.find(item => item.User_ID === id); authSessionToken = 'TEST-' + id;
        activeWorkspace = 'admin'; activeTab = 'teams'; gasConnectionStatus = 'remote';
        remoteMutationInFlight = false; pendingRemoteSave = false; remoteSaveInFlight = false; remoteSavePromise = null;
        workspaceHydrationInFlight = false; remoteStateRevision = state.Meta.State_Revision;
        shapePrintInviteListStatus = 'loaded'; registrationOptionsDraft = null; registrationOptionsSaveMessage = '';
        captureRegistrationOptions({ registrationOptions: state.Meta.Registration_Options || { leader: true, member: true, activation: true, shapePrint: true }, registrationOptionsRevision: state.Meta.Registration_Options_Revision || 0 });
        setSaveFeedback('idle', ''); renderAll();
      }, { data: clone(c.db), id });
    };
    await seedManager();
    assert.equal(await manager.locator('#registration-settings-form input[role="switch"]').count(), 4);
    failPublic = true;
    await manager.getByRole('button', { name: '重新載入設定', exact: true }).click();
    await manager.waitForFunction(() => registrationOptionsRefreshFailed);
    assert.ok((await manager.locator('#registration-settings-feedback').textContent()).includes('無法確認最新'));
    failPublic = false;
    await manager.getByRole('button', { name: '重新載入設定', exact: true }).click();
    await manager.waitForFunction(() => !registrationOptionsRefreshFailed);
    pass('failed refresh labels cached settings clearly and retry obtains current choices');
    await manager.getByRole('switch', { name: '顯示組長建組', exact: true }).uncheck();
    await manager.getByRole('switch', { name: '顯示信箱開通', exact: true }).uncheck();
    await manager.locator('#registration-settings-save').click();
    await manager.waitForFunction(() => !registrationOptionsSaveInFlight && !registrationOptionsDraft);
    await guest.evaluate(() => { registrationOptionsLastFetchAt = 0; window.dispatchEvent(new Event('focus')); });
    await guest.waitForFunction(() => registrationOptions.leader === false && registrationOptions.activation === false);
    assert.deepEqual(await guest.locator('#registration-option-tabs button:visible').allTextContents(), ['組員註冊', '形印組加入']);
    assert.equal(await guest.locator('#form-sub-reg-code').isVisible(), true);
    assert.equal(await guest.locator('#topbar-register-activation').isVisible(), false);
    assert.equal(await guest.locator('#topbar-register-member').isVisible(), true);
    await guest.locator('#sub-tab-reg-code').press('ArrowRight');
    assert.equal(await guest.evaluate(() => activeRegisterSubTab), 'reg-shape-print');
    await guest.locator('#sub-tab-reg-shape-print').press('Home');
    assert.equal(await guest.evaluate(() => activeRegisterSubTab), 'reg-code');
    pass('independent switches synchronize to a second device, hide shortcuts and choose an open tab with keyboard support');
    await guest.locator('#reg-member-name').fill('保留的姓名');
    await guest.locator('#reg-member-email').fill('retain@example.invalid');
    await guest.evaluate(() => refreshRegistrationOptions({ force: true }));
    assert.equal(await guest.locator('#reg-member-name').inputValue(), '保留的姓名');
    assert.equal(await guest.locator('#reg-member-email').inputValue(), 'retain@example.invalid');
    pass('background policy refresh preserves typed registration details');

    failSave = true;
    await manager.getByRole('switch', { name: '顯示形印組加入', exact: true }).uncheck();
    const old = clone(c.db.Meta.Registration_Options);
    await manager.locator('#registration-settings-save').click();
    await manager.waitForFunction(() => !registrationOptionsSaveInFlight);
    assert.equal(await manager.getByRole('switch', { name: '顯示形印組加入', exact: true }).isChecked(), false);
    assert.ok((await manager.locator('#registration-settings-feedback').textContent()).includes('中斷'));
    assert.deepEqual(c.db.Meta.Registration_Options, old);
    failSave = false; saveDelay = 500;
    const beforeSaves = requests.filter(item => item.action === 'updateRegistrationOptions').length;
    await manager.locator('#registration-settings-save').click();
    await manager.waitForFunction(() => registrationOptionsSaveInFlight);
    assert.equal(await manager.getByRole('switch', { name: '顯示組員註冊', exact: true }).isDisabled(), true);
    await manager.evaluate(() => document.getElementById('registration-settings-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await manager.waitForFunction(() => !registrationOptionsSaveInFlight);
    assert.equal(requests.filter(item => item.action === 'updateRegistrationOptions').length - beforeSaves, 1);
    saveDelay = 0;
    pass('failed save retains choices; retry locks all switches and repeated submission creates one request');

    await manager.getByRole('switch', { name: '顯示組長建組', exact: true }).check();
    update(c, allOpen, 'TEACHER');
    await manager.locator('#registration-settings-save').click();
    await manager.waitForFunction(() => !registrationOptionsSaveInFlight);
    assert.ok((await manager.locator('#registration-settings-feedback').textContent()).includes('其他裝置'));
    assert.equal(await manager.getByRole('switch', { name: '顯示信箱開通', exact: true }).isChecked(), false);
    await manager.getByRole('button', { name: '重新載入設定', exact: true }).click();
    await manager.waitForFunction(() => !registrationOptionsDraft && registrationOptionsStatus === 'ready');
    assert.equal(await manager.getByRole('switch', { name: '顯示信箱開通', exact: true }).isChecked(), true);
    pass('conflicting teacher/leader edits preserve the draft until the manager reloads the latest settings');

    for (const key of keys) await manager.locator('#registration-settings-form input[name="' + key + '"]').uncheck();
    await manager.locator('#registration-settings-save').click();
    await manager.waitForFunction(() => !registrationOptionsSaveInFlight);
    await guest.evaluate(() => refreshRegistrationOptions({ force: true }));
    assert.equal(await guest.locator('#form-register form:visible').count(), 0);
    assert.equal(await guest.locator('#registration-option-tabs').isVisible(), false);
    assert.ok((await guest.locator('#registration-options-message').textContent()).includes('暫停'));
    await guest.evaluate(() => openAuthView('login'));
    assert.equal(await guest.locator('#form-login').isVisible(), true);
    assert.equal(await guest.locator('#btn-login-submit').isEnabled(), true);
    pass('all four entries can close together with a clear message while existing-account login remains available');
    await manager.screenshot({ path: '/tmp/registration-settings-desktop.png' });

    update(c, { ...allClosed, member: true });
    await guest.evaluate(async () => { await refreshRegistrationOptions({ force: true }); openAuthView('register', 'reg-code'); });
    await guest.locator('#reg-member-code').fill('AUDIT-B');
    await guest.locator('#reg-member-name').fill('Late registrant');
    await guest.locator('#reg-member-email').fill('late@example.invalid');
    await guest.locator('#reg-member-pwd').fill('test-password');
    update(c, allClosed);
    const count = c.db.Users.length;
    await guest.locator('#btn-register-member-submit').click();
    await guest.waitForFunction(() => !registerSubmitInFlight && registrationOptions.member === false);
    assert.equal(c.db.Users.length, count);
    assert.equal(await guest.evaluate(() => currentUser), null);
    assert.equal(await guest.locator('#reg-member-name').inputValue(), 'Late registrant');
    pass('a stale open form is rejected by the server after closure and refreshes without creating an account');

    for (const width of [1440, 390, 320]) {
      await guest.setViewportSize({ width, height: 900 });
      for (let mask = 0; mask < 16; mask++) {
        const options = Object.fromEntries(keys.map((key, index) => [key, Boolean(mask & (1 << index))]));
        update(c, options);
        await guest.evaluate(async () => { await refreshRegistrationOptions({ force: true }); openAuthView('register'); });
        const visibleCount = await guest.locator('#registration-option-tabs button:visible').count();
        assert.equal(visibleCount, keys.filter(key => options[key]).length);
        const geometry = await guest.locator('#form-register').evaluate(form => ({ scroll: form.scrollWidth, width: form.clientWidth, page: document.documentElement.scrollWidth, screen: innerWidth,
          contentBottom: document.querySelector('#auth-section > div').getBoundingClientRect().bottom,
          footerTop: document.querySelector('#auth-section > footer').getBoundingClientRect().top }));
        assert.ok(geometry.scroll <= geometry.width + 1 && geometry.page <= geometry.screen + 1, JSON.stringify({ width, mask, geometry }));
        assert.ok(geometry.footerTop >= geometry.contentBottom + 8, JSON.stringify({ width, mask, geometry }));
      }
    }
    await guest.screenshot({ path: '/tmp/registration-entries-mobile.png' });
    pass('all 16 availability combinations lay out without empty slots or horizontal overflow at desktop and mobile widths');
    await seedManager('TEACHER');
    assert.equal(await manager.locator('#registration-settings-form').isVisible(), true);
    for (const id of ['U04', 'U03']) {
      await seedManager(id);
      assert.equal(await manager.locator('#registration-settings-panel').count(), 0);
    }
    pass('teacher sees management controls while shape-print members and students do not');
    await guest.evaluate(async () => { authSessionToken = 'EXPIRED'; expiredSessionToken = 'EXPIRED'; await refreshRegistrationOptions({ force: true }); });
    assert.equal(await guest.evaluate(() => registrationOptionsStatus), 'ready');
    assert.ok(requests.filter(item => item.action === 'getRegistrationOptions').every(item => !item.sessionToken));
    assert.deepEqual(errors, []);
    pass('public policy refresh sends no session token, survives an expired session and produces no uncaught browser errors');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
async function main() {
  backendChecks();
  await browserChecks();
  const report = { scope: 'Local fixtures and mocked Google requests only; no production writes or real registrations', passed: checks.length, checks };
  if (process.env.REGISTRATION_REPORT_PATH) fs.writeFileSync(process.env.REGISTRATION_REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: checks.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
