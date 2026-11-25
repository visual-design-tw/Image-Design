const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createSiteServer } = require('./site-test-server.cjs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const results = [], errors = [], requests = [];
const assets = {
  lucide: ['https://unpkg.com/lucide@1.61.0/dist/umd/lucide.js', 'a833f6089e246486aad9d3ae7e58e64779c5113e6e8e0c145cb3e3d483f588c9'],
  anime: ['https://cdn.jsdelivr.net/npm/animejs@4.5.0/dist/bundles/anime.umd.min.js', '8d5b3a58a1f64023a04a4cedeef135a2263b18da04b35177ac13438a0bad033b'],
  morph: ['https://esm.sh/morphicons@1.7.1/es2022/element.bundle.mjs', 'd2c7ee3b1db27a8166e246bf36b5d48d47257579098fe0712cb7a71abe76424a']
};
const artifacts = process.env.MOTION_ARTIFACT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'image-design-motion-results-'));
fs.mkdirSync(artifacts, { recursive: true });
async function test(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error('FAIL ' + name + '\n' + error.stack); }
}
async function run() {
  const cache = {};
  for (const [key, [url, hash]] of Object.entries(assets)) {
    if (process.env.MOTION_ASSET_DIR) cache[key] = fs.readFileSync(path.join(process.env.MOTION_ASSET_DIR, key + '.js'));
    else { const r = await fetch(url); assert.ok(r.ok); cache[key] = Buffer.from(await r.arrayBuffer()); }
    if (hash) assert.equal(crypto.createHash('sha256').update(cache[key]).digest('hex'), hash, key + ' version changed');
  }
  const server = createSiteServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(root, req.url.startsWith('/large-upload') ? 'large-upload.html' : 'index.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const contexts = [];
  async function open(options = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: options.reduced ? 'reduce' : 'no-preference' });
    contexts.push(context);
    let releaseUpload;
    const heldUpload = new Promise(resolve => { releaseUpload = resolve; });
    await context.route('https://**/*', async route => {
      const url = route.request().url();
      const key = url.includes('lucide@') ? 'lucide' : url.includes('animejs') ? 'anime' : url.includes('esm.sh') ? 'morph' : null;
      if (key) {
        if ((options.noMorph && key === 'morph') || (options.noIcons && key === 'lucide') || (options.noAnime && key === 'anime')) return route.abort();
        if (key === 'morph' && options.delayMorph) await new Promise(r => setTimeout(r, options.delayMorph));
        return route.fulfill({ contentType: 'text/javascript', body: cache[key] });
      }
      if (url.includes('script.google') || url.includes('script.googleusercontent')) {
        const payload = route.request().method() === 'POST' ? JSON.parse(route.request().postData()) : Object.fromEntries(new URL(url).searchParams);
        requests.push(payload.action);
        if (payload.action === 'startResumableLargeUpload' || payload.action === 'uploadAssignmentAsset') {
          await heldUpload;
          return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, error: { message: 'Isolated upload interruption' } }) }).catch(() => {});
        }
        const data = payload.action === 'largeUploadModel'
          ? { mode: 'assignment-asset', sessionToken: 'SYNTHETIC_MOTION', sessionKey: 'SYNTHETIC_MOTION', title: 'Animation test only', pathLabel: 'Synthetic folder', maxDirectMb: 18, maxResumableMb: 2048 }
          : { registrationOptions: { leader: true, member: true, activation: true, shapePrint: true }, registrationOptionsRevision: 1 };
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
      }
      return route.abort();
    });
    const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + (options.large ? '/large-upload.html' : '/'), { waitUntil: options.delayMorph ? 'domcontentloaded' : 'load' });
    if (options.large) await page.locator('#large-upload-form').waitFor({ state: 'visible' });
    if (!options.noMorph && !options.delayMorph) await page.waitForFunction(() => Boolean(customElements.get('morph-icon')));
    if (!options.large) await page.waitForFunction(() => document.querySelector('#btn-login-submit [data-morph-icon]')?.dataset.morphVisual);
    return { page, releaseUpload };
  }
  async function inspect(page, selector) {
    return page.locator(selector).evaluate(el => ({
      kind: el.dataset.morphVisual, children: el.children.length, svg: el.querySelectorAll('svg').length,
      paths: el.querySelectorAll('path').length, other: el.querySelectorAll('line,polyline,polygon,circle,rect').length,
      spinners: el.querySelectorAll('.managed-icon-spinner').length,
      animation: getComputedStyle(el.querySelector('.managed-icon-spinner') || el).animationName,
      width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height,
      display: getComputedStyle(el).display, html: el.innerHTML
    }));
  }
  try {
    const { page } = await open();
    const login = '#btn-login-submit [data-morph-icon]';
    await test('real libraries mount one canonical path, not a partial multi-shape fallback', async () => {
      const v = await inspect(page, login); assert.equal(v.kind, 'morph'); assert.equal(v.children, 1);
      assert.equal(v.svg, 1); assert.equal(v.paths, 1); assert.equal(v.other, 0); assert.notEqual(v.display, 'contents'); assert.equal(v.width, 16);
    });
    await test('login loading is one independent ring immediately and after settling', async () => {
      await page.evaluate(() => setLoginSubmitting(true));
      for (const delay of [0, 80, 600]) {
        if (delay) await page.waitForTimeout(delay);
        const v = await inspect(page, login); assert.equal(v.spinners, 1); assert.equal(v.svg, 0); assert.equal(v.children, 1); assert.equal(v.animation, 'morph-icon-spin'); assert.ok(Math.abs(v.width - 16) < 0.3);
      }
      assert.equal(await page.locator('#btn-login-submit').getAttribute('aria-busy'), 'true');
      await page.locator('#btn-login-submit').screenshot({ path: path.join(artifacts, 'login-loading.png') });
      await page.evaluate(() => setLoginSubmitting(false));
      assert.equal((await inspect(page, login)).paths, 1);
    });
    await test('every configured purpose and state retains exactly one visual through repeated renders', async () => {
      const findings = await page.evaluate(() => {
        const gallery = document.createElement('div'); gallery.id = 'motion-test-gallery'; document.body.appendChild(gallery);
        const failures = [];
        for (const [purpose, states] of Object.entries(MORPH_ICON_CONFIG)) {
          gallery.insertAdjacentHTML('beforeend', renderMorphIconMarkup(purpose, Object.keys(states)[0], 'h-4 w-4'));
          const el = gallery.lastElementChild;
          for (const state of [...Object.keys(states), ...Object.keys(states).reverse()]) {
            setMorphIconState(el, state); hydrateMorphIcons(el); renderLucideIcons();
            const expected = state === 'loading' ? el.querySelectorAll('.managed-icon-spinner').length === 1 && el.querySelectorAll('svg').length === 0
              : el.querySelectorAll('svg').length === 1 && el.querySelectorAll('path').length === 1 && el.querySelectorAll('line,polyline,circle,rect').length === 0;
            if (!expected || el.children.length !== 1) failures.push(purpose + ':' + state);
          }
        }
        return failures;
      });
      assert.deepEqual(findings, []);
    });
    await test('fast state changes settle on the final non-loading icon without stale animation', async () => {
      await page.evaluate(() => { const el = document.querySelector('#btn-login-submit [data-morph-icon]');
        for (let i = 0; i < 40; i++) { setMorphIconState(el, 'loading'); setMorphIconState(el, 'error'); setMorphIconState(el, 'login'); }
      });
      await page.waitForTimeout(1300); const v = await inspect(page, login);
      assert.equal(v.spinners, 0); assert.equal(v.paths, 1); assert.equal(v.other, 0); assert.equal(v.animation, 'none');
      assert.ok(!/NaN|Infinity/.test(v.html));
    });
    await test('a thrown transition restores a complete static icon and can recover cleanly', async () => {
      const kinds = await page.evaluate(() => {
        const el = document.querySelector('#btn-login-submit [data-morph-icon]');
        el.querySelector('[data-morph-renderer]').morphTo = function() { throw new Error('Synthetic transition interruption'); };
        setMorphIconState(el, 'error'); const fallback = el.dataset.morphVisual;
        setMorphIconState(el, 'login');
        return [fallback, el.dataset.morphVisual, el.children.length, el.querySelectorAll('svg').length];
      });
      assert.deepEqual(kinds, ['fallback', 'morph', 1, 1]);
    });
    await test('a replaced visual is rebuilt instead of writing to a detached stale path', async () => {
      await page.evaluate(() => {
        const el = document.querySelector('#btn-login-submit [data-morph-icon]');
        el.replaceChildren(document.createElement('i')); hydrateMorphIcons(el);
      });
      const v = await inspect(page, login); assert.equal(v.kind, 'morph'); assert.equal(v.children, 1); assert.equal(v.paths, 1);
    });
    await test('rapid select and password toggles keep Morphicons and correct endpoint geometry', async () => {
      for (const [purpose, a, b] of [['select-chevron', 'chevron-down', 'chevron-up'], ['password-visibility', 'eye', 'eye-off'], ['topbar-menu', 'menu', 'close']]) {
        const value = await page.evaluate(({ purpose, a, b }) => {
          const host = document.createElement('div'); host.innerHTML = renderMorphIconMarkup(purpose, a, 'h-4 w-4'); document.body.appendChild(host);
          const el = host.firstElementChild; setMorphIconState(el, a);
          for (let i = 0; i < 20; i++) { setMorphIconState(el, b); setMorphIconState(el, a); }
          return el.querySelectorAll('svg').length;
        }, { purpose, a, b }); assert.equal(value, 1);
      }
      await page.waitForTimeout(1400);
      assert.equal(await page.locator('[data-morph-renderer] path').evaluateAll(paths => paths.some(p => /NaN|Infinity/.test(p.getAttribute('d') || ''))), false);
    });
    await test('auth panel and centered modal open/close do not retain hidden transforms', async () => {
      await page.evaluate(() => { const surface = document.getElementById('site-info-modal'); animateSurfaceOpen(surface, surface.firstElementChild); });
      await page.waitForFunction(() => getComputedStyle(document.getElementById('site-info-modal').firstElementChild).filter === 'none');
      const open = await page.locator('#site-info-modal').evaluate(el => ({ visible: getComputedStyle(el).display !== 'none', opacity: getComputedStyle(el).opacity, filter: getComputedStyle(el.firstElementChild).filter }));
      assert.equal(open.visible, true); assert.equal(open.opacity, '1'); assert.equal(open.filter, 'none');
      await page.evaluate(() => { const el = document.getElementById('site-info-modal'); animateSurfaceClose(el, el.firstElementChild); });
      await page.waitForTimeout(350); assert.equal(await page.locator('#site-info-modal').isVisible(), false);
    });
    await test('rapid modal close and reopen leaves only the final requested visibility', async () => {
      await page.evaluate(() => {
        const el = document.getElementById('site-info-modal');
        for (let i = 0; i < 8; i++) { animateSurfaceOpen(el, el.firstElementChild); animateSurfaceClose(el, el.firstElementChild); }
        animateSurfaceOpen(el, el.firstElementChild);
      });
      await page.waitForFunction(() => getComputedStyle(document.getElementById('site-info-modal').firstElementChild).filter === 'none');
      assert.equal(await page.locator('#site-info-modal').isVisible(), true);
      await page.evaluate(() => { const el = document.getElementById('site-info-modal'); animateSurfaceClose(el, el.firstElementChild); });
      await page.waitForTimeout(350); assert.equal(await page.locator('#site-info-modal').isVisible(), false);
    });
    await test('late module availability never appends a second icon or changes a pending ring', async () => {
      const slow = await open({ delayMorph: 1000 });
      await slow.page.evaluate(() => setLoginSubmitting(true));
      await slow.page.waitForFunction(() => window.__morphiconsReady === true);
      await slow.page.waitForTimeout(150); const v = await inspect(slow.page, login);
      assert.equal(v.spinners, 1); assert.equal(v.svg, 0); assert.equal(v.children, 1);
      await slow.page.evaluate(() => setLoginSubmitting(false)); assert.equal((await inspect(slow.page, login)).paths, 1);
    });
    await test('Morphicons failure keeps static complete icons and a working single loading ring', async () => {
      const fail = await open({ noMorph: true });
      let v = await inspect(fail.page, login); assert.equal(v.kind, 'fallback'); assert.equal(v.svg, 1); assert.ok(v.paths > 1);
      await fail.page.evaluate(() => setLoginSubmitting(true)); v = await inspect(fail.page, login); assert.equal(v.spinners, 1); assert.equal(v.svg, 0);
      await fail.page.evaluate(() => setLoginSubmitting(false)); v = await inspect(fail.page, login); assert.equal(v.kind, 'fallback'); assert.equal(v.children, 1);
    });
    await test('spinner still works when both icon dependencies are unavailable', async () => {
      const fail = await open({ noMorph: true, noIcons: true }); await fail.page.evaluate(() => setLoginSubmitting(true));
      assert.equal((await inspect(fail.page, login)).spinners, 1);
    });
    await test('Anime.js failure leaves auth and modal controls usable without invisible styles', async () => {
      const fail = await open({ noAnime: true }); await fail.page.evaluate(() => { setLoginSubmitting(true); setLoginSubmitting(false); const el = document.getElementById('site-info-modal'); animateSurfaceOpen(el, el.firstElementChild); });
      assert.equal(await fail.page.locator('#site-info-modal').isVisible(), true);
      await fail.page.evaluate(() => { const el = document.getElementById('site-info-modal'); animateSurfaceClose(el, el.firstElementChild); });
      assert.equal(await fail.page.locator('#site-info-modal').isVisible(), false);
    });
    await test('reduced-motion disables the ring rotation but preserves text and state', async () => {
      const reduced = await open({ reduced: true }); await reduced.page.evaluate(() => setLoginSubmitting(true));
      const v = await inspect(reduced.page, login); assert.equal(v.spinners, 1); assert.equal(v.animation, 'none');
      assert.match(await reduced.page.locator('#btn-login-submit').innerText(), /登入中/);
    });
    for (const width of [320, 390, 768, 1440]) await test('icon dimensions and single indicator at viewport ' + width, async () => {
      await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => setLoginSubmitting(true));
      const v = await inspect(page, login); assert.equal(v.spinners, 1); assert.ok(Math.abs(v.width - v.height) < 0.1); assert.ok(v.width > 13 && v.width < 17);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.evaluate(() => setLoginSubmitting(false));
    });
    await test('real large-upload button remains a single ring throughout a held chunk request and retry', async () => {
      const large = await open({ large: true }); const p = large.page;
      await p.locator('#upload-file').setInputFiles({ name: 'synthetic-animation.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(19 * 1024 * 1024) });
      await p.locator('#submit-button').click();
      for (const delay of [0, 100, 900]) { if (delay) await p.waitForTimeout(delay); const v = await inspect(p, '#upload-submit-icon'); assert.equal(v.spinners, 1); assert.equal(v.svg, 0); assert.equal(v.children, 1); }
      assert.match(await p.locator('#submit-label').innerText(), /分段上傳中/);
      await p.locator('#submit-button').screenshot({ path: path.join(artifacts, 'chunk-upload-loading.png') });
      await p.setViewportSize({ width: 390, height: 844 }); await p.screenshot({ path: path.join(artifacts, 'large-upload-mobile.png') });
      large.releaseUpload(); await p.waitForFunction(() => document.getElementById('submit-label').textContent.includes('重試'));
      const v = await inspect(p, '#upload-submit-icon'); assert.equal(v.spinners, 0); assert.equal(v.paths, 1); assert.equal(v.other, 0); assert.equal(v.children, 1);
      assert.equal(await p.locator('#submit-button').isEnabled(), true);
    });
    await test('large upload also degrades safely without Morphicons and with reduced motion', async () => {
      const large = await open({ large: true, noMorph: true, reduced: true }); const p = large.page;
      await p.locator('#upload-file').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('synthetic') });
      await p.locator('#submit-button').click(); const v = await inspect(p, '#upload-submit-icon'); assert.equal(v.spinners, 1); assert.equal(v.animation, 'none');
      large.releaseUpload();
    });
    await test('the two standalone pages use identical managed-renderer lifecycle logic', () => {
      const helper = file => fs.readFileSync(path.join(root, file), 'utf8').match(/const managedIconStates = new WeakMap\(\);[\s\S]*?(?=\n        function (?:isMorphIconElement|getUploadMorphIconInput))/)[0].trim();
      assert.equal(helper('index.html'), helper('large-upload.html'));
    });
    await test('no unexpected production actions or uncaught animation errors', () => {
      assert.deepEqual(errors, []);
      assert.ok(requests.every(action => ['getRegistrationOptions', 'largeUploadModel', 'startResumableLargeUpload', 'uploadAssignmentAsset'].includes(action)), JSON.stringify(requests));
    });
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
  const report = { isolated: true, productionWrites: 0, actualLibraries: assets, sources: {}, results, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length };
  for (const file of ['index.html', 'large-upload.html', 'gas/Code.gs']) report.sources[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ passed: report.passed, failed: report.failed, artifacts }));
  if (report.failed) process.exitCode = 1;
}
run().catch(error => { console.error(error); process.exitCode = 1; });
