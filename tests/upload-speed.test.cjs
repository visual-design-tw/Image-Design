const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { backend, fixture } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..'), MiB = 1024 * 1024;
const results = [], modelComparisons = [];
const artifactDir = process.env.UPLOAD_SPEED_ARTIFACT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'image-design-upload-speed-'));
fs.mkdirSync(artifactDir, { recursive: true });
const clone = value => JSON.parse(JSON.stringify(value));
async function test(name, fn) { try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); } catch (error) { results.push({ name, passed: false, error: error.stack }); console.error('FAIL ' + name + '\n' + error.stack); } }
const code = fs.readFileSync(path.join(root, 'gas/Code.gs'), 'utf8');
const answer = { status: 'success', complete: true, mode: 'assignment-asset', sessionKey: 'SESSION_SPEED', assignmentId: 'A01', assetReceipt: 'SYNTHETIC_RECEIPT', driveFileId: 'SYNTHETIC_FILE', fileName: 'synthetic.zip', fileUrl: 'https://example.invalid/file' };
function authContext(size = 50 * MiB) {
  const c = backend(); c.sheetReads = 0; c.driveCalls = 0; c.decoded = 0; c.finishCalls = 0;
  vm.runInContext(code.slice(code.indexOf('function loadResumableUploadAuthState_()'), code.indexOf('function uploadResumableLargeUploadChunk(')), c);
  vm.runInContext(code.slice(code.indexOf('function requireSessionContext_('), code.indexOf('function handleLogoutSession_(')), c);
  c.getConfig_ = () => ({ spreadsheetId: 'SYNTHETIC_WORKBOOK' });
  c.authRead = () => {
    c.sheetReads++;
    const headers = Array.from(c.TABLE_SCHEMAS.Users.headers);
    return [headers, ...c.db.Users.map(user => headers.map(key => user[key] || ''))];
  };
  c.SpreadsheetApp = { openById(id) { assert.equal(id, 'SYNTHETIC_WORKBOOK'); return { getSheetByName(name) {
    assert.equal(name, 'Users'); return { getLastRow: () => c.db.Users.length + 1, getRange(row, col, rows, cols) {
      assert.deepEqual([row, col, rows, cols], [1, 1, c.db.Users.length + 1, 8]); return { getValues: () => c.authRead() };
    } };
  } }; } };
  c.hashSessionToken_ = token => 'hash:' + token;
  c.sessions = [{ User_ID: 'U03', Token_Hash: 'hash:SYNTHETIC_SPEED_TOKEN', Expires_At_Millis: Date.now() + 3600000 }];
  c.loadAuthSessions_ = () => clone(c.sessions);
  c.session = { status: 'active', sessionKey: 'SESSION_SPEED', sessionTokenHash: 'hash:SYNTHETIC_SPEED_TOKEN', userId: 'U03', fileSize: size, mode: 'assignment-asset', assignmentId: 'A01', expiresAtMillis: Date.now() + 3600000, uploadSessionUrl: 'https://example.invalid/upload', mimeType: 'application/zip' };
  c.loadResumableUploadSession_ = key => key === c.session.sessionKey ? clone(c.session) : null;
  c.loadState_ = () => { throw new Error('Unexpected whole-workbook read'); };
  c.Utilities.base64Decode = text => { c.decoded++; return Buffer.from(text, 'base64'); };
  c.uploadDriveResumableChunk_ = (url, type, start, end, total, bytes) => { c.driveCalls++; assert.equal(bytes.length, end - start + 1); return end === total - 1 ? { responseCode: 200, body: '{}' } : { responseCode: 308, headers: { Range: 'bytes=0-' + end } }; };
  c.buildResumableDriveResult_ = () => ({ fileId: 'SYNTHETIC_FILE' }); c.withLock_ = fn => fn();
  c.handleLargeAssignmentAssetFormUpload_ = () => { c.finishCalls++; return clone(answer); };
  c.saveResumableUploadSession_ = session => { c.session = clone(session); };
  return c;
}
function payload(bytes = 2 * MiB, extra = {}) { return { sessionKey: 'SESSION_SPEED', sessionToken: 'SYNTHETIC_SPEED_TOKEN', totalSize: 50 * MiB, totalChunks: 25, chunkStart: 0, chunkEnd: bytes - 1, chunkBase64: Buffer.alloc(bytes).toString('base64'), ...extra }; }
async function backendTests() {
  await test('chunk validation performs one live account-table read and no full-state read', () => {
    const c = authContext(); const r = c.uploadResumableLargeUploadChunk(payload());
    assert.equal(r.nextByte, 2 * MiB); assert.equal(c.sheetReads, 1); assert.equal(c.driveCalls, 1);
  });
  await test('both legacy 2 MiB and new 8 MiB chunks remain accepted', () => {
    for (const bytes of [2 * MiB, 8 * MiB]) { const c = authContext(); assert.equal(c.uploadResumableLargeUploadChunk(payload(bytes)).nextByte, bytes); }
  });
  await test('oversize and invalid boundaries are rejected before base64 allocation or Drive calls', () => {
    for (const changes of [{ chunkEnd: 8 * MiB }, { chunkEnd: 2 * MiB - 2 }, { chunkStart: 1 }, { chunkStart: 0.5 }, { totalSize: NaN }]) {
      const c = authContext(); assert.throws(() => c.uploadResumableLargeUploadChunk(payload(2 * MiB, changes))); assert.equal(c.decoded, 0); assert.equal(c.driveCalls, 0);
    }
  });
  await test('oversize encoded input is bounded before decoding', () => {
    const c = authContext(); assert.throws(() => c.uploadResumableLargeUploadChunk(payload(1, { chunkBase64: 'A'.repeat(Math.ceil(8 * MiB / 3) * 4 + 1) }))); assert.equal(c.decoded, 0);
  });
  await test('revoked, expired, disabled and wrong-owner accounts never send a chunk', () => {
    for (const change of [c => { c.sessions[0].Revoked_At = 'revoked'; }, c => { c.sessions[0].Expires_At_Millis = 1; }, c => { c.db.Users[2].Status = 'Pending'; }, c => { c.session.userId = 'U02'; }]) {
      const c = authContext(); change(c); assert.throws(() => c.uploadResumableLargeUploadChunk(payload()), /AUTH_EXPIRED|FORBIDDEN/); assert.equal(c.driveCalls, 0);
    }
  });
  await test('forged or expired upload credentials fail before any account lookup', () => {
    for (const changes of [{ sessionToken: 'FORGED' }, { sessionKey: 'MISSING' }]) { const c = authContext(); assert.throws(() => c.uploadResumableLargeUploadChunk(payload(1, changes))); assert.equal(c.sheetReads, 0); }
    const c = authContext(); c.session.expiresAtMillis = 1; assert.throws(() => c.uploadResumableLargeUploadChunk(payload())); assert.equal(c.sheetReads, 0);
  });
  await test('account read failures and malformed headers fail closed, not through cached permissions', () => {
    for (const read of [() => { throw new Error('Sheets unavailable'); }, () => [['Name']]]) { const c = authContext(); c.authRead = read; assert.throws(() => c.uploadResumableLargeUploadChunk(payload()), /UPLOAD_AUTH_UNAVAILABLE/); assert.equal(c.driveCalls, 0); }
  });
  await test('progress requires actual bounded Drive acknowledgement instead of assuming sent bytes were saved', () => {
    for (const headers of [{}, { Range: 'bytes=0-999999999' }, { Range: 'bytes=0-1' }, { Range: 'invalid-2097151' }]) { const c = authContext(); c.uploadDriveResumableChunk_ = () => ({ responseCode: 308, headers }); assert.throws(() => c.uploadResumableLargeUploadChunk(payload()), /UPLOAD_PROGRESS_NOT_CONFIRMED/); }
  });
  await test('final completion still finalizes once and reauthenticates every cached confirmation', () => {
    const c = authContext(3), p = payload(3, { totalSize: 3 });
    assert.equal(c.uploadResumableLargeUploadChunk(p).complete, true); assert.equal(c.uploadResumableLargeUploadChunk(p).complete, true);
    assert.equal(c.finishCalls, 1); assert.equal(c.driveCalls, 1); c.db.Users[2].Status = 'Pending';
    assert.throws(() => c.uploadResumableLargeUploadChunk(p), /AUTH_EXPIRED/); assert.equal(c.finishCalls, 1);
  });
  await test('only the original public RPC surface is exposed', () => {
    const names = [...code.matchAll(/^function\s+(\w+)\s*\(/gm)].map(m => m[1]).filter(n => !n.endsWith('_')).sort();
    assert.deepEqual(names, ['doGet', 'doPost', 'processLargeUploadForm', 'startResumableLargeUpload', 'uploadResumableLargeUploadChunk'].sort());
  });
}

function clientContext(file, options = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8'); const start = source.indexOf('function isCompletedResumableResult(result)');
  const end = source.indexOf(file.startsWith('gas/') ? 'function closeWindow()' : 'function notifyOpener(result)', start);
  const calls = [], progress = [], stats = { textContent: '' }, timers = new Map(); let clock = 0, sequence = 0, firstFailure = true;
  const c = vm.createContext({ model: { mode: 'assignment-asset', sessionKey: 'SESSION_SPEED', assignmentId: 'A01', resumableChunkMb: 8 }, resumableChunkBytes: 8 * MiB,
    Date: { now: () => clock }, document: { getElementById: () => stats }, formatFileSize: n => n + ' B', setStatus: () => {}, setTransferProgress: (percent, label) => progress.push({ percent, label }),
    buildUploadPayload: () => ({}), getFormUploadPayload: () => ({}), readChunkAsBase64: async () => 'SYNTHETIC_BYTES', handleSuccess: r => { c.success = r; },
    window: { setInterval: fn => { timers.set(++sequence, fn); return sequence; }, clearInterval: id => timers.delete(id), setTimeout: fn => fn() }
  });
  const server = async (action, p) => {
    if (action === 'startResumableLargeUpload') return options.completed ? clone(answer) : { chunkSize: options.maximum || 8 * MiB };
    calls.push(clone(p)); clock += options.slow ? 45000 : 2000;
    if (options.retry && p.chunkIndex === 1 && firstFailure) { firstFailure = false; throw new Error('Isolated interruption'); }
    if (options.throwAll) throw new Error('Isolated interruption');
    if (p.chunkEnd === p.totalSize - 1) return options.missingReceipt ? { ...answer, assetReceipt: '' } : clone(answer);
    return { complete: false, nextByte: options.invalidProgress || p.chunkEnd + 1 };
  };
  c.requestGas = server; c.callResumableServer = server;
  c.callChunkWithRetry = async (p, onRetry) => { try { return await server('chunk', p); } catch (e) { if (onRetry) onRetry(); return server('chunk', p); } };
  vm.runInContext(source.slice(start, end), c);
  return { c, calls, progress, timers, stats, run: async () => await c.handleResumableSubmit({ size: 50 * MiB }) || c.success };
}
async function clientTests() {
  for (const file of ['large-upload.html', 'gas/LargeUpload.html']) {
    await test(file + ' reduces a fast synthetic 50 MiB transfer from 25 to 8 sequential chunks', async () => {
      const baseline = clientContext(file, { maximum: 2 * MiB }), fast = clientContext(file); await baseline.run(); await fast.run();
      assert.equal(baseline.calls.length, 25); assert.equal(fast.calls.length, 8); assert.deepEqual(fast.calls.map(p => p.chunkEnd - p.chunkStart + 1), [2, 4, 8, 8, 8, 8, 8, 4].map(n => n * MiB));
      assert.equal(fast.timers.size, 0); assert.equal(fast.progress.at(-1).percent, 100);
      modelComparisons.push({ file, syntheticBytes: 50 * MiB, originalChunks: 25, optimizedChunks: 8, note: 'Modeled request overhead, not a measured production speedup' });
    });
    await test(file + ' keeps slow connections at the old 2 MiB size', async () => { const run = clientContext(file, { slow: true }); await run.run(); assert.equal(run.calls.length, 25); assert.ok(run.calls.every(p => p.chunkEnd - p.chunkStart + 1 <= 2 * MiB)); });
    await test(file + ' retries identical bytes and never skips an unconfirmed range', async () => { const run = clientContext(file, { retry: true }); await run.run(); assert.deepEqual(run.calls[1], run.calls[2]); for (let i = 1; i < run.calls.length; i++) { if (run.calls[i].chunkStart !== run.calls[i - 1].chunkStart) assert.equal(run.calls[i].chunkStart, run.calls[i - 1].chunkEnd + 1); } assert.equal(run.timers.size, 0); });
    await test(file + ' cleans its timer on failure and never reports false completion', async () => { for (const options of [{ throwAll: true }, { invalidProgress: 999999999 }, { missingReceipt: true }]) { const run = clientContext(file, options); await assert.rejects(run.run()); assert.equal(run.timers.size, 0); assert.notEqual(run.progress.at(-1).percent, 100); } });
    await test(file + ' completed-result retry has no chunk requests', async () => { const run = clientContext(file, { completed: true }); await run.run(); assert.equal(run.calls.length, 0); assert.equal(run.timers.size, 0); });
  }
  await test('size adaptation respects server limits and backs off after slow or retried chunks', () => {
    const { c } = clientContext('large-upload.html'); assert.equal(c.getNextUploadChunkSize(8 * MiB, 8 * MiB, 31000, false), 4 * MiB); assert.equal(c.getNextUploadChunkSize(4 * MiB, 8 * MiB, 1000, true), 2 * MiB);
    for (const value of [NaN, -1, 8 * MiB + 1, 16 * MiB, 1025]) assert.throws(() => c.getUploadChunkPlan(value, value));
  });
  await test('speed and ETA reflect confirmed bytes including elapsed setup time, not sent-byte optimism', () => {
    const { c } = clientContext('large-upload.html'); let r = c.getUploadEstimate(0, 0, 50 * MiB, 30000); assert.equal(r.remainingSeconds, null); assert.equal(r.bytesPerSecond, 0);
    r = c.getUploadEstimate(0, 25 * MiB, 50 * MiB, 450000); assert.equal(r.remainingSeconds, 450); assert.ok(Math.abs(r.bytesPerSecond / 1024 - 56.8889) < 0.01);
  });
  await test('new upload-window URLs include the release without changing the chosen endpoint', () => {
    const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8'); const a = source.indexOf('function buildLargeUploadPageUrl('), b = source.indexOf('function openLargeUploadWindow(', a);
    const c = vm.createContext({ URL, APP_RELEASE: 'SYNTHETIC_RELEASE', getGasApiUrl: () => 'https://example.invalid/api', window: { location: { href: 'https://example.invalid/app/index.html' } } }); vm.runInContext(source.slice(a, b), c);
    const url = new URL(c.buildLargeUploadPageUrl({ sessionKey: 'SYNTHETIC' })); assert.equal(url.searchParams.get('release'), 'SYNTHETIC_RELEASE'); assert.equal(url.searchParams.get('gasEndpoint'), 'https://example.invalid/api');
  });
}

async function browserTests() {
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fs.readFileSync(path.join(root, 'large-upload.html'))); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const syntheticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-design-speed-fixture-'));
  const syntheticFile = path.join(syntheticDir, 'synthetic-speed.zip');
  fs.writeFileSync(syntheticFile, ''); fs.truncateSync(syntheticFile, 50 * MiB);
  let release, stopped = false; const gate = new Promise(resolve => { release = resolve; }); const ranges = [], errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.route(/https:\/\/script\.(google|googleusercontent)\.com\//, async route => {
      const p = route.request().method() === 'POST' ? JSON.parse(route.request().postData()) : Object.fromEntries(new URL(route.request().url()).searchParams);
      let data;
      if (p.action === 'largeUploadModel') data = { mode: 'assignment-asset', sessionToken: 'SYNTHETIC_SPEED_TOKEN', sessionKey: 'SESSION_SPEED', assignmentId: 'A01', title: 'Isolated upload test', pathLabel: 'Synthetic folder', maxDirectMb: 18, maxResumableMb: 2048, resumableChunkMb: 8 };
      else if (p.action === 'startResumableLargeUpload') data = { chunkSize: 8 * MiB };
      else if (p.action === 'uploadResumableLargeUploadChunk') {
        ranges.push({ start: p.chunkStart, end: p.chunkEnd, bytes: Buffer.from(p.chunkBase64, 'base64').length });
        if (ranges.length === 2) await gate;
        if (stopped) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, error: { message: 'Isolated test interruption' } }) }).catch(() => {});
        data = p.chunkEnd === p.totalSize - 1 ? clone(answer) : { complete: false, nextByte: p.chunkEnd + 1 };
      } else throw new Error('Unexpected request ' + p.action);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data }) }).catch(() => {});
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
    await test('actual mobile 50 MiB upload shows confirmed capacity, elapsed time, speed and ETA while keeping one spinner', async () => {
      await page.locator('#upload-file').setInputFiles(syntheticFile);
      await page.locator('#submit-button').click(); await page.waitForFunction(() => document.getElementById('transfer-statistics').textContent.includes('已確認 2 MB'));
      await page.waitForTimeout(1200); const text = await page.locator('#transfer-statistics').innerText(); assert.match(text, /平均/); assert.match(text, /預估剩餘約/);
      assert.equal(await page.locator('#upload-submit-icon .managed-icon-spinner').count(), 1); assert.equal(await page.locator('#upload-file').isDisabled(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.screenshot({ path: path.join(artifactDir, 'upload-speed-mobile.png') });
    });
    await test('50 MiB browser transfer preserves contiguous ranges, valid byte lengths and explicit completion', async () => {
      await page.evaluate(() => { window.close = () => {}; }); release(); await page.waitForFunction(() => document.getElementById('submit-label').textContent === '已完成');
      assert.equal(ranges.length, 8); let next = 0; for (const r of ranges) { assert.equal(r.start, next); assert.equal(r.bytes, r.end - r.start + 1); assert.ok(r.bytes <= 8 * MiB); next = r.end + 1; } assert.equal(next, 50 * MiB);
      assert.equal(await page.locator('#progress-value').innerText(), '100%'); assert.deepEqual(errors, []);
    });
  } finally { stopped = true; release(); await browser.close(); await new Promise(resolve => server.close(resolve)); fs.rmSync(syntheticDir, { recursive: true, force: true }); }
}
(async () => {
  await backendTests(); await clientTests(); await browserTests();
  const report = { isolated: true, productionWrites: 0, measuredProductionSpeed: false, modelComparisons, results, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, sources: {} };
  for (const file of ['index.html', 'large-upload.html', 'gas/Code.gs', 'gas/LargeUpload.html']) report.sources[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  fs.writeFileSync(path.join(artifactDir, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ passed: report.passed, failed: report.failed, artifactDir })); if (report.failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
