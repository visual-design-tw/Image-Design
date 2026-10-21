const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const { fixture, backend } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const results = [];
const image = new PNG({ width: 420, height: 260 });
for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
  const offset = (y * image.width + x) * 4;
  const card = x > 30 && x < 390 && y > 30 && y < 230;
  image.data.set(card ? [235, 244, 255, 255] : [0, 102, 204, 255], offset);
}
const png = PNG.sync.write(image);
const driveA = 'SYNTHETIC_DRIVE_IMAGE_A';
const driveB = 'SYNTHETIC_DRIVE_IMAGE_B';
const blob = (bytes = png, type = 'image/png') => ({ getBytes: () => Array.from(bytes), getContentType: () => type });
async function test(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error('FAIL ' + name + '\n' + error.stack); }
}
function seed() {
  const state = fixture();
  state.Files = [1, 2].map((version, i) => ({ File_ID: 'F0' + version, Stage_ID: 'S01', Team_ID: 'T02',
    User_ID: 'U03', File_Name: 'preview-fixture.png', Base_File_Name: 'preview-fixture.png', File_Group_Key: 'preview-fixture',
    Version_No: version, Version_Label: 'V' + version, Upload_Time: '2026-10-21 19:00',
    Drive_File_ID: i ? driveB : driveA, Google_Drive_URL: 'https://drive.google.com/file/d/' + (i ? driveB : driveA) + '/view' }));
  state.Assignment_Submissions = [{ Submission_ID: 'SUB01', Assignment_ID: 'A01', Team_ID: 'T02', User_ID: 'U03',
    File_Name: 'preview-fixture.png', Drive_File_ID: driveA, Google_Drive_URL: state.Files[0].Google_Drive_URL }];
  state.Assignment_Resources = [{ Resource_ID: 'AR01', Assignment_ID: 'A01', File_Name: 'template.png', Drive_File_ID: driveA }];
  state.Design_Service_Orders = [{ Service_Order_ID: 'DS01', Team_ID: 'T02', File_Name: 'design.png', Drive_File_ID: driveA }];
  return state;
}
function context() {
  const c = backend();
  c.db = c.normalizeState_(seed());
  c.getConfig_ = () => ({ timeZone: 'Asia/Taipei', driveRootFolderId: 'ROOT_FIXTURE' });
  c.persistState_ = () => { throw new Error('Preview must never save state'); };
  c.requireSessionUser_ = (state, payload) => {
    const actor = state.Users.find(user => payload.sessionToken === 'SYNTHETIC_' + user.User_ID && user.Status === 'Active');
    if (!actor) throw new Error('AUTH_EXPIRED');
    return actor;
  };
  c.Utilities.base64Encode = bytes => Buffer.from(bytes).toString('base64');
  c.jsonResponse_ = (ok, data, error) => ({ ok, data, error: error ? { message: error.message } : null });
  c.calls = [];
  c.file = { getParents: () => { let used = false; return { hasNext: () => !used,
    next: () => { used = true; return { getId: () => 'ROOT_FIXTURE' }; } }; },
    isTrashed: () => false, getSize: () => png.length, getMimeType: () => 'image/png',
    getBlob: () => { c.calls.push('blob'); return blob(); },
    getThumbnail: () => { c.calls.push('thumbnail'); return blob(); } };
  c.DriveApp = { getFileById: id => { c.calls.push(id); return c.file; } };
  return c;
}
const payload = (extra = {}) => ({ recordType: 'assignment-submission', recordId: 'SUB01', sessionToken: 'SYNTHETIC_U03', ...extra });
function dispatch(c, input) { return c.doPost({ postData: { contents: JSON.stringify({ action: 'getFilePreview', ...input }) } }); }
async function backendTests() {
  await test('private image reads the authorized server record without changing data or sharing', () => {
    const c = context(), before = clone(c.db);
    const response = dispatch(c, payload({ driveFileId: 'ATTACKER_SUPPLIED_ID', url: 'https://evil.invalid' }));
    assert.equal(response.ok, true);
    assert.deepEqual(Buffer.from(response.data.contentBase64, 'base64'), png);
    assert.equal(response.data.driveFileId, driveA);
    assert.equal(response.data.byteLength, png.length);
    assert.equal(response.data.previewMode, 'original');
    assert.equal(response.data.sessionToken, undefined);
    assert.equal(response.data.state, undefined);
    assert.deepEqual(c.calls, [driveA, 'blob']);
    assert.deepEqual(clone(c.db), before);
  });
  await test('files, submissions, assignment resources and design deliverables all resolve by record ID', () => {
    const c = context();
    for (const [recordType, recordId] of [['file', 'F01'], ['assignment-submission', 'SUB01'], ['assignment-resource', 'AR01'], ['design-service', 'DS01']]) {
      assert.equal(dispatch(c, payload({ recordType, recordId })).data.driveFileId, driveA);
    }
    c.db.Files[0].Drive_File_ID = '';
    assert.equal(dispatch(c, payload({ recordType: 'file', recordId: 'F01' })).data.driveFileId, driveA);
  });
  await test('another student team cannot read a guessed record ID or supplied Drive ID', () => {
    const c = context();
    for (const [recordType, recordId] of [['file', 'F01'], ['assignment-submission', 'SUB01'], ['design-service', 'DS01']]) {
      assert.throws(() => c.handleGetFilePreview_(payload({ recordType, recordId, sessionToken: 'SYNTHETIC_U02', driveFileId: driveA })), /PREVIEW_NOT_FOUND/);
    }
    assert.equal(c.calls.length, 0);
  });
  await test('assignment template preview follows the applicable target teams', () => {
    const c = context();
    c.db.Assignments[0].Target_Mode = 'selected'; c.db.Assignments[0].Target_Team_IDs = ['T01'];
    assert.throws(() => c.handleGetFilePreview_(payload({ recordType: 'assignment-resource', recordId: 'AR01' })), /PREVIEW_NOT_FOUND/);
    assert.equal(c.calls.length, 0);
    assert.equal(c.handleGetFilePreview_(payload({ recordType: 'assignment-resource', recordId: 'AR01', sessionToken: 'SYNTHETIC_U02' })).driveFileId, driveA);
  });
  await test('shape-print staff retain their existing viewing permission', () => {
    const c = context();
    for (const user of ['U01', 'U04']) assert.equal(c.handleGetFilePreview_(payload({ sessionToken: 'SYNTHETIC_' + user })).driveFileId, driveA);
  });
  await test('expired sessions and unassigned students are rejected before Drive access', () => {
    const c = context();
    assert.throws(() => c.handleGetFilePreview_(payload({ sessionToken: 'EXPIRED_FIXTURE' })), /AUTH_EXPIRED/);
    c.db.Users[2].Team_ID = ''; c.db.Assignment_Submissions[0].Team_ID = '';
    assert.throws(() => c.handleGetFilePreview_(payload()), /PREVIEW_NOT_FOUND/);
    assert.equal(c.calls.length, 0);
  });
  await test('unknown types, prototype keys and missing or removed records never fetch Drive', () => {
    const c = context();
    for (const input of [{ recordType: '__proto__' }, { recordType: 'constructor' }, { recordId: 'REMOVED' }, { recordId: '' }, { recordId: 'x'.repeat(201) }]) {
      assert.throws(() => c.handleGetFilePreview_(payload(input)), /PREVIEW_NOT_FOUND/);
    }
    assert.equal(c.calls.length, 0);
  });
  await test('files outside the managed root and trashed files are not read', () => {
    for (const trashed of [false, true]) {
      const c = context();
      if (trashed) c.file.isTrashed = () => true;
      else c.file.getParents = () => ({ hasNext: () => false });
      assert.throws(() => c.handleGetFilePreview_(payload()), /PREVIEW_UNAVAILABLE/);
      assert.deepEqual(c.calls, [driveA]);
    }
  });
  await test('large images use a bounded Drive thumbnail without loading the full original', () => {
    const c = context(); c.file.getSize = () => 200 * 1024 * 1024;
    assert.equal(c.handleGetFilePreview_(payload()).previewMode, 'thumbnail');
    assert.deepEqual(c.calls, [driveA, 'thumbnail']);
  });
  await test('SVG and non-raster originals are never served as active content', () => {
    const c = context(); c.file.getMimeType = () => 'image/svg+xml';
    const result = c.handleGetFilePreview_(payload());
    assert.equal(result.previewMode, 'thumbnail'); assert.equal(result.mimeType, 'image/png');
    assert.ok(!c.calls.includes('blob'));
  });
  await test('missing, oversized, empty and unsafe thumbnail results fail clearly', () => {
    for (const thumb of [null, blob(Buffer.alloc(2 * 1024 * 1024 + 1)), blob(Buffer.alloc(0)), blob(Buffer.from('<svg/>'), 'image/svg+xml')]) {
      const c = context(); c.file.getSize = () => 100 * 1024 * 1024; c.file.getThumbnail = () => thumb;
      assert.throws(() => c.handleGetFilePreview_(payload()), /PREVIEW_UNAVAILABLE/);
    }
  });
  await test('a changed-size original and unknown binary MIME cannot produce an unbounded response', () => {
    const c = context(); c.file.getBlob = () => blob(Buffer.alloc(6 * 1024 * 1024 + 1));
    assert.throws(() => c.handleGetFilePreview_(payload()), /PREVIEW_UNAVAILABLE/);
    c.file.getBlob = () => blob(png, 'text/html');
    assert.throws(() => c.handleGetFilePreview_(payload()), /PREVIEW_UNAVAILABLE/);
  });
  await test('Drive errors do not expose service internals in preview responses', () => {
    const c = context(); c.file.getBlob = () => { throw new Error('PRIVATE_INTERNAL_DIAGNOSTIC'); };
    const response = dispatch(c, payload());
    assert.equal(response.ok, false); assert.match(response.error.message, /PREVIEW_UNAVAILABLE/);
    assert.ok(!JSON.stringify(response).includes('PRIVATE_INTERNAL_DIAGNOSTIC'));
  });
}

async function browserTests() {
  const c = context(), requests = [], googleRequests = [];
  let mode = 'normal', delay = 0, mismatch = false;
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fs.readFileSync(path.join(root, 'index.html'))); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const client = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', timezoneId: 'Asia/Taipei' });
    await client.route(/https:\/\/script\.(google|googleusercontent)\.com\//, async route => {
      const input = route.request().method() === 'POST' ? JSON.parse(route.request().postData()) : {};
      if (input.action !== 'getFilePreview') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: { state: seed() } }) });
      requests.push({ input, method: route.request().method(), url: route.request().url() });
      const localMode = mode, localMismatch = mismatch;
      let response = dispatch(c, input);
      if (localMode === 'error') response = { ok: false, error: { message: 'PREVIEW_UNAVAILABLE: Google 尚未提供預覽圖，請在 Drive 開啟。' } };
      if (localMode === 'legacy') response = { ok: false, error: { message: 'Unsupported POST action: getFilePreview' } };
      if (localMode === 'expired') response = { ok: false, error: { message: 'AUTH_EXPIRED' } };
      if (response.ok && localMode === 'corrupt') { response.data.contentBase64 = Buffer.from('Not an image').toString('base64'); response.data.byteLength = 12; }
      if (response.ok && localMode === 'thumbnail') response.data.previewMode = 'thumbnail';
      if (response.ok && localMismatch) response.data.driveFileId = 'WRONG_FIXTURE_DRIVE';
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      try {
        if (localMode === 'network') return await route.abort();
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
      } catch (error) { if (!/closed|disposed/i.test(error.message)) throw error; }
    });
    await client.route('https://drive.google.com/**', async route => {
      googleRequests.push(route.request().url());
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><p>Isolated Drive viewer</p>' });
    });
    const page = await client.newPage(); page.setDefaultTimeout(10000);
    const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'load' });
    const reset = async () => {
      mode = 'normal'; delay = 0; mismatch = false;
      await page.evaluate(next => {
        authEpoch++; clearFilePreviewSurfaces(); cancelQueuedRemoteStateSync();
        state = next; normalizeStateSchema(); currentUser = state.Users.find(user => user.User_ID === 'U03');
        authSessionToken = 'SYNTHETIC_U03'; expiredSessionToken = ''; activeWorkspace = 'team'; activeTab = 'files';
        document.getElementById('session-expired-modal').classList.add('hidden');
        document.getElementById('toast-notif').classList.add('opacity-0');
        remoteSaveInFlight = false; remoteSavePromise = null; pendingRemoteSave = false; remoteMutationInFlight = false;
        workspaceHydrationInFlight = false; setSaveFeedback('idle', ''); renderAll();
        window.previewRevoked = []; const original = URL.revokeObjectURL.bind(URL);
        if (!window.previewRevokeInstalled) { window.previewRevokeInstalled = true; URL.revokeObjectURL = url => { window.previewRevoked.push(url); original(url); }; }
      }, seed());
    };
    const open = () => page.evaluate(() => openFilePreview('assignment-submission', 'SUB01'));
    const reader = page.locator('#file-preview-modal [data-file-preview-reader]');
    const ready = () => reader.locator('img').waitFor({ state: 'visible' });
    await reset();
    await test('actual raster bytes decode in the image instead of a direct Drive image request', async () => {
      await open(); await ready();
      assert.equal(await reader.locator('img').evaluate(img => img.naturalWidth), 420);
      assert.match(await reader.locator('img').getAttribute('src'), /^blob:/);
      assert.equal(await reader.getAttribute('aria-busy'), 'false');
      assert.equal(googleRequests.length, 0);
      assert.equal(requests.at(-1).method, 'POST');
      assert.ok(!requests.at(-1).url.includes('SYNTHETIC_'));
      assert.equal(requests.at(-1).input.driveFileId, undefined);
      if (process.env.PREVIEW_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.PREVIEW_ARTIFACT_DIR, 'preview-desktop.png') });
    });
    await test('preview is a read and does not save or discard an unrelated unsaved draft', async () => {
      await page.evaluate(() => { pendingRemoteSave = true; state.Assignments[0].Body = 'Retained unsaved fixture'; renderFilePreviewModal(); });
      await ready();
      assert.equal(await page.evaluate(() => pendingRemoteSave), true);
      assert.equal(await page.evaluate(() => state.Assignments[0].Body), 'Retained unsaved fixture');
      await page.evaluate(() => { pendingRemoteSave = false; });
    });
    await test('loading has one indicator and repeat retries cannot duplicate the request', async () => {
      await reset(); delay = 300; const before = requests.length;
      await open();
      assert.equal(await reader.locator('[aria-hidden="true"]').count(), 1);
      await page.evaluate(() => document.querySelectorAll('[data-file-preview-reader]').forEach(node => { loadFilePreviewImage(node); loadFilePreviewImage(node); }));
      await ready(); assert.equal(requests.length - before, 1); delay = 0;
    });
    await test('cloud failure explains next actions; a deliberate retry loads the image', async () => {
      await reset(); mode = 'error'; await open();
      await reader.getByRole('button', { name: '重新載入圖片' }).waitFor();
      assert.match(await reader.innerText(), /Google 尚未提供/);
      assert.equal(await reader.locator('img').count(), 0);
      mode = 'normal'; await reader.getByRole('button', { name: '重新載入圖片' }).click(); await ready();
    });
    await test('unsupported old backend does not fall back to a broken direct link', async () => {
      await reset(); mode = 'legacy'; await open();
      await reader.getByRole('button', { name: '重新載入圖片' }).waitFor();
      assert.match(await reader.innerText(), /發布新版雲端/); assert.equal(await reader.locator('img').count(), 0);
    });
    await test('mismatched receipts and corrupt image bytes cannot show a broken image', async () => {
      for (const bad of ['mismatch', 'corrupt']) {
        await reset(); mismatch = bad === 'mismatch'; if (bad === 'corrupt') mode = 'corrupt'; await open();
        await reader.getByRole('button', { name: '重新載入圖片' }).waitFor();
        assert.equal(await reader.locator('img').count(), 0);
      }
      assert.ok(await page.evaluate(() => previewRevoked.length > 0));
    });
    await test('network failure presents retry instead of an empty panel', async () => {
      await reset(); mode = 'network'; await open();
      await reader.getByRole('button', { name: '重新載入圖片' }).waitFor();
      assert.match(await reader.innerText(), /連線/);
    });
    await test('closing revokes the temporary image URL and removes the decoded image', async () => {
      await reset(); await open(); await ready();
      const url = await reader.locator('img').getAttribute('src');
      await page.locator('#file-preview-modal button[aria-label]').click();
      assert.equal(await page.locator('#file-preview-modal img').count(), 0);
      assert.ok(await page.evaluate(url => previewRevoked.includes(url), url));
      assert.equal(await page.evaluate(() => filePreviewReaders.size), 0);
    });
    await test('a late response after closing cannot recreate the image', async () => {
      await reset(); delay = 400; const before = requests.length; await open();
      await page.waitForFunction(count => window.performance && document.querySelector('[data-file-preview-reader]')?.dataset.previewState === 'loading', before);
      await page.evaluate(() => closeFilePreviewModal());
      await new Promise(resolve => setTimeout(resolve, 600));
      assert.equal(await page.locator('#file-preview-modal img').count(), 0);
      assert.equal(await page.evaluate(() => filePreviewReaders.size), 0);
    });
    await test('version comparison loads both images and disposes obsolete selections', async () => {
      await reset();
      await page.evaluate(() => openFileVersionComparison(state.Files[0].File_Group_Key));
      const comparison = page.locator('#file-compare-modal');
      await page.waitForFunction(() => document.querySelectorAll('#file-compare-modal [data-preview-state="ready"]').length === 2);
      assert.equal(await comparison.locator('img').count(), 2);
      await page.evaluate(() => setFileVersionComparisonSide('leftId', 'F02'));
      await page.waitForFunction(() => document.querySelectorAll('#file-compare-modal [data-preview-state="ready"]').length === 2);
      assert.ok(await page.evaluate(() => previewRevoked.length >= 2));
      await page.locator('#file-compare-modal button[aria-label]').click();
      assert.equal(await page.evaluate(() => filePreviewReaders.size), 0);
    });
    await test('session expiry, logout and workspace change dispose private images', async () => {
      for (const action of ['expiry', 'clear', 'workspace']) {
        await reset(); await open(); await ready();
        await page.evaluate(action => { if (action === 'expiry') showSessionExpiredNotice(); else if (action === 'clear') clearStoredSession(); else toggleWorkspace('admin'); }, action);
        assert.equal(await page.locator('#file-preview-modal img').count(), 0);
        assert.equal(await page.evaluate(() => filePreviewReaders.size), 0);
        assert.ok(await page.evaluate(() => previewRevoked.length > 0));
      }
    });
    await test('preview auth failure invokes the existing re-login flow without displaying bytes', async () => {
      await reset(); mode = 'expired'; await open();
      await page.locator('#session-expired-modal').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#file-preview-modal img').count(), 0);
    });
    await test('large-image thumbnail is labelled clearly at mobile width without overflow', async () => {
      await reset(); await page.setViewportSize({ width: 390, height: 844 }); mode = 'thumbnail'; await open(); await ready();
      assert.match(await reader.innerText(), /較小的預覽圖/);
      const geometry = await page.evaluate(() => { const panel = document.querySelector('#file-preview-modal > div').getBoundingClientRect(); return { left: panel.left, right: panel.right, width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth }; });
      assert.ok(geometry.left >= 0 && geometry.right <= geometry.width + 1); assert.equal(geometry.overflow, false);
      assert.equal(await page.locator('#session-expired-modal').isVisible(), false);
      if (process.env.PREVIEW_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.PREVIEW_ARTIFACT_DIR, 'preview-mobile.png') });
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await test('PDF viewer retains a safe external fallback and malformed links cannot break the modal', async () => {
      await reset();
      await page.evaluate(() => { state.Assignment_Submissions[0].File_Name = 'fixture.pdf'; openFilePreview('assignment-submission', 'SUB01'); });
      const modal = page.locator('#file-preview-modal');
      assert.equal(await modal.locator('iframe').count(), 1); assert.match(await modal.innerText(), /要求登入/);
      assert.equal(await modal.locator('a').getAttribute('rel'), 'noopener noreferrer');
      const unsafe = await page.evaluate(() => ['javascript:alert(1)', 'https://evil.invalid/file/d/SYNTHETIC_DRIVE_IMAGE_A/view', 'https://drive.google.com/open?id=%ZZ'].map(Google_Drive_URL => getDriveFileIdFromRecord({ Google_Drive_URL })));
      assert.deepEqual(unsafe, ['', '', '']);
      await page.evaluate(() => closeFilePreviewModal());
    });
    await test('preview interactions produce no uncaught page errors', () => assert.deepEqual(pageErrors, []));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
(async () => {
  if (process.env.PREVIEW_ARTIFACT_DIR) fs.mkdirSync(process.env.PREVIEW_ARTIFACT_DIR, { recursive: true });
  await backendTests(); await browserTests();
  const sources = Object.fromEntries(['index.html', 'gas/Code.gs'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
  const report = { isolated: true, productionWrites: 0, sources, results, passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length };
  if (process.env.PREVIEW_ARTIFACT_DIR) fs.writeFileSync(path.join(process.env.PREVIEW_ARTIFACT_DIR, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
  if (report.failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
