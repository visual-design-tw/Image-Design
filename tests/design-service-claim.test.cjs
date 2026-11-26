const fs = require('node:fs');
const path = require('node:path');
const { createSiteServer } = require('./site-test-server.cjs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { fixture, backend } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const id = 'DS_SYNTHETIC_claim_fixture';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error('FAIL ' + name + '\n' + error.stack); }
}
function seed() {
  const state = fixture();
  state.Users.push({ User_ID: 'U05', Name: 'Second fixture worker', Email: 'second@example.invalid', Role: 'Admin', Team_ID: 'T00', Status: 'Active' });
  state.Design_Service_Settings = [{ Settings_ID: 'SERVICE_DEFAULT', Enabled: true, Eligible_User_IDs: ['U04', 'U05'] }];
  state.Design_Service_Orders = [{ Service_Order_ID: id, Assignment_ID: 'A01', Stage_ID: 'S01', Team_ID: 'T01', Requested_By_User_ID: 'U02', Requested_At: '2026-10-21 20:00', Status: '待接案' }];
  return state;
}
function context() {
  const c = backend();
  c.db = c.normalizeState_(seed());
  c.stale = clone(c.db); c.reads = []; c.writes = 0; c.logs = 0; c.locked = false;
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
    assert.equal(c.locked, true);
    c.writes++;
    const next = c.mergeSensitiveState_(c.normalizeState_(clone(state)), options.existingState, options);
    next.Meta.State_Revision = options.nextRevision;
    c.db = c.normalizeState_(clone(next));
  };
  c.appendActivityLogEntries_ = () => { c.logs++; };
  c.buildClientStateResultForUser_ = (state, actor, extra) => ({ state: c.filterStateForUser_(state, actor),
    currentUser: actor, stateRevision: state.Meta.State_Revision, release: c.APP_RELEASE, ...extra });
  c.jsonResponse_ = (ok, data, error) => ({ ok, data, error: error ? { message: error.message } : null });
  return c;
}
const input = (user = 'U04') => ({ action: 'claimDesignServiceOrder', serviceOrderId: id, sessionToken: 'SYNTHETIC_' + user });
const dispatch = (c, payload = input()) => c.doPost({ postData: { contents: JSON.stringify(payload) } });
async function backendTests() {
  await test('claim reads fresh state before and after its locked commit, despite stale cached snapshots', () => {
    const c = context(), result = dispatch(c);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.claimConfirmed, true);
    assert.equal(result.data.designServiceOrder.Status, '製作中');
    assert.equal(result.data.designServiceOrder.Responsible_User_ID, 'U04');
    assert.ok(result.data.designServiceOrder.Claimed_At);
    assert.equal(c.writes, 1); assert.equal(c.reads.length, 2);
    assert.ok(c.reads.every(read => read.fresh && read.locked));
    assert.equal(c.stale.Design_Service_Orders[0].Status, '待接案');
  });
  await test('same-owner retry confirms the original result without another write, log or notification', () => {
    const c = context(); dispatch(c); const count = c.db.Notifications.length;
    const result = dispatch(c); assert.equal(result.data.alreadyClaimed, true); assert.equal(c.writes, 1);
    assert.equal(c.logs, 1); assert.equal(c.db.Notifications.length, count);
  });
  await test('two eligible actors cannot both acquire the same order', () => {
    const c = context(); assert.equal(dispatch(c).ok, true);
    const result = dispatch(c, input('U05')); assert.equal(result.ok, false); assert.match(result.error.message, /CLAIM_TAKEN/);
    assert.equal(c.db.Design_Service_Orders[0].Responsible_User_ID, 'U04'); assert.equal(c.writes, 1);
  });
  await test('a lost post-commit confirmation is safely recovered by same-owner retry', () => {
    const c = context(), read = c.loadState_; let fail = true;
    c.loadState_ = options => { if (c.writes && fail) { fail = false; throw new Error('Read unavailable'); } return read(options); };
    const first = dispatch(c); assert.equal(first.ok, false); assert.match(first.error.message, /CLAIM_NOT_CONFIRMED/);
    const count = c.db.Notifications.length;
    const second = dispatch(c); assert.equal(second.data.alreadyClaimed, true); assert.equal(c.writes, 1); assert.equal(c.db.Notifications.length, count);
  });
  await test('read failure before commit does not create a claim', () => {
    const c = context(); c.loadState_ = () => { throw new Error('Read unavailable'); };
    assert.match(dispatch(c).error.message, /CLAIM_NOT_CONFIRMED/); assert.equal(c.writes, 0);
  });
  await test('an unconfirmed or mismatched authoritative read cannot report successful assignment', () => {
    const c = context(), read = c.loadState_;
    c.loadState_ = options => { const state = read(options); if (c.writes) state.Design_Service_Orders[0].Responsible_User_ID = 'OTHER'; return state; };
    assert.match(dispatch(c).error.message, /CLAIM_NOT_CONFIRMED/); assert.equal(c.logs, 0);
  });
  await test('inactive, student, leader and expired actors remain unable to claim', () => {
    for (const user of ['U01', 'U02', 'MISSING', 'U05']) {
      const c = context(); if (user === 'U05') c.db.Users.find(item => item.User_ID === user).Status = 'Pending';
      const result = dispatch(c, input(user)); assert.equal(result.ok, false); assert.equal(c.writes, 0);
    }
  });
  await test('eligible shape-print leader can claim a service order', () => {
    const c = context();
    c.db.Design_Service_Settings[0].Eligible_User_IDs = ['U01'];
    const result = dispatch(c, input('U01'));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.designServiceOrder.Responsible_User_ID, 'U01');
    assert.equal(c.writes, 1);
  });
  await test('service settings use the fresh state and return the confirmed saved values', () => {
    const c = context();
    c.db.Assignments[0].Body = 'Latest value from another manager';
    const result = dispatch(c, { action: 'configureDesignService', enabled: true, eligibleUserIds: ['U01', 'U04', 'U05'], sessionToken: 'SYNTHETIC_U01' });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.state.Assignments[0].Body, 'Latest value from another manager');
    assert.equal(result.data.designServiceSettings.Enabled, true);
    assert.deepEqual(result.data.designServiceSettings.Eligible_User_IDs, ['U01', 'U04', 'U05']);
    assert.equal(c.writes, 1); assert.equal(c.reads.length, 2);
    assert.ok(c.reads.every(read => read.fresh && read.locked));
  });
  await test('activity-log failure does not turn a saved service setting into an apparent failure', () => {
    const c = context(); c.appendActivityLogEntries_ = () => { throw new Error('Log unavailable'); };
    const result = dispatch(c, { action: 'configureDesignService', enabled: false, eligibleUserIds: ['U04'], sessionToken: 'SYNTHETIC_U01' });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.designServiceSettings.Enabled, false);
    assert.deepEqual(result.data.designServiceSettings.Eligible_User_IDs, ['U04']);
    assert.equal(c.writes, 1);
  });
  await test('disabled service and removed eligibility block new claims without changing settings', () => {
    for (const closed of [true, false]) {
      const c = context();
      if (closed) c.db.Design_Service_Settings[0].Enabled = false;
      else c.db.Design_Service_Settings[0].Eligible_User_IDs = ['U05'];
      const before = clone(c.db); const result = dispatch(c);
      assert.match(result.error.message, closed ? /CLAIM_CLOSED/ : /CLAIM_FORBIDDEN/);
      assert.equal(c.writes, 0); assert.deepEqual(clone(c.db), before);
    }
  });
  await test('closed settings do not obstruct read-only confirmation of an already acquired order', () => {
    const c = context(); dispatch(c); c.db.Design_Service_Settings[0].Enabled = false; c.db.Design_Service_Settings[0].Eligible_User_IDs = [];
    const result = dispatch(c); assert.equal(result.data.alreadyClaimed, true); assert.equal(c.writes, 1);
  });
  await test('completed or reviewed same-owner cases are confirmed without reverting their progress', () => {
    for (const status of ['待審核', '退回修正', '已完成']) {
      const c = context(); dispatch(c); c.db.Design_Service_Orders[0].Status = status;
      assert.equal(dispatch(c).data.designServiceOrder.Status, status); assert.equal(c.writes, 1);
    }
  });
  await test('removed orders, missing parents and preexisting owners are not recreated or overwritten', () => {
    for (const change of [c => { c.db.Design_Service_Orders = []; }, c => { c.db.Assignments = []; }, c => { c.db.Design_Service_Orders[0].Responsible_User_ID = 'U05'; }]) {
      const c = context(); change(c); const before = clone(c.db); assert.equal(dispatch(c).ok, false);
      assert.equal(c.writes, 0); assert.deepEqual(clone(c.db), before);
    }
  });
  await test('unrelated newer changes survive a claim from a stale client', () => {
    const c = context(); c.db.Assignments[0].Body = 'Newer unrelated content'; c.db.Meta.State_Revision = 80;
    const result = dispatch(c, { ...input(), stateRevision: 1 });
    assert.equal(result.data.stateRevision, 81); assert.equal(c.db.Assignments[0].Body, 'Newer unrelated content');
  });
  await test('activity-log failure does not turn a confirmed claim into an apparent failure', () => {
    const c = context(); c.appendActivityLogEntries_ = () => { throw new Error('Log unavailable'); };
    assert.equal(dispatch(c).data.claimConfirmed, true); assert.equal(dispatch(c).data.alreadyClaimed, true); assert.equal(c.writes, 1);
  });
}

async function browserTests() {
  let c = context(), mode = 'normal', delay = 0;
  const requests = [], pagesErrors = [];
  const server = createSiteServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fs.readFileSync(path.join(root, 'index.html'))); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const routeClient = async client => {
      await client.route(/https:\/\/script\.(google|googleusercontent)\.com\//, async route => {
        const p = route.request().method() === 'POST' ? JSON.parse(route.request().postData()) : {};
        requests.push(p);
        let result;
        const localMode = mode;
        if (p.action === 'claimDesignServiceOrder') {
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          result = localMode === 'expired' ? { ok: false, error: { message: 'AUTH_EXPIRED' } } : dispatch(c, p);
          if (localMode === 'empty') result = { ok: true, data: {} };
          if (localMode === 'mismatch' && result.ok) result.data.designServiceOrder.Responsible_User_ID = 'OTHER_FIXTURE';
          if (localMode === 'legacy' && result.ok) delete result.data.claimConfirmed;
          if (localMode === 'expired') result = { ok: false, error: { message: 'AUTH_EXPIRED' } };
          if (localMode === 'lost') return route.abort();
        } else if (p.action === 'bootstrap') {
          const actor = c.db.Users.find(user => p.sessionToken === 'SYNTHETIC_' + user.User_ID);
          result = { ok: true, data: c.buildClientStateResultForUser_(clone(c.db), actor, {}) };
        } else if (p.action === 'configureDesignService') {
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          result = localMode === 'configure-fail'
            ? { ok: false, error: { message: '雲端設定確認失敗，請重新載入後再試。' } }
            : localMode === 'configure-empty' ? { ok: true, data: {} } : dispatch(c, p);
        }
        else result = { ok: true, data: { state: seed() } };
        try { await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) }); }
        catch (error) { if (!/closed|disposed/i.test(error.message)) throw error; }
      });
    };
    const client = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Taipei', reducedMotion: 'reduce' });
    await routeClient(client);
    const page = await client.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', error => pagesErrors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'load' });
    const seedPage = async (target = page, userId = 'U04') => target.evaluate(({ next, userId }) => {
      authEpoch++; clearFilePreviewSurfaces(); cancelQueuedRemoteStateSync(); designServiceClaimFeedback.clear(); designServiceClaimInFlight = false;
      state = next; normalizeStateSchema(); currentUser = state.Users.find(user => user.User_ID === userId); authSessionToken = 'SYNTHETIC_' + userId;
      activeWorkspace = 'admin'; activeTab = 'design-service'; expiredSessionToken = ''; workspaceHydrationInFlight = false; workspaceHydrationErrorMessage = '';
      remoteMutationInFlight = false; pendingRemoteSave = false; remoteSaveInFlight = false; remoteSavePromise = null; remoteStateRevision = state.Meta.State_Revision;
      document.getElementById('session-expired-modal').classList.add('hidden'); setSaveFeedback('idle', ''); renderAll();
      document.getElementById('toast-notif').classList.remove('opacity-100', 'translate-y-0');
      document.getElementById('toast-notif').classList.add('opacity-0', 'translate-y-12', 'pointer-events-none');
    }, { next: clone(c.db), userId });
    const reset = async () => { c = context(); mode = 'normal'; delay = 0; await seedPage(); };
    const button = page.locator('[data-service-claim-id="' + id + '"]');
    const done = () => page.waitForFunction(() => !designServiceClaimInFlight);
    const status = page.locator('[data-service-claim-status]');
    await test('actual claim button dispatches once, shows one spinner and prevents repeated presses', async () => {
      await reset(); delay = 1500; const before = requests.filter(p => p.action === 'claimDesignServiceOrder').length;
      await button.click(); assert.equal(await button.isDisabled(), true); assert.match(await button.innerText(), /接案中/);
      assert.equal(await button.locator('[aria-hidden="true"]').count(), 1); assert.equal(await button.getAttribute('aria-busy'), 'true');
      if (process.env.CLAIM_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.CLAIM_ARTIFACT_DIR, 'claim-desktop-pending.png') });
      await page.evaluate(orderId => { claimDesignServiceOrder(orderId); claimDesignServiceOrder(orderId); renderAll(); }, id);
      assert.match(await status.innerText(), /正在確認/); await done();
      assert.equal(requests.filter(p => p.action === 'claimDesignServiceOrder').length - before, 1);
      assert.match(await status.innerText(), /接案成功/); assert.equal(await button.count(), 0);
      assert.equal(await page.getByRole('button', { name: '上傳成果', exact: true }).count(), 1);
    });
    await test('loading and result stay understandable at mobile width', async () => {
      await reset(); await page.setViewportSize({ width: 390, height: 844 }); delay = 1500;
      await button.click(); await button.scrollIntoViewIfNeeded();
      const geometry = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, status: document.querySelector('[data-service-claim-status]').getBoundingClientRect().width }));
      assert.equal(geometry.overflow, false); assert.ok(geometry.status > 100);
      if (process.env.CLAIM_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.CLAIM_ARTIFACT_DIR, 'claim-mobile-pending.png') });
      await done(); assert.match(await status.innerText(), /接案成功/); await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await test('lost response preserves an explicit confirmation retry without duplicating assignment or notices', async () => {
      await reset(); mode = 'lost'; await button.click(); await done();
      assert.equal(await button.innerText(), '重試確認'); assert.match(await status.innerText(), /尚未確認/);
      assert.equal(await page.evaluate(() => state.Design_Service_Orders[0].Status), '待接案');
      const noticeCount = c.db.Notifications.length; mode = 'normal'; await button.click(); await done();
      assert.match(await status.innerText(), /前次接案成功/); assert.equal(c.writes, 1); assert.equal(c.db.Notifications.length, noticeCount);
    });
    await test('empty, mismatched and legacy responses cannot produce false success', async () => {
      for (const bad of ['empty', 'mismatch', 'legacy']) {
        await reset(); mode = bad; await button.click(); await done();
        assert.match(await status.innerText(), /尚未確認/); assert.equal(await button.innerText(), '重試確認');
        assert.equal(await page.evaluate(() => state.Design_Service_Orders[0].Status), '待接案');
      }
    });
    await test('a newer workspace snapshot keeps a visible confirmation retry instead of hiding it', async () => {
      await reset(); delay = 250; await button.click();
      await page.evaluate(orderId => {
        const order = getDesignServiceOrderById(orderId);
        order.Status = '製作中'; order.Responsible_User_ID = currentUser.User_ID;
        order.Responsible_Name = currentUser.Name; order.Claimed_At = '2026-09-05 12:00';
        remoteStateRevision = 99; renderAll();
      }, id);
      await done(); assert.equal(await button.innerText(), '重試確認');
      assert.equal(await page.getByRole('button', { name: '上傳成果', exact: true }).count(), 0);
      c.db.Meta.State_Revision = 99; delay = 0; await button.click(); await done();
      assert.match(await status.innerText(), /前次接案成功/); assert.equal(c.writes, 1);
    });
    await test('case taken elsewhere refreshes the responsible person without overwriting them', async () => {
      await reset(); dispatch(c, input('U05')); await button.click(); await done();
      assert.match(await status.innerText(), /已被接下/); assert.match(await status.innerText(), /已更新案件清單/);
      assert.match(await page.locator('[data-service-card]').innerText(), /Second fixture worker/);
      assert.equal(await button.count(), 0); assert.equal(c.writes, 1);
    });
    await test('unsaved changes block the claim before network dispatch and preserve the draft', async () => {
      await reset(); const before = requests.filter(p => p.action === 'claimDesignServiceOrder').length;
      await page.evaluate(() => { pendingRemoteSave = true; state.Assignments[0].Body = 'Retained draft'; });
      await button.click(); await done(); assert.match(await status.innerText(), /未確認的修改/);
      assert.equal(requests.filter(p => p.action === 'claimDesignServiceOrder').length, before);
      assert.equal(await page.evaluate(() => state.Assignments[0].Body), 'Retained draft');
      await page.evaluate(() => { pendingRemoteSave = false; });
    });
    await test('edits made during the claim survive confirmed backend state application', async () => {
      await reset(); delay = 300; await button.click();
      await page.evaluate(() => { state.Assignments[0].Body = 'Edited while waiting'; }); await done();
      assert.equal(await page.evaluate(() => state.Assignments[0].Body), 'Edited while waiting');
      assert.match(await status.innerText(), /接案成功/); assert.equal(await page.evaluate(() => saveFeedbackState), 'error');
    });
    await test('another mutation blocks claim attempts without leaving the button in a loading state', async () => {
      await reset(); await page.evaluate(() => { remoteMutationInFlight = true; });
      const before = requests.length; await button.click();
      assert.match(await status.innerText(), /另一項操作/); assert.equal(await button.isDisabled(), false); assert.equal(requests.length, before);
      await page.evaluate(() => { remoteMutationInFlight = false; });
    });
    await test('expiry exits the busy state and requests re-login instead of silently retrying', async () => {
      await reset(); mode = 'expired'; await button.click(); await done();
      assert.equal(await page.locator('#session-expired-modal').isVisible(), true);
      assert.match(await status.innerText(), /登入已失效/); assert.equal(await button.getAttribute('aria-busy'), 'false');
      assert.equal(c.writes, 0);
    });
    await test('logout discards old feedback and ignores a late claim response', async () => {
      await reset(); delay = 350; await button.click();
      await page.evaluate(() => { clearStoredSession(); currentUser = null; state = createUnauthenticatedState(); renderAll(); });
      await new Promise(resolve => setTimeout(resolve, 500));
      assert.equal(await page.evaluate(() => designServiceClaimFeedback.size), 0);
      assert.equal(await page.evaluate(() => designServiceClaimInFlight), false);
      assert.equal(await page.evaluate(() => remoteMutationInFlight), false);
      assert.equal(await page.evaluate(() => currentUser), null);
    });
    await test('closed service hides new-claim buttons but permits confirmation of an unknown result', async () => {
      await reset(); c.db.Design_Service_Settings[0].Enabled = false; await seedPage(); assert.equal(await button.count(), 0);
      await page.evaluate(orderId => { designServiceClaimFeedback.set(orderId, { userId: currentUser.User_ID, phase: 'unconfirmed', message: 'Unknown fixture result' }); renderAll(); }, id);
      assert.equal(await button.innerText(), '重試確認'); await button.click(); await done();
      assert.match(await status.innerText(), /暫停/); assert.equal(c.writes, 0); assert.equal(await button.count(), 0);
    });
    await test('generic design-service actions cannot announce success when state was not confirmed', async () => {
      await reset(); mode = 'configure-empty';
      const error = await page.evaluate(async () => { try { await submitDesignServiceAction('configureDesignService', {}, 'SHOULD_NOT_SHOW'); return ''; } catch (error) { return error.message; } });
      assert.match(error, /SERVICE_NOT_CONFIRMED/); assert.ok(!(await page.locator('#toast-notif').textContent()).includes('SHOULD_NOT_SHOW'));
      mode = 'normal';
    });
    await test('settings save shows progress, confirms the updated values, and closes only on success', async () => {
      await reset(); delay = 250; await seedPage(page, 'U01');
      const before = requests.filter(p => p.action === 'configureDesignService').length;
      await page.evaluate(() => { activeTab = 'design-service'; renderAll(); openDesignServiceSettingsModal(); });
      const modal = page.locator('#design-service-settings-modal');
      const save = modal.locator('#design-service-settings-save');
      await modal.locator('[data-design-service-user-id="U05"]').uncheck();
      await save.click();
      await modal.getByText('正在儲存並確認雲端設定…').waitFor();
      assert.equal(await save.isDisabled(), true);
      await modal.waitFor({ state: 'hidden' });
      assert.equal(c.db.Design_Service_Settings[0].Enabled, true);
      assert.deepEqual(c.db.Design_Service_Settings[0].Eligible_User_IDs, ['U04']);
      assert.equal(requests.filter(p => p.action === 'configureDesignService').length, before + 1);
      delay = 0;
    });
    await test('settings failure stays visible in the modal and allows a retry', async () => {
      await reset(); mode = 'configure-fail'; await seedPage(page, 'U01');
      await page.evaluate(() => { activeTab = 'design-service'; renderAll(); openDesignServiceSettingsModal(); });
      const modal = page.locator('#design-service-settings-modal');
      const save = modal.locator('#design-service-settings-save');
      await save.click();
      await modal.getByRole('status').getByText('雲端設定確認失敗，請重新載入後再試。').waitFor();
      assert.equal(await save.isDisabled(), false);
      assert.equal(await modal.isVisible(), true);
      mode = 'normal';
    });
    await test('two isolated browser accounts clicking the same case converge on one owner', async () => {
      c = context(); mode = 'normal'; delay = 150;
      const clients = [];
      try {
        for (const userId of ['U04', 'U05']) {
          const isolated = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }); clients.push(isolated);
          await routeClient(isolated); const target = await isolated.newPage(); target.on('pageerror', error => pagesErrors.push(error.message));
          await target.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'load' }); await seedPage(target, userId);
        }
        const pages = clients.map(client => client.pages()[0]);
        await Promise.all(pages.map(target => target.locator('[data-service-claim-id]').click()));
        for (const target of pages) await target.waitForFunction(() => !designServiceClaimInFlight);
        assert.equal(c.writes, 1); assert.ok(['U04', 'U05'].includes(c.db.Design_Service_Orders[0].Responsible_User_ID));
        const owners = await Promise.all(pages.map(target => target.evaluate(() => state.Design_Service_Orders[0].Responsible_User_ID)));
        assert.deepEqual(owners, [c.db.Design_Service_Orders[0].Responsible_User_ID, c.db.Design_Service_Orders[0].Responsible_User_ID]);
      } finally { for (const isolated of clients) await isolated.close(); }
    });
    await test('claim UI has no uncaught JavaScript errors', () => assert.deepEqual(pagesErrors, []));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
(async () => {
  if (process.env.CLAIM_ARTIFACT_DIR) fs.mkdirSync(process.env.CLAIM_ARTIFACT_DIR, { recursive: true });
  await backendTests(); await browserTests();
  const sources = Object.fromEntries(['index.html', 'gas/Code.gs'].map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex')]));
  const report = { isolated: true, productionWrites: 0, sources, results, passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length };
  if (process.env.CLAIM_ARTIFACT_DIR) fs.writeFileSync(path.join(process.env.CLAIM_ARTIFACT_DIR, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); if (report.failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
