const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { fixture } = require('./stability.test.cjs');
const { createSiteServer } = require('./site-test-server.cjs');

test('workspace layout loads from static CSS under the Pages subdirectory without third-party network access', async () => {
  const base = '/Image-Design/';
  const html = fs.readFileSync(path.join(__dirname, '../index.html'));
  const server = createSiteServer((req, res) => {
    if (req.url !== base) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = [], tailwindRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => {
      if (new URL(route.request().url()).hostname === 'cdn.tailwindcss.com') tailwindRequests.push(route.request().url());
      return route.abort();
    });
    const url = 'http://127.0.0.1:' + server.address().port + base;
    const [style] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === base + 'workspace.css'),
      page.goto(url, { waitUntil: 'load' })
    ]);
    assert.equal(style.status(), 200);
    assert.match(style.headers()['content-type'], /^text\/css/);
    await page.locator('#login-email').waitFor();
    assert.equal(await page.locator('#dashboard-section').isVisible(), false);
    assert.equal(await page.locator('#login-email').evaluate(input => getComputedStyle(input).paddingLeft), '16px');
    await page.locator('#login-email').focus();
    await page.waitForFunction(() => getComputedStyle(document.getElementById('login-email')).borderColor === 'rgb(0, 102, 204)');

    await page.evaluate(seed => {
      authEpoch++;
      state = seed;
      normalizeStateSchema();
      currentUser = state.Users[0];
      activeWorkspace = 'admin';
      activeTab = 'design-service';
      gasConnectionStatus = 'remote';
      renderAll();
    }, fixture());
    const settings = page.getByRole('button', { name: '接案設定' });
    await settings.waitFor();
    assert.equal(await page.locator('#auth-section').isVisible(), false);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await settings.click();
      const dialog = page.locator('#design-service-settings-modal');
      const save = dialog.getByRole('button', { name: '儲存設定' });
      assert.equal(await save.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(0, 102, 204)');
      assert.equal(await dialog.evaluate(el => getComputedStyle(el).backdropFilter), 'blur(4px)');
      const bounds = await dialog.locator(':scope > div').boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      await dialog.getByRole('button', { name: '取消' }).click();
    }
    assert.deepEqual(tailwindRequests, []);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
