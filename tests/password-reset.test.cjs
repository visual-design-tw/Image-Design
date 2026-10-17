const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { backend } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const results = [];
const clone = value => JSON.parse(JSON.stringify(value));

async function test(name, run) {
  try {
    await run();
    results.push({ name, passed: true });
    console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, passed: false, error: error.stack });
    console.error('FAIL ' + name + '\n' + error.stack);
  }
}

function resetBackend() {
  const c = backend();
  c.getConfig_ = () => ({ frontendBaseUrl: 'https://example.invalid/', passwordResetExpiryMinutes: 30 });
  c.Logger = { log() {} };
  c.formatDateTime_ = value => new Date(value).toISOString();
  c.generateResetToken_ = () => 'ISOLATED_RESET_SECRET';
  c.hashResetToken_ = () => 'ISOLATED_HASH';
  c.tokens = [];
  c.loadPasswordResetTokens_ = () => clone(c.tokens);
  c.persistPasswordResetTokens_ = records => { c.tokens = clone(records); };
  return c;
}

function resetFrontend() {
  const elements = Object.fromEntries(['reset-request-email', 'reset-request-feedback'].map(id => [id, {
    value: id.endsWith('email') ? 'b@example.invalid' : '', textContent: '',
    classList: { add() {}, remove() {} }
  }]));
  const button = { disabled: false };
  const c = vm.createContext({
    console: { error() {} }, passwordResetRequestInFlight: false,
    document: { getElementById: id => elements[id], querySelector: () => button },
    isRemoteSyncEnabled: () => true,
    showToast: message => { c.toast = message; },
    setMorphActionButtonState: (target, icon, status, label, options) => { target.disabled = options.disabled; },
    returnToLoginFromReset: email => { c.loginEmail = email; }
  });
  const start = source.indexOf('        async function handleRequestPasswordReset(e)');
  const end = source.indexOf('        async function handleResetPassword(e)', start);
  vm.runInContext(source.slice(start, end), c);
  return { c, elements, button, submit: () => c.handleRequestPasswordReset({ preventDefault() {}, submitter: button }) };
}

async function main() {
  await test('manifest explicitly enables Sheets v4 without expanding OAuth scopes', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'gas/appsscript.json'), 'utf8'));
    assert.ok(manifest.dependencies.enabledAdvancedServices.some(s => s.serviceId === 'sheets' && s.version === 'v4'));
    assert.deepEqual(manifest.oauthScopes, [
      'https://www.googleapis.com/auth/script.external_request', 'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/script.send_mail',
      'https://www.googleapis.com/auth/script.scriptapp'
    ]);
  });

  for (const [name, code, body, expected] of [
    ['disabled API', 403, { status: 'PERMISSION_DENIED', details: [{ reason: 'SERVICE_DISABLED' }] }, 'SAVE_SETUP_REQUIRED'],
    ['legacy disabled API', 403, { errors: [{ reason: 'accessNotConfigured' }] }, 'SAVE_SETUP_REQUIRED'],
    ['missing permissions', 403, { status: 'PERMISSION_DENIED' }, 'SAVE_PERMISSION_DENIED'],
    ['expired authorization', 401, { status: 'UNAUTHENTICATED' }, 'SAVE_PERMISSION_DENIED'],
    ['quota limit', 429, { status: 'RESOURCE_EXHAUSTED' }, 'SAVE_RATE_LIMITED'],
    ['server failure', 503, { status: 'UNAVAILABLE' }, 'SAVE_NOT_CONFIRMED'],
    ['invalid batch', 400, { status: 'INVALID_ARGUMENT' }, 'SAVE_NOT_CONFIRMED']
  ]) {
    await test('storage failure classifies ' + name + ' without logging secrets', () => {
      const c = resetBackend(), logs = [];
      c.Logger.log = line => logs.push(line);
      const response = { getResponseCode: () => code, getContentText: () => JSON.stringify({ error: { ...body, message: 'PRIVATE_RESET_SECRET' } }) };
      assert.ok(c.buildSheetsSaveError_(response).message.startsWith(expected + ':'));
      assert.ok(!JSON.stringify(logs).includes('PRIVATE_RESET_SECRET'));
    });
  }

  await test('unreadable storage response stays a failed save, never a fallback write', () => {
    const c = resetBackend();
    assert.match(c.buildSheetsSaveError_({ getResponseCode: () => 500, getContentText: () => '<html>Unavailable</html>' }).message, /^SAVE_NOT_CONFIRMED:/);
    assert.match(c.buildSheetsSaveError_({ getResponseCode: () => 400 }).message, /^SAVE_NOT_CONFIRMED:/);
  });

  await test('token persistence failure prevents email and preserves existing token and password', () => {
    const c = resetBackend();
    c.tokens = [{ Reset_ID: 'PR_OLD', User_ID: 'U03', Status: 'active', Token_Hash: 'OLD_HASH', Expires_At_Millis: Date.now() + 60000 }];
    const before = clone(c.tokens), usersBefore = clone(c.db.Users);
    let mails = 0;
    c.persistPasswordResetTokens_ = () => { throw new Error('SAVE_SETUP_REQUIRED: setup'); };
    c.sendPasswordResetEmail_ = () => { mails += 1; };
    assert.throws(() => c.handleRequestPasswordReset_({ email: 'b@example.invalid' }), /SAVE_SETUP_REQUIRED/);
    assert.equal(mails, 0);
    assert.deepEqual(c.tokens, before);
    assert.deepEqual(c.db.Users, usersBefore);
  });

  await test('confirmed token save precedes exactly one reset email', () => {
    const c = resetBackend(), events = [];
    c.persistPasswordResetTokens_ = records => { events.push('save'); c.tokens = clone(records); };
    c.sendPasswordResetEmail_ = (user, url) => {
      events.push('mail'); assert.equal(c.tokens[0].Token_Hash, 'ISOLATED_HASH');
      assert.ok(url.startsWith('https://example.invalid/')); assert.equal(user.Email, 'b@example.invalid');
    };
    const response = c.handleRequestPasswordReset_({ email: 'b@example.invalid' });
    assert.deepEqual(events, ['save', 'mail']);
    assert.ok(!JSON.stringify(c.tokens).includes('ISOLATED_RESET_SECRET'));
    assert.ok(!JSON.stringify(response).includes('ISOLATED_RESET_SECRET'));
  });

  await test('unknown and pending accounts reveal no account existence and send no email', () => {
    const c = resetBackend();
    c.persistPasswordResetTokens_ = () => { throw new Error('Should not persist'); };
    c.sendPasswordResetEmail_ = () => { throw new Error('Should not send'); };
    const unknown = c.handleRequestPasswordReset_({ email: 'unknown@example.invalid' });
    c.db.Users[2].Status = 'Pending';
    assert.equal(c.handleRequestPasswordReset_({ email: 'b@example.invalid' }).message, unknown.message);
  });

  await test('repeated submissions while waiting create only one request', async () => {
    const { c, elements, button, submit } = resetFrontend();
    let rejectRequest, calls = 0;
    c.requestGas = () => { calls += 1; return new Promise((resolve, reject) => { rejectRequest = reject; }); };
    const pending = submit();
    assert.equal(button.disabled, true);
    await submit(); assert.equal(calls, 1);
    rejectRequest(new Error('SAVE_SETUP_REQUIRED: setup'));
    await pending;
    assert.equal(elements['reset-request-email'].value, 'b@example.invalid');
    assert.match(elements['reset-request-feedback'].textContent, /沒有寄出/);
    assert.ok(!c.toast.includes('SAVE_'));
    assert.equal(button.disabled, false); assert.equal(c.passwordResetRequestInFlight, false);
  });

  await test('timeout preserves email and tells users delivery is unconfirmed', async () => {
    const { c, elements, submit } = resetFrontend();
    c.requestGas = async () => { throw new Error('REQUEST_TIMEOUT: timeout'); };
    await submit();
    assert.match(elements['reset-request-feedback'].textContent, /尚未確認是否寄出/);
    assert.match(c.toast, /垃圾郵件/);
    assert.equal(elements['reset-request-email'].value, 'b@example.invalid');
  });

  await test('confirmed response returns to login with email prefilled', async () => {
    const { c, elements, submit } = resetFrontend();
    c.requestGas = async () => ({ data: { message: 'Generic confirmation' } });
    await submit();
    assert.equal(c.loginEmail, 'b@example.invalid');
    assert.equal(elements['reset-request-email'].value, '');
    assert.equal(c.toast, 'Generic confirmation');
  });

  await test('reset request and preview remain public with stale sessions or unsaved workspace', async () => {
    const c = vm.createContext({
      state: {}, expiredSessionToken: 'OLD_SESSION', authSessionToken: 'OLD_SESSION', authEpoch: 3,
      currentUser: null, remoteSaveTimer: true, pendingRemoteSave: true, remoteSaveInFlight: false,
      saveFeedbackState: 'error', cloneStateSnapshot: clone, getGasApiUrl: () => 'https://example.invalid',
      AbortController, setTimeout, clearTimeout,
      showSessionExpiredNotice: () => { throw new Error('Public reset must not require login'); },
      fetch: async () => ({ ok: true, text: async () => JSON.stringify({ ok: true, data: { message: 'OK' } }) })
    });
    const start = source.indexOf('        async function requestGas(action,');
    const end = source.indexOf('        async function bootstrapRemoteState(', start);
    vm.runInContext(source.slice(start, end), c);
    for (const action of ['requestPasswordReset', 'previewPasswordReset']) {
      assert.equal((await c.requestGas(action, {})).ok, true);
    }
    await assert.rejects(() => c.requestGas('deleteAssignment', {}), /Public reset must not require login/);
  });

  const report = { createdAt: new Date().toISOString(), passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results };
  if (process.env.PASSWORD_RESET_REPORT_PATH) fs.writeFileSync(process.env.PASSWORD_RESET_REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
  if (report.failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
