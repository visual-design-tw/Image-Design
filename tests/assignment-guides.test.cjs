const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { fixture, backend } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const checks = [];
const published = 'https://docs.google.com/presentation/d/e/2PACX-test_published_deck/pub?start=true&loop=true&slide=id.g123_1_73';
const shared = 'https://docs.google.com/presentation/d/1Test_shared_deck/edit?usp=sharing&resourcekey=0-test_key#slide=id.g456_2_19';
const invalid = [
  'javascript:alert(1)', 'data:text/html,test', 'http://docs.google.com/presentation/d/1Test_shared_deck/edit',
  'https://docs.google.com.evil.invalid/presentation/d/1Test_shared_deck/edit',
  'https://docs.google.com@evil.invalid/presentation/d/1Test_shared_deck/edit',
  'https://evil.invalid@docs.google.com/presentation/d/1Test_shared_deck/edit',
  'https://docs.google.com:443/presentation/d/1Test_shared_deck/edit',
  'https://docs.google.com/document/d/1Test_shared_deck/edit',
  'https://docs.google.com/presentation/d/e/2PACX-test_published_deck/edit',
  'https://docs.google.com/presentation/d/1Test_shared_deck/pub',
  'https://docs.google.com/presentation/d/short/edit',
  'https://docs.google.com/presentation/d/1Test_shared_deck/../../evil',
  'https://docs.google.com/presentation/d/1Test_shared_deck/edit?slide=%ZZ',
  'https://docs.google.com/presentation/d/1Test_shared_deck/edit\n?slide=bad',
  'https://docs.google.com\\@evil.invalid/presentation/d/1Test_shared_deck/edit',
  '<iframe src="https://docs.google.com/presentation/d/1Test_shared_deck/embed"></iframe>',
  published + '&x=' + 'a'.repeat(2048)
];
function pass(name) { checks.push(name); console.log('PASS ' + name); }
function backendContext() {
  const c = backend();
  c.appendActivityLogEntries_ = () => {};
  c.requireSessionUser_ = (state, payload, roles) => {
    const id = payload.auditUser || String(payload.sessionToken || '').replace('TEST-', '');
    const user = state.Users.find(item => item.User_ID === id);
    if (!user || user.Status !== 'Active') throw new Error('AUTH_EXPIRED');
    if (roles && !roles.includes(user.Role)) throw new Error('FORBIDDEN');
    return user;
  };
  c.persistState_ = (state, options = {}) => {
    const next = c.mergeSensitiveState_(c.normalizeState_(clone(state)), options.existingState || c.db, options);
    // Exercise the appended schema column through the actual value codecs.
    const schema = c.TABLE_SCHEMAS.Assignments;
    next.Assignments = next.Assignments.map(item => Object.fromEntries(schema.headers.map(key => [key,
      c.coerceValue_(c.serializeValue_(item[key], schema.types[key] || 'string'), schema.types[key] || 'string')])));
    next.Meta.State_Revision = options.nextRevision || c.db.Meta.State_Revision + 1;
    c.db = c.normalizeState_(clone(next));
  };
  c.buildClientStateResultForUser_ = (state, actor, extra) => ({ state: c.filterStateForUser_(state, actor), currentUser: actor,
    stateRevision: state.Meta.State_Revision, release: c.APP_RELEASE, ...extra });
  c.withLock_ = fn => fn();
  c.jsonResponse_ = (ok, data, error) => ({ ok, data, error: error ? { message: error.message } : undefined });
  return c;
}
function backendChecks() {
  const c = backendContext();
  const pub = c.getGoogleSlidesLink_(published);
  assert.ok(pub.embedUrl.includes('/d/e/2PACX-test_published_deck/embed?start=false&loop=false'));
  assert.ok(pub.embedUrl.endsWith('&slide=id.g123_1_73'));
  const share = c.getGoogleSlidesLink_(shared);
  assert.ok(share.embedUrl.includes('/d/1Test_shared_deck/embed?'));
  assert.ok(share.embedUrl.endsWith('&slide=id.g456_2_19&resourcekey=0-test_key'));
  assert.equal(share.published, false);
  assert.equal(c.getGoogleSlidesLink_(pub.embedUrl).url, pub.url);
  assert.equal(c.getGoogleSlidesLink_('  ' + published + '  ').url, pub.url);
  invalid.forEach(url => assert.equal(c.getGoogleSlidesLink_(url), null, url));
  pass('published and shared Slides canonicalization preserves slide/resource keys and rejects unsafe URLs');
  assert.equal(c.TABLE_SCHEMAS.Assignments.headers.at(-1), 'Guide_URL');
  assert.equal(c.TABLE_SCHEMAS.Assignments.headers.at(-2), 'Display_Order');
  assert.equal(c.hydrateAssignmentRecord_({}).Guide_URL, '');
  pass('schema appends one optional column and legacy assignments still normalize');

  const input = clone(c.db);
  input.Assignments.push({ ...input.Assignments[0], Assignment_ID: 'A02', Guide_URL: published });
  c.handleSaveState_({ auditUser: 'U01', state: input, stateRevision: 1 });
  assert.equal(c.db.Assignments[1].Guide_URL, pub.url);
  pass('new assignment guide survives saveState and schema serialization');

  const before = clone(c.db);
  const bad = clone(c.db);
  bad.Assignments.push({ ...bad.Assignments[0], Assignment_ID: 'BAD', Guide_URL: invalid[0] });
  assert.throws(() => c.handleSaveState_({ auditUser: 'U01', state: bad, stateRevision: 2 }), /Google/);
  assert.equal(JSON.stringify(c.db), JSON.stringify(before));
  pass('invalid guide on publish rejects the entire save without partial data');

  const legacy = clone(c.db);
  legacy.Assignments.forEach(item => delete item.Guide_URL);
  c.handleSaveState_({ auditUser: 'U01', state: legacy, stateRevision: 2 });
  assert.equal(c.db.Assignments[1].Guide_URL, pub.url);
  pass('old client snapshots cannot erase existing guides');

  const request = { action: 'updateAssignmentGuide', sessionToken: 'TEST-U04', assignmentId: 'A01', guideUrl: shared, stateRevision: 3 };
  const res = c.doPost({ postData: { contents: JSON.stringify(request) } });
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(c.db.Assignments[0].Guide_URL, share.url);
  assert.equal(c.db.Assignments[0].Title, before.Assignments[0].Title);
  assert.deepEqual(c.db.Assignment_Resources, before.Assignment_Resources);
  assert.equal(c.db.Meta.State_Revision, 4);
  pass('locked action lets staff update only the guide with a confirmed revision');
  c.handleUpdateAssignmentGuide_(request);
  assert.equal(c.db.Meta.State_Revision, 4);
  pass('retries of the same committed link are idempotent');

  for (const payload of [
    { ...request, guideUrl: published, stateRevision: 3 },
    { ...request, auditUser: 'U03', guideUrl: published, stateRevision: 4 },
    { ...request, sessionToken: '', guideUrl: published, stateRevision: 4 },
    { ...request, guideUrl: 'https://evil.invalid/deck', stateRevision: 4 },
    { ...request, assignmentId: 'DELETED', guideUrl: published, stateRevision: 4 }
  ]) {
    const snapshot = clone(c.db);
    assert.throws(() => c.handleUpdateAssignmentGuide_(payload));
    assert.equal(JSON.stringify(c.db), JSON.stringify(snapshot));
  }
  pass('stale revisions, students, expired login, invalid links and deleted items cannot change guides');
  const studentState = c.filterStateForUser_(c.db, c.db.Users[2]);
  studentState.Assignments[0].Guide_URL = published;
  c.handleSaveState_({ auditUser: 'U03', state: studentState, stateRevision: 4 });
  assert.equal(c.db.Assignments[0].Guide_URL, share.url);
  pass('student saveState cannot bypass guide management permissions');
  c.handleUpdateAssignmentGuide_({ ...request, guideUrl: '', stateRevision: 5 });
  assert.equal(c.db.Assignments[0].Guide_URL, '');
  assert.equal(c.db.Assignments.length, 2);
  pass('removal clears only the link, leaving assignment and attachments intact');
  c.db.Assignments[1].Target_Mode = 'selected';
  c.db.Assignments[1].Target_Team_IDs = ['T01'];
  assert.ok(!c.filterStateForUser_(c.db, c.db.Users[2]).Assignments.find(item => item.Assignment_ID === 'A02'));
  assert.equal(c.filterStateForUser_(c.db, c.db.Users[1]).Assignments.find(item => item.Assignment_ID === 'A02').Guide_URL, pub.url);
  pass('guide visibility follows the assignment target teams');
  const snapshot = { ...c.db.Assignments[1], Assignment_ID: 'RESTORED' };
  c.restoreRecycleBinSnapshot_(c.db, { Snapshot_JSON: { collections: { Assignments: [snapshot] } } });
  assert.equal(c.db.Assignments.find(item => item.Assignment_ID === 'RESTORED').Guide_URL, pub.url);
  pass('assignment recycle-bin snapshots retain guide links');
}

async function browserChecks() {
  const c = backendContext();
  let failUpdate = false;
  let legacyBackend = false;
  let updateDelay = 0;
  const requests = [];
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(root, 'index.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', timezoneId: 'Asia/Taipei' });
    await context.route(/https:\/\/script\.(google|googleusercontent)\.com\//, async route => {
      const payload = route.request().method() === 'POST' ? JSON.parse(route.request().postData()) : {};
      requests.push(payload);
      if (payload.action === 'updateAssignmentGuide' && updateDelay) await new Promise(resolve => setTimeout(resolve, updateDelay));
      let response;
      if (payload.action === 'updateAssignmentGuide' && (failUpdate || legacyBackend)) response = { ok: false, error: { message: legacyBackend ? 'Unsupported action' : '測試連線中斷，請重試。' } };
      else if (['saveState', 'updateAssignmentGuide'].includes(payload.action)) {
        if (legacyBackend && payload.state) payload.state.Assignments.forEach(item => delete item.Guide_URL);
        response = c.doPost({ postData: { contents: JSON.stringify(payload) } });
      }
      else response = { ok: true, data: { state: fixture(), currentUser: null } };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
    });
    const iframeRequests = [];
    await context.route('https://docs.google.com/**', route => {
      iframeRequests.push(route.request().url());
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Mock Slides viewer (no Google permissions tested)</body></html>' });
    });
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
    const seed = async userId => {
      await page.evaluate(({ seed, userId }) => {
        authEpoch++; closeFilePreviewModal(); closeAssignmentDetailModal(true); closeAssignmentPostModal();
        cancelQueuedRemoteStateSync(); state = seed; normalizeStateSchema();
        currentUser = state.Users.find(item => item.User_ID === userId); authSessionToken = 'TEST-' + userId;
        activeWorkspace = userId === 'U01' ? 'admin' : 'team'; activeTab = 'files'; gasConnectionStatus = 'remote';
        remoteSaveInFlight = false; remoteSavePromise = null; pendingRemoteSave = false; remoteMutationInFlight = false;
        workspaceHydrationInFlight = false; remoteStateRevision = state.Meta.State_Revision; expiredSessionToken = '';
        setSaveFeedback('idle', ''); renderAll();
      }, { seed: clone(c.db), userId });
    };
    await seed('U01');
    for (const url of [published, shared, ...invalid]) {
      assert.deepEqual(await page.evaluate(url => getGoogleSlidesLink(url), url), clone(c.getGoogleSlidesLink_(url)));
    }
    pass('frontend and backend URL parsers agree on every supported and hostile case');
    await page.evaluate(() => openAssignmentPostModal());
    await page.locator('#assignment-post-title').fill('規範簡報測試項目');
    await page.locator('#assignment-post-body').fill('請先閱讀簡報，再準備作業。');
    await page.locator('#assignment-post-guide-url').fill(invalid[3]);
    await page.locator('#assignment-post-modal button[type="submit"]').click();
    assert.equal(await page.locator('#assignment-post-guide-url').getAttribute('aria-invalid'), 'true');
    assert.equal(c.db.Assignments.length, 1);
    pass('bad link blocks publication and shows a field-level explanation without losing inputs');
    await page.locator('#assignment-post-guide-url').fill(published);
    assert.equal(iframeRequests.length, 0);
    await page.locator('#assignment-post-modal').getByRole('button', { name: '預覽簡報' }).click();
    await page.waitForFunction(() => !document.getElementById('file-preview-modal').classList.contains('hidden'));
    assert.equal(await page.locator('#file-preview-modal iframe').getAttribute('src'), c.getGoogleSlidesLink_(published).embedUrl);
    await page.locator('#file-preview-modal button[aria-label]').press('Escape');
    await page.waitForFunction(() => document.getElementById('file-preview-modal').classList.contains('hidden'));
    assert.equal(await page.locator('#file-preview-modal iframe').count(), 0);
    assert.equal(await page.locator('#assignment-post-title').inputValue(), '規範簡報測試項目');
    assert.equal(await page.locator('#assignment-post-guide-url').inputValue(), published);
    pass('draft preview is on demand and closing disposes the iframe without clearing the form');

    legacyBackend = true;
    await page.locator('#assignment-post-modal button[type="submit"]').click();
    await page.waitForFunction(() => document.getElementById('assignment-post-guide-url-error').textContent.includes('尚未確認'));
    assert.equal(await page.locator('#assignment-post-guide-url').inputValue(), published);
    assert.equal(await page.locator('#assignment-post-modal').isVisible(), true);
    assert.equal(c.db.Assignments.length, 2);
    pass('an old backend cannot silently discard a guide and report publication complete');
    legacyBackend = false;
    await page.locator('#assignment-post-modal button[type="submit"]').click();
    await page.waitForFunction(() => document.getElementById('assignment-post-modal').classList.contains('hidden'));
    const created = c.db.Assignments.find(item => item.Title === '規範簡報測試項目');
    assert.equal(created.Guide_URL, c.getGoogleSlidesLink_(published).url);
    assert.equal(c.db.Assignments.length, 2);
    pass('real publish form saves the guide through the mocked Apps Script dispatch and schema');

    await page.evaluate(id => openAssignmentDetailModal(id), created.Assignment_ID);
    await page.getByRole('tab', { name: '說明與附件' }).click();
    await page.locator('#assignment-guide-editor summary').click();
    await page.locator('#assignment-guide-url').fill(shared);
    await page.evaluate(() => renderAssignmentDetailModal());
    assert.equal(await page.locator('#assignment-guide-url').inputValue(), shared);
    failUpdate = true;
    await page.locator('#assignment-guide-form button[type="submit"]').click();
    await page.waitForFunction(() => !assignmentGuideSaveInFlight);
    assert.equal(await page.locator('#assignment-guide-url').inputValue(), shared);
    assert.ok((await page.locator('#assignment-guide-url-error').textContent()).includes('中斷'));
    assert.equal(c.db.Assignments.find(item => item.Assignment_ID === created.Assignment_ID).Guide_URL, created.Guide_URL);
    pass('redraw and failed saves preserve the editor draft and do not report success');
    failUpdate = false; updateDelay = 500;
    const countBefore = requests.filter(item => item.action === 'updateAssignmentGuide').length;
    await page.locator('#assignment-guide-form button[type="submit"]').click();
    await page.waitForFunction(() => assignmentGuideSaveInFlight);
    assert.equal(await page.locator('#assignment-guide-url').isDisabled(), true);
    await page.evaluate(() => document.getElementById('assignment-guide-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await page.waitForFunction(() => !assignmentGuideSaveInFlight);
    assert.equal(requests.filter(item => item.action === 'updateAssignmentGuide').length - countBefore, 1);
    assert.equal(c.db.Assignments.find(item => item.Assignment_ID === created.Assignment_ID).Guide_URL, c.getGoogleSlidesLink_(shared).url);
    pass('saving locks the editor, ignores repeat submits and refreshes only after cloud confirmation');
    updateDelay = 0;
    await page.locator('#assignment-guide-editor summary').click();
    await page.locator('#assignment-guide-url').fill('');
    await page.locator('#assignment-guide-form button[type="submit"]').click();
    await page.waitForFunction(() => !assignmentGuideSaveInFlight);
    assert.equal(c.db.Assignments.find(item => item.Assignment_ID === created.Assignment_ID).Guide_URL, '');
    assert.equal(await page.locator('#assignment-guide-panel').getByRole('button', { name: '查看規範' }).count(), 0);
    pass('staff can remove the guide without deleting the assignment');

    c.handleUpdateAssignmentGuide_({ auditUser: 'U01', assignmentId: created.Assignment_ID, guideUrl: published, stateRevision: c.db.Meta.State_Revision });
    await seed('U03');
    await page.evaluate(id => openAssignmentDetailModal(id), created.Assignment_ID);
    assert.equal(await page.locator('#assignment-guide-editor').count(), 0);
    assert.equal(await page.locator('#assignment-wizard-requirements').isVisible(), true);
    assert.equal(await page.locator('#assignment-guide-panel').isVisible(), true);
    assert.equal(await page.locator('#assignment-wizard-prepare').isVisible(), false);
    await page.screenshot({ path: '/tmp/assignment-guide-requirements.png' });
    pass('students see the guide only in the requirements step and have no management controls');
    await page.locator('#assignment-wizard-next').click();
    await page.locator('#assignment-submit-text').fill('保留我的設計說明');
    await page.locator('#assignment-submit-file').setInputFiles({ name: 'test.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 local test') });
    await page.locator('#assignment-wizard-back').click();
    await page.locator('#assignment-guide-panel').getByRole('button', { name: '查看規範' }).click();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 740 });
      const geometry = await page.locator('#file-preview-modal > div').evaluate(panel => {
        const rect = panel.getBoundingClientRect();
        const body = document.getElementById('file-preview-modal-body');
        body.scrollTop = body.scrollHeight;
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight,
          overflow: body.scrollWidth > body.clientWidth + 1, canScroll: body.scrollHeight <= body.clientHeight || body.scrollTop > 0 };
      });
      assert.ok(geometry.left >= 0 && geometry.right <= geometry.width && geometry.top >= 0 && geometry.bottom <= geometry.height, JSON.stringify(geometry));
      assert.equal(geometry.overflow, false);
      assert.equal(geometry.canScroll, true);
    }
    await page.screenshot({ path: '/tmp/assignment-guide-preview-mobile.png' });
    assert.ok((await page.locator('#file-preview-modal').textContent()).includes('要求權限'));
    assert.equal(await page.locator('#file-preview-modal a').getAttribute('rel'), 'noopener noreferrer');
    await page.locator('#file-preview-modal button[aria-label]').click();
    await page.waitForFunction(() => document.getElementById('file-preview-modal').classList.contains('hidden'));
    await page.locator('#assignment-wizard-next').click();
    assert.equal(await page.locator('#assignment-submit-text').inputValue(), '保留我的設計說明');
    assert.equal(await page.locator('#assignment-submit-file').evaluate(input => input.files[0].name), 'test.pdf');
    pass('responsive preview stays inside the screen and return navigation preserves student file and text drafts');
    assert.equal(await page.locator('#file-preview-modal iframe').count(), 0);
    assert.deepEqual(errors, []);
    pass('all preview/editor flows complete without uncaught browser errors');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
async function main() {
  backendChecks();
  await browserChecks();
  const result = { scope: 'Local fixtures and mocked Google requests only; not a live Google permission or deployment test', passed: checks.length, checks };
  if (process.env.GUIDE_REPORT_PATH) fs.writeFileSync(process.env.GUIDE_REPORT_PATH, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ passed: checks.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
