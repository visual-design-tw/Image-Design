const fs = require('node:fs');
const path = require('node:path');
const { createSiteServer } = require('./site-test-server.cjs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { fixture } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..');

async function main() {
  const server = createSiteServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(root, 'index.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const checks = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.route(/https:\/\/script\.(google|googleusercontent)\.com\//, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: { state: fixture(), currentUser: null } }) }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
    await page.evaluate(seed => {
      authEpoch++; state = seed; normalizeStateSchema();
      currentUser = state.Users[2]; authSessionToken = 'TEST-ONLY';
      activeWorkspace = 'team'; activeTab = 'files'; gasConnectionStatus = 'remote';
      cancelQueuedRemoteStateSync();
      requestGas = async () => { throw new Error('Test blocks live writes'); };
      resetAssignmentBrowserFilters();
    }, fixture());
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [group, values] of Object.entries({ submissionMode: ['all', 'file', 'text', 'file-text'], status: ['all', 'pending', 'submitted', 'overdue'] })) {
        for (const value of values) {
          const button = page.locator(`[data-file-pill-button="${group}"][data-pill-value="${value}"]`);
          await button.click();
          const result = await page.locator(`[data-file-pill-group="${group}"]`).evaluate(element => {
            const buttons = Array.from(element.querySelectorAll('button'));
            const active = buttons.filter(button => button.dataset.active === 'true');
            const bounds = element.getBoundingClientRect();
            return {
              active: active.length,
              pressed: buttons.filter(button => button.getAttribute('aria-pressed') === 'true').length,
              floating: element.querySelectorAll('[data-file-pill-indicator]').length,
              background: getComputedStyle(active[0]).backgroundColor,
              inactive: buttons.filter(button => button !== active[0]).map(button => getComputedStyle(button).backgroundColor),
              fits: buttons.every(button => { const rect = button.getBoundingClientRect(); return rect.width < bounds.width / 3 && rect.left >= bounds.left && rect.right <= bounds.right + 1 && button.scrollWidth <= button.clientWidth + 1; })
            };
          });
          assert.equal(result.active, 1); assert.equal(result.pressed, 1); assert.equal(result.floating, 0);
          assert.equal(result.background, 'rgb(255, 255, 255)');
          assert.ok(result.inactive.every(color => color === 'rgba(0, 0, 0, 0)'));
          assert.equal(result.fits, true);
          checks.push(`${width}px ${group}=${value}`);
        }
      }
    }
    await page.evaluate(() => resetAssignmentBrowserFilters());
    const text = page.locator('[data-file-pill-button="submissionMode"][data-pill-value="text"]');
    await text.focus(); await page.keyboard.press('Enter');
    assert.equal(await text.getAttribute('aria-pressed'), 'true');
    assert.equal(await text.evaluate(button => button === document.activeElement), true);
    await page.keyboard.press('Tab'); await page.keyboard.press('Space');
    assert.equal(await page.locator('[data-file-pill-button="submissionMode"][data-pill-value="file-text"]').getAttribute('aria-pressed'), 'true');
    checks.push('keyboard Enter / Tab / Space and focus after redraw');
    await page.evaluate(() => resetAssignmentBrowserFilters());
    assert.equal(await page.evaluate(() => assignmentBrowserState.submissionMode === 'all' && assignmentBrowserState.status === 'all'), true);
    checks.push('reset returns both filters to all');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('[data-file-pill-group="submissionMode"]').screenshot({ path: '/tmp/assignment-filter-mode.png' });
    await page.locator('[data-file-pill-group="status"]').screenshot({ path: '/tmp/assignment-filter-status.png' });
    assert.deepEqual(errors, []); checks.push('no uncaught browser errors');
    console.log(JSON.stringify({ passed: checks.length, checks }));
    fs.writeFileSync(path.join(root, 'audit/assignment-filters-results-2026-09-06.json'), JSON.stringify({ scope: 'Local browser fixtures; no live writes', passed: checks.length, checks }, null, 2));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
