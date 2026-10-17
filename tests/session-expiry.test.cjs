const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { fixture } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..');
async function main() {
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fs.readFileSync(path.join(root, 'index.html'))); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const checks = [];
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.route(/https:\/\/script\.(google|googleusercontent)\.com\//, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: { state: fixture(), currentUser: null } }) }));
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
    await page.evaluate(seed => {
      window.__resetExpiry = () => {
        clearStoredSession(); state = JSON.parse(JSON.stringify(seed)); normalizeStateSchema();
        currentUser = state.Users[2]; authSessionToken = 'TEST-EXPIRED';
        activeWorkspace = 'team'; activeTab = 'files'; gasConnectionStatus = 'remote';
        remoteMutationInFlight = false; workspaceHydrationInFlight = false;
        document.getElementById('session-expired-modal').classList.add('hidden');
        renderAll(); window.__fetches = 0;
        window.fetch = async () => { window.__fetches++; return new Response(JSON.stringify({ ok: false, error: { message: 'AUTH_EXPIRED: 登入狀態已過期，請重新登入。' } })); };
      };
      window.__resetExpiry();
    }, fixture());
    await page.evaluate(async () => {
      openAssignmentDetailModal('A01');
      document.getElementById('assignment-submit-text').value = 'Preserve this draft';
      try { await requestGas('deleteAssignment', { assignmentId: 'A01' }); } catch (error) { window.__error = { message: error.message, expired: error.sessionExpired }; }
    });
    assert.equal(await page.locator('#session-expired-modal').isVisible(), true);
    assert.equal(await page.evaluate(() => window.__error.expired), true);
    assert.equal(await page.evaluate(() => window.__error.message.includes('AUTH_EXPIRED')), false);
    assert.equal(await page.evaluate(() => state.Assignments.length), 1);
    checks.push('expiry shows clear dialog and does not delete local item');
    await page.evaluate(async () => { try { await requestGas('deleteAssignment', {}); } catch (_) {} });
    assert.equal(await page.evaluate(() => window.__fetches), 1);
    checks.push('repeated requests with expired token are blocked before network');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.closest('#session-expired-modal') !== null), true);
    await page.locator('#session-expired-login').click();
    assert.equal(await page.locator('#auth-section').isVisible(), true);
    assert.equal(await page.locator('#assignment-detail-modal').isVisible(), false);
    assert.equal(await page.locator('#session-expired-modal').isVisible(), false);
    assert.equal(await page.locator('#login-email').inputValue(), 'b@example.invalid');
    assert.equal(await page.evaluate(() => authSessionToken), '');
    assert.equal(await page.evaluate(() => Object.values(sessionStorage).some(value => value.includes('Preserve this draft'))), true);
    assert.equal(await page.evaluate(() => window.__fetches), 1);
    checks.push('explicit return to login clears session and modals, keeps submission text, never replays mutation');
    const recovered = await page.evaluate(async seed => {
      window.fetch = async () => new Response(JSON.stringify({ ok: true, data: { state: seed, currentUser: seed.Users[2], sessionToken: 'TEST-NEW' } }));
      await submitRemoteAuth('login', { email: 'b@example.invalid', password: 'TEST-ONLY' });
      openAssignmentDetailModal('A01');
      const text = document.getElementById('assignment-submit-text').value;
      currentUser = state.Users.find(user => user.User_ID === 'U02');
      openAssignmentDetailModal('A01');
      return { text, other: document.getElementById('assignment-submit-text').value };
    }, fixture());
    assert.deepEqual(recovered, { text: 'Preserve this draft', other: '' });
    checks.push('same account recovers submission text after login; another account does not inherit it');
    await page.evaluate(async () => { window.__resetExpiry(); await bootstrapRemoteState({ suppressBootLoader: true }); });
    assert.equal(await page.locator('#session-expired-modal').isVisible(), true);
    assert.equal(await page.evaluate(() => currentUser.User_ID), 'U03');
    checks.push('background bootstrap expiry offers same notice without discarding screen');
    await page.evaluate(async () => { window.__resetExpiry(); state.Assignments[0].Title = 'Unsaved edit'; await syncStateToBackend(); });
    assert.equal(await page.locator('#session-expired-modal').isVisible(), true);
    assert.equal(await page.evaluate(() => state.Assignments[0].Title), 'Unsaved edit');
    assert.equal(await page.evaluate(() => remoteSaveInFlight), false);
    checks.push('save expiry preserves local edits until user chooses to leave and releases busy state');
    const stale = await page.evaluate(async () => {
      window.__resetExpiry(); let finish;
      window.fetch = () => new Promise(resolve => { finish = resolve; });
      const pending = requestGas('deleteAssignment', {}).catch(error => error.message);
      authEpoch++; authSessionToken = 'NEW-LOGIN';
      finish(new Response(JSON.stringify({ ok: false, error: { message: 'AUTH_EXPIRED: old token' } })));
      await pending;
      return { token: authSessionToken, expired: expiredSessionToken, hidden: document.getElementById('session-expired-modal').classList.contains('hidden') };
    });
    assert.deepEqual(stale, { token: 'NEW-LOGIN', expired: '', hidden: true });
    checks.push('late expired response cannot invalidate a newer login');
    await page.evaluate(async () => {
      window.__resetExpiry(); window.fetch = async () => { throw new Error('Failed to fetch'); };
      try { await requestGas('deleteAssignment', {}); } catch (_) {}
    });
    assert.equal(await page.locator('#session-expired-modal').isVisible(), false);
    checks.push('network failure is not mistaken for expired login');
    await page.evaluate(async () => {
      window.__resetExpiry();
      try { await requestGas('deleteAssignment', {}); } catch (_) {}
    });
    await page.screenshot({ path: '/tmp/session-expiry-notice.png' });
    await page.setViewportSize({ width: 320, height: 740 });
    assert.equal(await page.locator('#session-expired-modal > div').evaluate(panel => {
      const rect = panel.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
    }), true);
    checks.push('expiry dialog fits a 320px mobile viewport');
    assert.deepEqual(errors, []); checks.push('no uncaught browser errors');
    fs.writeFileSync(path.join(root, 'audit/session-expiry-results-2026-09-08.json'), JSON.stringify({ scope: 'Mocked local requests only', passed: checks.length, checks }, null, 2));
    console.log(JSON.stringify({ passed: checks.length, checks }));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
