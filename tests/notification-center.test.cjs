const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { fixture } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..');
const output = process.env.NOTIFICATION_ARTIFACT_DIR || path.join(root, 'audit/notification-center-2026-10-24');
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error('FAIL ' + name + '\n' + error.stack); }
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const seed = fixture();
  const items = [
    ['work-item-open', '有新的可認養工作', '展場指標設計需要一位夥伴，查看需求後即可認養。', '2026-10-24 10:47', false, 'normal'],
    ['design-service-deliverable', '主視覺成果已送審', '01 視覺設計小組的成果已上傳，請確認內容與規格。', '2026-10-24 09:12', false, 'high'],
    ['assignment-reminder', '第四次會審即將截止', '請於 10 月 27 日 18:00 前完成主視覺 PDF 與設計說明。', '2026-10-24 08:00', false, 'high'],
    ['design-service-approved', '形印代做成果已完成', '你的主視覺已通過審核，可查看最新成果。', '2026-10-23 16:18', false, 'normal'],
    ['review-comment', '主視覺收到新的回覆', '指導老師已留下排版建議，請查看作業中的留言。', '2026-10-23 14:32', false, 'normal'],
    ['design-service-claimed', '形印代做已接案', '小組的協作申請已有組員接下，完成後會通知你。', '2026-10-23 11:05', true, 'normal'],
    ['assignment-post', '第四次會審繳交項目已發布', '繳交規範與參考公版已準備好，請先閱讀說明。', '2026-10-22 10:00', true, 'normal'],
    ['system', '其他帳號的私人通知', 'PRIVATE_OTHER_USER', '2026-10-24 11:00', false, 'normal']
  ];
  seed.Notifications = items.map((n, i) => ({ Notification_ID: 'NC_' + i, User_ID: i === 7 ? 'U02' : 'U01', Type: n[0], Title: n[1], Message: n[2],
    Created_At: n[3], Read: n[4], Priority: n[5], Tab: 'files', Ref_Type: 'assignment', Ref_ID: 'A01' }));
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fs.readFileSync(path.join(root, 'index.html'))); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1120 }, reducedMotion: 'reduce', timezoneId: 'Asia/Taipei' });
    await context.route(/https:\/\/script\.(google|googleusercontent)\.com\//, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: { state: seed, currentUser: null } }) }));
    const page = await context.newPage(); page.setDefaultTimeout(6000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
    await page.evaluate(seed => {
      window.__seed = seed;
      window.__resetNotices = () => {
        authEpoch++; state = JSON.parse(JSON.stringify(window.__seed)); normalizeStateSchema();
        currentUser = state.Users[0]; authSessionToken = 'FIXTURE_ONLY';
        remoteSaveInFlight = false; remoteSavePromise = null; pendingRemoteSave = false; remoteMutationInFlight = false;
        workspaceHydrationInFlight = false; remoteStateRevision = 1; gasConnectionStatus = 'remote';
        cancelQueuedRemoteStateSync(); activeWorkspace = 'admin'; activeTab = 'notifications';
        notificationBrowserState = { query: '', category: 'all', type: 'all', read: 'all', sortBy: 'newest' };
        notificationCenterUi = { userId: currentUser.User_ID, selecting: false, filtersOpen: false };
        notificationReadsInFlight.clear(); clearNotificationSelection();
        window.__writes = []; requestGas = async action => { window.__writes.push(action); throw new Error('Fixture blocks network writes'); };
        setSaveFeedback('idle', ''); renderAll();
      }; window.__resetNotices();
    }, seed);
    const center = page.locator('.notification-center');
    const rows = page.locator('.nc-row');
    const reset = () => page.evaluate(() => window.__resetNotices());
    const shot = name => center.screenshot({ path: path.join(output, name + '.png'), style: '#system-status-bar, #toast-notif { opacity: 0 !important; }' });
    await test('quiet inbox groups by date, shows readable previews and only current-user notifications', async () => {
      assert.equal(await rows.count(), 7); assert.equal(await page.locator('.nc-day').count(), 3);
      assert.equal(await page.locator('.nc-dot').count(), 5);
      assert.equal(await center.locator('input[type=checkbox]').count(), 0);
      assert.equal(await page.locator('#notification-advanced-filters').isVisible(), false);
      assert.match(await page.locator('.nc-subtitle').textContent(), /5 則未讀 · 2 則重要/);
      assert.ok(!(await center.innerText()).includes('PRIVATE_OTHER_USER'));
      assert.match(await rows.nth(1).innerText(), /成果審核/);
      assert.equal(await rows.nth(1).locator('.nc-symbol svg[data-lucide="clipboard-check"]').count(), 1);
      assert.equal(await rows.first().locator('.nc-row-message').isVisible(), true);
      await shot('desktop');
    });
    await test('important assignment notices also appear in the assignment category', async () => {
      await page.locator('#notification-category-files').click(); assert.equal(await rows.count(), 6);
      assert.equal(await page.locator('.nc-priority').count(), 2);
      await page.locator('#notification-category-important').click(); assert.equal(await rows.count(), 2);
      await page.locator('#notification-category-unread').click(); assert.equal(await rows.count(), 5);
      await page.locator('#notification-category-all').click(); assert.equal(await rows.count(), 7);
      assert.deepEqual(await page.evaluate(() => window.__writes), []);
    });
    await test('continuous search retains focus and caret; composition waits until completion', async () => {
      const input = page.locator('#notification-search');
      await input.focus(); await input.pressSequentially('主視覺');
      assert.equal(await input.inputValue(), '主視覺'); assert.equal(await rows.count(), 4);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'notification-search');
      assert.equal(await page.evaluate(() => document.getElementById('notification-search').selectionStart), 3);
      await page.evaluate(() => {
        const input = document.getElementById('notification-search'); input.value = '測';
        input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
      });
      assert.equal(await page.evaluate(() => notificationBrowserState.query), '主視覺');
      await page.evaluate(() => document.getElementById('notification-search').dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
      assert.equal(await page.evaluate(() => notificationBrowserState.query), '測');
      assert.equal(await rows.count(), 0); assert.equal(await center.getByRole('heading', { name: '沒有符合條件的通知' }).isVisible(), true);
      await center.getByRole('button', { name: '顯示全部通知' }).click(); assert.equal(await rows.count(), 7);
    });
    await test('advanced filters open on demand and changing read state avoids contradictory categories', async () => {
      await reset();
      await page.locator('#notification-category-unread').click();
      await page.locator('#notification-filter-toggle').click();
      await page.locator('[data-soft-select-root="notification-read-select"] [data-soft-select-trigger]').click();
      await page.locator('[data-soft-select-root="notification-read-select"] [data-soft-select-panel]').getByRole('button', { name: '已讀', exact: true }).click();
      assert.equal(await rows.count(), 2); assert.equal(await page.evaluate(() => notificationBrowserState.category), 'all');
      await page.locator('#notification-filter-toggle').click(); assert.match(await page.locator('.nc-filter-note').textContent(), /已讀/);
      await page.locator('#notification-category-unread').click(); assert.equal(await rows.count(), 5);
      await reset();
    });
    await test('selection mode is explicit, select-all is scoped to visible results and keyboard focus survives', async () => {
      await reset();
      await page.locator('#notification-select-toggle').click();
      await page.locator('#notification-check-NC_0').check();
      assert.equal(await page.evaluate(() => document.activeElement.id), 'notification-check-NC_0');
      assert.equal(await page.locator('#notification-select-visible').evaluate(e => e.indeterminate), true);
      await page.locator('#notification-category-important').click();
      assert.equal(await page.evaluate(() => getSelectedNotificationIds().length), 0);
      await page.locator('#notification-select-visible').check();
      assert.deepEqual(await page.evaluate(() => getSelectedNotificationIds()), ['NC_1', 'NC_2']);
      await shot('selection');
      await page.locator('#notification-select-toggle').click();
      assert.equal(await center.locator('input[type=checkbox]').count(), 0);
      assert.equal(await page.evaluate(() => getSelectedNotificationIds().length), 0);
      await reset();
    });
    await test('mark-read provides one pending spinner, ignores repeats and retains unread status on failure', async () => {
      await reset();
      await page.evaluate(() => {
        submitRemoteNotificationsRead = ids => { window.__writes.push(ids); return new Promise((resolve, reject) => { window.__readResolve = resolve; window.__readReject = reject; }); };
      });
      const first = page.locator('[data-notification-id="NC_0"]');
      await first.locator('.nc-read-button').click();
      assert.equal(await first.locator('.nc-read-button').isDisabled(), true);
      assert.equal(await first.locator('.managed-icon-spinner').count(), 1);
      assert.equal(await first.locator('.managed-icon-spinner').evaluate(e => e.getBoundingClientRect().width <= 20), true);
      await page.evaluate(() => markNotificationRead('NC_0')); assert.equal(await page.evaluate(() => window.__writes.length), 1);
      await page.evaluate(() => window.__readReject(new Error('Fixture offline')));
      await page.waitForFunction(() => notificationReadsInFlight.size === 0);
      assert.equal(await first.getAttribute('data-notification-state'), 'unread');
      assert.equal(await first.locator('.nc-read-button').isEnabled(), true);
      await first.locator('.nc-read-button').click();
      await page.evaluate(() => { state.Notifications.find(n => n.Notification_ID === 'NC_0').Read = true; window.__readResolve(); });
      await page.waitForFunction(() => notificationReadsInFlight.size === 0);
      assert.equal(await first.getAttribute('data-notification-state'), 'read');
      assert.equal(await first.locator('.nc-dot').count(), 0);
      await reset();
    });
    await test('bulk marking and destructive menu keep existing confirmation and current-user scope', async () => {
      await reset();
      await page.evaluate(() => {
        submitRemoteNotificationsRead = async (ids, options = {}) => {
          window.__writes.push({ ids, options });
          state.Notifications.forEach(n => { if (n.User_ID === currentUser.User_ID && (options.all || ids.includes(n.Notification_ID))) n.Read = true; });
        };
      });
      await page.locator('#notifications-mark-all-read-button').click();
      await page.waitForFunction(() => !notificationActionInFlight);
      assert.equal(await page.locator('.nc-dot').count(), 0);
      assert.equal(await page.locator('#notifications-mark-all-read-button').isDisabled(), true);
      assert.equal(await page.evaluate(() => state.Notifications.find(n => n.Notification_ID === 'NC_7').Read), false);
      await center.getByLabel('更多通知操作').click();
      let confirmationText = '';
      page.once('dialog', async confirmation => { confirmationText = confirmation.message(); await confirmation.dismiss(); });
      await page.locator('#notifications-clear-all-button').click();
      assert.match(confirmationText, /清空目前帳號/);
      assert.equal(await rows.count(), 7);
      await reset();
    });
    await test('the main notification action still opens the related assignment', async () => {
      await page.evaluate(() => { submitRemoteNotificationsRead = async ids => { state.Notifications.filter(n => ids.includes(n.Notification_ID)).forEach(n => n.Read = true); }; });
      await rows.first().locator('.nc-row-main').click();
      await page.waitForFunction(() => activeAssignmentId === 'A01');
      assert.equal(await page.locator('#assignment-detail-modal').isVisible(), true);
      await page.evaluate(() => closeAssignmentDetailModal(true)); await reset();
    });
    await test('mobile inbox, long titles, filter menus and selection controls fit 320 and 390px', async () => {
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 900 }); await reset();
        await page.evaluate(() => { state.Notifications[0].Title = '長標題'.repeat(12) + '<script>unsafe</script>'; renderAll(); });
        for (const mode of ['normal', 'filters', 'selection']) {
          if (mode === 'filters') await page.locator('#notification-filter-toggle').click();
          if (mode === 'selection') { await page.locator('#notification-filter-toggle').click(); await page.locator('#notification-select-toggle').click(); }
          const fits = await center.evaluate(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && e.scrollWidth <= e.clientWidth + 1; });
          assert.equal(fits, true, width + ':' + mode);
          assert.equal(await center.locator('script').count(), 0);
        }
      }
      await page.setViewportSize({ width: 390, height: 900 }); await reset(); await shot('mobile');
      await page.setViewportSize({ width: 1440, height: 1120 });
    });
    await test('date grouping handles Taipei day boundaries and empty or invalid timestamps', async () => {
      const values = await page.evaluate(() => {
        const now = new Date('2026-10-24T00:30:00+08:00');
        return ['2026-10-24 00:05', '2026-10-23 23:59', '2025-10-01 12:30', 'invalid'].map(value => getNotificationDateGroup(value, now));
      });
      assert.equal(values[0].label, '今天'); assert.equal(values[1].label, '昨天');
      assert.equal(values[2].label, '2025 年 10 月 1 日'); assert.equal(values[3].label, '較早的通知');
    });
    await test('empty inbox is helpful and no browser errors occurred', async () => {
      await page.evaluate(() => { state.Notifications = []; renderAll(); });
      assert.equal(await center.getByRole('heading', { name: '目前沒有新通知' }).isVisible(), true);
      assert.equal(await page.locator('#notifications-mark-all-read-button').isDisabled(), true);
      assert.deepEqual(errors, []);
    });
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results }, null, 2));
  if (results.some(result => !result.passed)) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
