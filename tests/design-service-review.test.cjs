const fs = require('node:fs');
const path = require('node:path');
const { createSiteServer } = require('./site-test-server.cjs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { fixture, backend } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const id = 'DS_SYNTHETIC_REVIEW';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error('FAIL ' + name + '\n' + error.stack); }
}
function context() {
  const c = backend(), seed = fixture();
  seed.Users.push({ User_ID: 'U05', Name: 'Fixture teacher', Email: 'teacher@example.invalid', Team_ID: 'T00', Role: 'SuperAdmin', Status: 'Active' });
  seed.Design_Service_Orders = [{ Service_Order_ID: id, Assignment_ID: 'A01', Stage_ID: 'S01', Team_ID: 'T01',
    Responsible_User_ID: 'U04', Responsible_Name: 'Fixture worker', Status: '待審核', File_Name: 'synthetic-result.ai',
    Drive_File_ID: 'SYNTHETIC_FILE', Submitted_At: '2026-10-22 09:00', Review_Note: '' }];
  c.db = c.normalizeState_(seed); c.stale = clone(c.db); c.writes = 0; c.logs = 0; c.reads = []; c.locked = false;
  c.Logger = { log() {} };
  c.loadState_ = options => { c.reads.push({ fresh: options?.fresh === true, locked: c.locked }); return clone(options?.fresh ? c.db : c.stale); };
  c.withLock_ = fn => { assert.equal(c.locked, false); c.locked = true; try { return fn(); } finally { c.locked = false; } };
  c.requireSessionUser_ = (state, payload, roles) => {
    const actor = state.Users.find(user => payload.sessionToken === 'SYNTHETIC_' + user.User_ID && user.Status === 'Active');
    if (!actor) throw new Error('AUTH_EXPIRED');
    if (roles?.length && !roles.includes(actor.Role)) throw new Error('FORBIDDEN');
    return actor;
  };
  c.persistState_ = (state, options) => {
    assert.equal(c.locked, true); c.writes++;
    c.db = c.normalizeState_(c.mergeSensitiveState_(clone(state), options.existingState, options));
    c.db.Meta.State_Revision = options.nextRevision;
  };
  c.appendActivityLogEntries_ = () => { c.logs++; };
  c.buildClientStateResultForUser_ = (state, actor, extra) => ({ state: c.filterStateForUser_(state, actor), currentUser: actor,
    stateRevision: state.Meta.State_Revision, release: c.APP_RELEASE, ...extra });
  c.jsonResponse_ = (ok, data, error) => ({ ok, data, error: error ? { message: error.message } : null });
  return c;
}
const input = (extra = {}) => ({ action: 'reviewDesignServiceOrder', serviceOrderId: id, status: '通過', reviewNote: '',
  expectedDriveFileId: 'SYNTHETIC_FILE', expectedSubmittedAt: '2026-10-22 09:00', sessionToken: 'SYNTHETIC_U01', ...extra });
const dispatch = (c, payload = input()) => c.doPost({ postData: { contents: JSON.stringify(payload) } });
async function backendTests() {
  await test('approval bypasses stale caches under the lock and confirms the committed order', () => {
    const c = context(), r = dispatch(c); assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.data.reviewConfirmed, true); assert.equal(r.data.designServiceOrder.Status, '已完成');
    assert.equal(r.data.designServiceOrder.Reviewed_By_User_ID, 'U01'); assert.ok(r.data.designServiceOrder.Reviewed_At);
    assert.equal(c.writes, 1); assert.ok(c.reads.every(read => read.fresh && read.locked));
    assert.equal(c.stale.Design_Service_Orders[0].Status, '待審核');
  });
  await test('approval permits an empty note while rejection requires a specific correction note', () => {
    const c = context(); assert.equal(dispatch(c).ok, true);
    const rejected = context(); assert.equal(dispatch(rejected, input({ status: '退件' })).ok, false); assert.equal(rejected.writes, 0);
    const r = dispatch(rejected, input({ status: '退件', reviewNote: 'Please correct the margins.' }));
    assert.equal(r.ok, true); assert.equal(r.data.designServiceOrder.Status, '退回修正');
  });
  await test('same-reviewer retry is read-only and does not duplicate notifications or logs', () => {
    const c = context(); dispatch(c); const notices = c.db.Notifications.length;
    const r = dispatch(c); assert.equal(r.data.alreadyReviewed, true); assert.equal(c.writes, 1);
    assert.equal(c.logs, 1); assert.equal(c.db.Notifications.length, notices);
  });
  await test('a lost confirmation is recoverable without writing the decision twice', () => {
    const c = context(), read = c.loadState_; let fail = true;
    c.loadState_ = options => { if (c.writes && fail) { fail = false; throw new Error('read unavailable'); } return read(options); };
    assert.match(dispatch(c).error.message, /REVIEW_NOT_CONFIRMED/);
    assert.equal(dispatch(c).data.alreadyReviewed, true); assert.equal(c.writes, 1);
  });
  await test('competing managers cannot replace an existing review or reverse its decision', () => {
    const c = context(); dispatch(c);
    assert.match(dispatch(c, input({ sessionToken: 'SYNTHETIC_U05' })).error.message, /REVIEW_CHANGED/);
    assert.match(dispatch(c, input({ status: '退件', reviewNote: 'Different decision' })).error.message, /REVIEW_CHANGED/);
    assert.equal(c.writes, 1); assert.equal(c.db.Design_Service_Orders[0].Status, '已完成');
  });
  await test('a newly uploaded version cannot be approved from an old review dialog', () => {
    for (const field of ['Drive_File_ID', 'Submitted_At']) {
      const c = context(); c.db.Design_Service_Orders[0][field] = 'NEW_VERSION';
      assert.match(dispatch(c).error.message, /REVIEW_CHANGED/); assert.equal(c.writes, 0);
    }
  });
  await test('disabled, student, worker, expired and forged actors cannot review', () => {
    for (const user of ['U02', 'U04', 'MISSING', 'U05']) {
      const c = context(); if (user === 'U05') c.db.Users.find(u => u.User_ID === user).Status = 'Pending';
      assert.equal(dispatch(c, input({ sessionToken: 'SYNTHETIC_' + user, userId: 'U01' })).ok, false); assert.equal(c.writes, 0);
    }
  });
  await test('teachers with manager permissions can review without broadening access', () => {
    const c = context(), r = dispatch(c, input({ sessionToken: 'SYNTHETIC_U05' }));
    assert.equal(r.ok, true); assert.equal(r.data.designServiceOrder.Reviewed_By_User_ID, 'U05');
  });
  await test('missing order, missing deliverable, invalid decision and nonpending status fail without writes', () => {
    for (const change of [c => { c.db.Design_Service_Orders = []; }, c => { c.db.Design_Service_Orders[0].Drive_File_ID = ''; },
      c => { c.db.Design_Service_Orders[0].Status = '製作中'; }]) {
      const c = context(); change(c); assert.equal(dispatch(c).ok, false); assert.equal(c.writes, 0);
    }
    const c = context(); assert.equal(dispatch(c, input({ status: 'INVALID' })).ok, false); assert.equal(c.writes, 0);
  });
  await test('fresh read failure cannot write and unconfirmed readback cannot report success', () => {
    const c = context(); c.loadState_ = () => { throw new Error('offline'); };
    assert.match(dispatch(c).error.message, /REVIEW_NOT_CONFIRMED/); assert.equal(c.writes, 0);
    const d = context(), read = d.loadState_; d.loadState_ = options => { const s = read(options); if (d.writes) s.Design_Service_Orders[0].Status = '待審核'; return s; };
    assert.match(dispatch(d).error.message, /REVIEW_NOT_CONFIRMED/);
  });
  await test('unrelated newer edits survive a stale-client review', () => {
    const c = context(); c.db.Meta.State_Revision = 80; c.db.Assignments[0].Body = 'Newer content';
    const r = dispatch(c, input({ stateRevision: 1 })); assert.equal(r.data.stateRevision, 81); assert.equal(c.db.Assignments[0].Body, 'Newer content');
  });
  await test('activity-log failure does not misreport a confirmed review as failure', () => {
    const c = context(); c.appendActivityLogEntries_ = () => { throw new Error('log unavailable'); };
    assert.equal(dispatch(c).data.reviewConfirmed, true); assert.equal(c.writes, 1);
  });
}
async function browserTests() {
  let c = context(), mode = 'normal', delay = 0;
  const requests = [], errors = [];
  const server = createSiteServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fs.readFileSync(path.join(root, 'index.html'))); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const client = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Asia/Taipei', reducedMotion: 'reduce' });
    await client.route(/https:\/\/script\.(google|googleusercontent)\.com\//, async route => {
      const p = route.request().method() === 'POST' ? JSON.parse(route.request().postData()) : {};
      requests.push(p); let r;
      if (p.action === 'reviewDesignServiceOrder') {
        const heldMode = mode; if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        r = heldMode === 'expired' ? { ok: false, error: { message: 'AUTH_EXPIRED' } } : dispatch(c, p);
        if (heldMode === 'lost') return route.abort();
        if (heldMode === 'empty') r = { ok: true, data: {} };
        if (heldMode === 'mismatch' && r.ok) r.data.designServiceOrder.Drive_File_ID = 'OTHER_FILE';
        if (heldMode === 'legacy' && r.ok) delete r.data.reviewConfirmed;
      } else if (p.action === 'bootstrap') r = { ok: true, data: c.buildClientStateResultForUser_(clone(c.db), c.db.Users[0], {}) };
      else r = { ok: true, data: { state: clone(c.db) } };
      try { await route.fulfill({ contentType: 'application/json', body: JSON.stringify(r) }); }
      catch (error) { if (!/closed|disposed/i.test(error.message)) throw error; }
    });
    const page = await client.newPage(); page.setDefaultTimeout(8000); page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'load' });
    const reset = async () => {
      c = context(); mode = 'normal'; delay = 0;
      await page.evaluate(next => {
        authEpoch++; cancelQueuedRemoteStateSync(); state = next; normalizeStateSchema(); currentUser = state.Users[0];
        authSessionToken = 'SYNTHETIC_U01'; activeWorkspace = 'admin'; activeTab = 'design-service'; expiredSessionToken = '';
        remoteMutationInFlight = false; pendingRemoteSave = false; remoteSaveInFlight = false; remoteStateRevision = state.Meta.State_Revision;
        workspaceHydrationInFlight = false; workspaceHydrationErrorMessage = ''; setSaveFeedback('idle', '');
        if (typeof designServiceReviewInFlight !== 'undefined') designServiceReviewInFlight = false;
        document.getElementById('session-expired-modal').classList.add('hidden'); renderAll();
        document.getElementById('boot-loader').classList.add('is-hidden'); document.body.classList.remove('booting');
        document.getElementById('toast-notif').classList.remove('opacity-100', 'translate-y-0');
        document.getElementById('toast-notif').classList.add('opacity-0', 'translate-y-12', 'pointer-events-none');
        openDesignServiceReviewModal('DS_SYNTHETIC_REVIEW');
      }, clone(c.db));
    };
    const modal = page.locator('#design-service-review-modal'), note = page.locator('#design-service-review-note');
    const approve = () => modal.getByRole('button', { name: /^(通過|儲存中|重試確認)/ });
    const feedback = page.locator('#design-service-review-feedback');
    const done = () => page.waitForFunction(() => typeof designServiceReviewInFlight !== 'undefined' && !designServiceReviewInFlight);
    await test('the actual approval button dispatches once with visible pending feedback and a single spinner', async () => {
      await reset(); delay = 700; const before = requests.length; await approve().click();
      assert.equal(await approve().isDisabled(), true); assert.match(await feedback.innerText(), /正在|確認/);
      assert.equal(await modal.locator('[data-review-spinner]').count(), 1);
      await page.evaluate(() => { submitDesignServiceReview('通過'); submitDesignServiceReview('退件'); closeDesignServiceReviewModal(); });
      assert.equal(await modal.isVisible(), true); await done();
      assert.equal(requests.slice(before).filter(p => p.action === 'reviewDesignServiceOrder').length, 1);
      assert.equal(await modal.isVisible(), false); assert.equal(await page.evaluate(() => state.Design_Service_Orders[0].Status), '已完成');
    });
    await test('empty approval note is valid and rejection keeps an actionable inline validation message', async () => {
      await reset(); const before = requests.length;
      await modal.getByRole('button', { name: '退回修正', exact: true }).click();
      assert.match(await feedback.innerText(), /填寫審核意見/); assert.equal(requests.length, before);
      await note.fill('Adjust the margins'); await modal.getByRole('button', { name: '退回修正', exact: true }).click(); await done();
      assert.equal(await page.evaluate(() => state.Design_Service_Orders[0].Status), '退回修正');
    });
    await test('lost response preserves the original decision and note for a safe explicit confirmation retry', async () => {
      await reset(); await note.fill('Fixture approval note'); mode = 'lost'; await approve().click(); await done();
      assert.equal(await modal.isVisible(), true); assert.match(await feedback.innerText(), /尚未確認/);
      assert.equal(await note.inputValue(), 'Fixture approval note'); assert.equal(await note.getAttribute('readonly'), '');
      assert.equal(await modal.getByRole('button', { name: '退回修正', exact: true }).isDisabled(), true);
      const notices = c.db.Notifications.length; mode = 'normal'; await approve().click(); await done();
      assert.equal(await modal.isVisible(), false); assert.equal(c.writes, 1); assert.equal(c.db.Notifications.length, notices);
    });
    await test('empty, mismatched and legacy receipts do not close the dialog or show success', async () => {
      for (const invalid of ['empty', 'mismatch', 'legacy']) {
        await reset(); mode = invalid; await approve().click(); await done();
        assert.equal(await modal.isVisible(), true); assert.match(await feedback.innerText(), /尚未確認/);
        assert.equal(await page.evaluate(() => state.Design_Service_Orders[0].Status), '待審核');
      }
    });
    await test('new version conflicts remain visible and preserve the review note', async () => {
      await reset(); c.db.Design_Service_Orders[0].Drive_File_ID = 'NEW_FILE'; await note.fill('Kept note');
      await approve().click(); await done(); assert.match(await feedback.innerText(), /更新|變更|重新/);
      assert.equal(await note.inputValue(), 'Kept note'); assert.equal(c.writes, 0);
    });
    await test('unsaved changes and another mutation prevent dispatch without losing the draft', async () => {
      for (const reason of ['unsaved', 'mutation']) {
        await reset(); await note.fill('Retained draft'); const before = requests.length;
        await page.evaluate(reason => { if (reason === 'unsaved') pendingRemoteSave = true; else remoteMutationInFlight = true; }, reason);
        await approve().click(); assert.match(await feedback.innerText(), /未確認|另一項/); assert.equal(requests.length, before);
        assert.equal(await note.inputValue(), 'Retained draft');
      }
    });
    await test('session expiry retains the review without automatic resubmission', async () => {
      await reset(); mode = 'expired'; await note.fill('Expiry draft'); const before = requests.length;
      await approve().click(); await done(); assert.equal(await page.locator('#session-expired-modal').isVisible(), true);
      assert.equal(await note.inputValue(), 'Expiry draft'); assert.equal(requests.slice(before).filter(p => p.action === 'reviewDesignServiceOrder').length, 1);
    });
    await test('logout during a pending review ignores the old response and clears review context', async () => {
      await reset(); delay = 300; await approve().click();
      await page.evaluate(() => { clearStoredSession(); currentUser = null; state = createUnauthenticatedState(); renderAll(); });
      await page.waitForTimeout(450); assert.equal(await page.evaluate(() => currentUser), null);
      assert.equal(await page.evaluate(() => activeDesignServiceReviewOrderId), '');
    });
    await test('mobile pending review fits the screen and keeps feedback and actions reachable', async () => {
      await reset(); await page.setViewportSize({ width: 390, height: 844 }); delay = 1400;
      await note.fill('Synthetic mobile review'); await approve().click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const box = await approve().boundingBox(); assert.ok(box.y >= 0 && box.y + box.height <= 844);
      if (process.env.REVIEW_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.REVIEW_ARTIFACT_DIR, 'review-mobile-pending.png') });
      await done();
    });
    await test('review UI has no uncaught JavaScript errors', () => assert.deepEqual(errors, []));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
(async () => {
  if (process.env.REVIEW_ARTIFACT_DIR) fs.mkdirSync(process.env.REVIEW_ARTIFACT_DIR, { recursive: true });
  await backendTests(); if (!process.env.REVIEW_BACKEND_ONLY) await browserTests();
  const report = { isolated: true, productionWrites: 0, sources: Object.fromEntries(['index.html', 'gas/Code.gs'].map(p =>
    [p, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex')])), results,
    passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length };
  if (process.env.REVIEW_ARTIFACT_DIR) fs.writeFileSync(path.join(process.env.REVIEW_ARTIFACT_DIR, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); if (report.failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
