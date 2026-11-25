const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { backend } = require('./stability.test.cjs');
const { createSiteServer } = require('./site-test-server.cjs');

const clone = value => JSON.parse(JSON.stringify(value));
const create = 'createShapePrintInvite';
const send = 'createAndSendShapePrintInvite';
const exampleEmail = 'layout@example.invalid';
const tokenFor = (n) => 'SYNTHETIC_INVITE_' + n;

function setup() {
  const c = backend();
  c.db.Users.push({ ...c.db.Users[0], User_ID: 'TEACHER', Email: 'teacher@example.invalid' });
  let locked = false;
  let generated = 0;
  let writes = 0;
  let attempts = 0;
  let invites = [];
  const mail = [];
  c.Logger = { log(message) { assert.match(message, /^SHAPE_PRINT_INVITE_[A-Z_]+$/); } };
  c.getConfig_ = () => ({ frontendBaseUrl: 'https://example.invalid/workspace/', mailReplyTo: 'team@example.invalid' });
  c.requireSessionUser_ = (state, payload, roles) => {
    const user = state.Users.find(u => payload.sessionToken === 'TOKEN_' + u.User_ID);
    if (!user || user.Status !== 'Active') throw new Error('AUTH_EXPIRED');
    if (!roles.includes(user.Role)) throw new Error('FORBIDDEN');
    return user;
  };
  c.withLock_ = fn => {
    assert.equal(locked, false);
    locked = true;
    try { return fn(); } finally { locked = false; }
  };
  c.formatDateTime_ = value => value.toISOString();
  c.generateShapePrintInviteToken_ = () => tokenFor(++generated);
  c.hashShapePrintInviteToken_ = value => 'hash:' + value;
  c.loadShapePrintInvites_ = () => clone(invites);
  c.persistShapePrintInvites_ = rows => {
    assert.equal(locked, true);
    if (c.failWrite) throw new Error('SAVE_NOT_CONFIRMED');
    invites = clone(rows);
    writes++;
  };
  c.appendActivityLogEntries_ = () => {
    if (c.failAudit) throw new Error('Audit unavailable');
  };
  c.MailApp = {
    sendEmail(to, subject, text, options) {
      assert.equal(locked, false);
      const stored = invites.find(invite => invite.Invitee_Email === to && invite.Status === 'active');
      assert.ok(stored && text.includes(stored.Token_Hash.slice('hash:'.length)));
      attempts++;
      if (c.failMail) throw new Error('Uncertain mail result');
      mail.push({ to, subject, text, html: options.htmlBody });
    }
  };
  c.jsonResponse_ = (ok, data, error) => ({ ok, data, error: error && { message: error.message } });
  const dispatch = payload => c.doPost({ postData: { contents: JSON.stringify(payload) } });
  const request = (action = send, params = {}) => dispatch({ action, sessionToken: 'TOKEN_U01', email: exampleEmail, name: 'Invited <b>member</b>', expiresInDays: 7, ...params });
  return { c, mail, request, dispatch, invites: () => clone(invites), writes: () => writes, attempts: () => attempts };
}

test('saves before sending one email to the bound address; active invitations block repeat sends', () => {
  const f = setup();
  const first = f.request(send, { email: ' Layout@EXAMPLE.invalid ' });
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.data.deliveryStatus, 'sent');
  assert.equal(new URL(first.data.inviteUrl).searchParams.get('shapePrintInvite'), tokenFor(1));
  assert.equal(f.mail.length, 1);
  assert.equal(f.mail[0].to, exampleEmail);
  assert.ok(f.mail[0].text.includes(first.data.inviteUrl));
  assert.match(f.mail[0].html, /Invited &lt;b&gt;member&lt;\/b&gt;/);
  assert.equal(f.invites()[0].Token_Hash, 'hash:' + tokenFor(1));
  assert.ok(!Object.values(f.invites()[0]).includes(tokenFor(1)));
  const retry = f.request(send, { sessionToken: 'TOKEN_TEACHER' });
  assert.match(retry.error.message, /INVITE_ALREADY_ACTIVE/);
  assert.equal(f.attempts(), 1);
  assert.equal(f.writes(), 1);
});

test('retains a usable copy link when email or audit is unavailable, without a duplicate send on retry', () => {
  const f = setup();
  f.c.failMail = true;
  f.c.failAudit = true;
  const result = f.request();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.data.deliveryStatus, 'unconfirmed');
  assert.equal(f.invites()[0].Status, 'active');
  assert.equal(f.c.getActiveShapePrintInvite_(f.invites(), new URL(result.data.inviteUrl).searchParams.get('shapePrintInvite')).Invite_ID, result.data.invite.inviteId);
  assert.equal(f.request().ok, false);
  assert.equal(f.attempts(), 1);
  assert.equal(f.writes(), 1);
});

test('manual mode never mails; unauthorized, malformed, closed or failed saves never reach mail', () => {
  const f = setup();
  for (const sessionToken of ['TOKEN_U02', 'TOKEN_U04', 'EXPIRED']) assert.equal(f.request(send, { sessionToken }).ok, false);
  for (const email of ['', exampleEmail + ',other@example.invalid', exampleEmail + '\r\nBcc: x@y.invalid', 'existing@invalid', 'manager@example.invalid']) {
    assert.equal(f.request(send, { email }).ok, false);
  }
  f.c.db.Meta.Registration_Options = { shapePrint: false };
  assert.match(f.request().error.message, /REGISTRATION_CLOSED/);
  f.c.db.Meta.Registration_Options.shapePrint = true;
  f.c.getConfig_ = () => ({ frontendBaseUrl: 'http://example.invalid/' });
  assert.match(f.request().error.message, /HTTPS/);
  f.c.getConfig_ = () => ({ frontendBaseUrl: 'https://example.invalid/' });
  f.c.failWrite = true;
  assert.match(f.request().error.message, /SAVE_NOT_CONFIRMED/);
  assert.equal(f.attempts(), 0);
  assert.equal(f.writes(), 0);
  f.c.failWrite = false;
  const manual = f.request(create, { sessionToken: 'TOKEN_TEACHER' });
  assert.ok(manual.ok && manual.data.inviteUrl);
  assert.equal(f.attempts(), 0);
  assert.equal(f.writes(), 1);
});

test('workbench shows pending, sent and manual fallback states without signing in or sending live mail', async () => {
  const f = setup();
  const html = fs.readFileSync(path.join(__dirname, '../index.html'));
  const server = createSiteServer((req, res) => res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    await page.route('https://**/*', async route => {
      const request = route.request();
      if (!/^https:\/\/script\.(google|googleusercontent)\.com\//.test(request.url())) return route.abort();
      const payload = request.postDataJSON();
      if ([create, send].includes(payload?.action)) {
        requests.push(payload.action);
        if (requests.length === 1) await pending;
        return route.fulfill({ json: f.dispatch(payload) });
      }
      const opts = { workspaceInternalOnly: true, workspaceModeRevision: 1, registrationOptionsRevision: 1, registrationOptions: { shapePrint: true, member: false, leader: false, activation: false }, invites: [] };
      return route.fulfill({ json: { ok: true, data: opts } });
    });
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'load' });
    await page.evaluate(seed => {
      authEpoch++; state = seed; normalizeStateSchema();
      currentUser = state.Users[0]; authSessionToken = 'TOKEN_U01';
      activeWorkspace = 'admin'; activeTab = 'teams';
      shapePrintInviteListStatus = 'ready'; setSaveFeedback('idle', '');
      renderAll();
    }, f.c.db);
    const form = page.getByRole('form', { name: '建立形印組邀請' });
    const email = form.getByLabel('受邀信箱');
    const manual = form.getByRole('button', { name: '只建立連結' });
    const submit = form.getByRole('button', { name: '建立並寄送邀請' });
    const link = page.getByLabel('剛建立的專屬連結');
    await email.fill(exampleEmail);
    await page.evaluate(() => renderAll());
    assert.equal(await email.inputValue(), exampleEmail);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await submit.click();
    await form.getByRole('button', { name: '建立與寄送中…' }).waitFor();
    assert.ok(await manual.isDisabled());
    assert.ok(await email.isDisabled());
    assert.equal(await link.count(), 0);
    release();
    await page.getByRole('status').filter({ hasText: '邀請信已寄出' }).waitFor();
    assert.ok((await link.inputValue()).includes(tokenFor(1)));
    assert.equal(await email.inputValue(), '');

    f.c.failMail = true;
    await email.fill('next@example.invalid');
    await submit.click();
    await page.getByRole('status').filter({ hasText: '尚未確認寄送' }).waitFor();
    assert.ok((await link.inputValue()).includes(tokenFor(2)));
    await email.fill('next@example.invalid');
    await submit.click();
    await page.getByRole('alert').filter({ hasText: '已有有效邀請' }).waitFor();
    assert.equal(await email.inputValue(), 'next@example.invalid');
    assert.ok((await link.inputValue()).includes(tokenFor(2)));

    await email.fill('manual@example.invalid');
    await manual.click();
    await page.getByRole('status').filter({ hasText: '未寄送郵件' }).waitFor();
    assert.deepEqual(requests, [send, send, send, create]);
    assert.equal(f.attempts(), 2);
    assert.equal(f.mail.length, 1);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
