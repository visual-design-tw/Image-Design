const fs = require('node:fs');
const path = require('node:path');
const { createSiteServer } = require('./site-test-server.cjs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { fixture, backend } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const checks = [];
function pass(name) { checks.push(name); console.log('PASS ' + name); }
function backendContext() {
  const context = backend();
  context.appendActivityLogEntries_ = () => {};
  context.persistState_ = (state, options) => {
    const next = clone(state);
    next.Meta = next.Meta || {};
    next.Meta.State_Revision = options.nextRevision;
    context.db = context.normalizeState_(next);
  };
  context.requireSessionUser_ = (state, payload, roles) => {
    const user = state.Users.find(item => item.User_ID === (payload.auditUser || 'U03'));
    if (!user || user.Status !== 'Active') throw new Error('AUTH_EXPIRED');
    if (roles && roles.length && !roles.includes(user.Role)) throw new Error('FORBIDDEN');
    return user;
  };
  return context;
}
function runBackendChecks() {
  const context = backendContext();
  context.db.Assignments = [
    { ...context.db.Assignments[0], Assignment_ID: 'A01', Title: 'First', Display_Order: 0 },
    { ...context.db.Assignments[0], Assignment_ID: 'A02', Title: 'Second', Display_Order: 0 },
    { ...context.db.Assignments[0], Assignment_ID: 'A03', Title: 'Third', Display_Order: 0 }
  ];
  const response = context.handleReorderAssignments_({ auditUser: 'U01', assignmentIds: ['A03', 'A01', 'A02'], stateRevision: 1 });
  assert.deepEqual(context.db.Assignments.map(item => item.Assignment_ID), ['A03', 'A01', 'A02']);
  assert.deepEqual(context.db.Assignments.map(item => item.Display_Order), [1, 2, 3]);
  assert.deepEqual(response.assignmentOrder, ['A03', 'A01', 'A02']);
  pass('valid order is committed atomically with sequential positions');

  for (const assignmentIds of [['A03', 'A03', 'A02'], ['A03', 'A01'], ['A03', 'A01', 'A02', 'UNKNOWN']]) {
    const before = clone(context.db);
    assert.throws(() => context.handleReorderAssignments_({ auditUser: 'U01', assignmentIds, stateRevision: 2 }), /STATE_CONFLICT/);
    assert.equal(JSON.stringify(context.db), JSON.stringify(before));
  }
  pass('duplicate, incomplete, and unknown IDs cannot partially change the order');
  assert.throws(() => context.handleReorderAssignments_({ auditUser: 'U01', assignmentIds: ['A01', 'A02', 'A03'], stateRevision: 1 }), /STATE_CONFLICT/);
  assert.throws(() => context.handleReorderAssignments_({ auditUser: 'U03', assignmentIds: ['A01', 'A02', 'A03'], stateRevision: 2 }), /FORBIDDEN/);
  pass('stale revisions and student roles are rejected');
  assert.ok(context.TABLE_SCHEMAS.Assignments.headers.includes('Display_Order'));
  pass('assignment table migration includes Display_Order without changing existing column names');
}
async function runBrowserChecks() {
  const server = createSiteServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fs.readFileSync(path.join(root, 'index.html'))); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', timezoneId: 'Asia/Taipei' });
    await context.route(/https:\/\/script\.(google|googleusercontent)\.com\//, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: { state: fixture(), currentUser: null } }) }));
    const page = await context.newPage(); page.setDefaultTimeout(7000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
    await page.evaluate(seed => {
      authEpoch++; closeAssignmentDetailModal(true); state = JSON.parse(JSON.stringify(seed));
      state.Assignments = [
        { ...state.Assignments[0], Assignment_ID: 'A01', Title: '第一項：研究資料' },
        { ...state.Assignments[0], Assignment_ID: 'A02', Title: '第二項：主視覺' },
        { ...state.Assignments[0], Assignment_ID: 'A03', Title: '第三項：完稿檔案' }
      ];
      normalizeStateSchema(); currentUser = state.Users[0]; authSessionToken = 'TEST-ORDER';
      activeWorkspace = 'admin'; activeTab = 'files'; gasConnectionStatus = 'remote';
      remoteSaveInFlight = false; remoteSavePromise = null; pendingRemoteSave = false; remoteMutationInFlight = false;
      assignmentReorderInFlight = false; assignmentBrowserState = { query: '', stage: 'all', status: 'all', submissionMode: 'all', team: 'all', sortBy: 'manual' };
      requestGas = async (action, payload) => {
        window.__reorderRequests = window.__reorderRequests || [];
        window.__reorderRequests.push({ action, payload });
        const next = JSON.parse(JSON.stringify(state));
        next.Assignments.sort((a, b) => payload.assignmentIds.indexOf(a.Assignment_ID) - payload.assignmentIds.indexOf(b.Assignment_ID));
        next.Assignments.forEach((assignment, index) => assignment.Display_Order = index + 1);
        return { ok: true, data: { state: next, currentUser, stateRevision: 2 } };
      };
      renderAll();
    }, fixture());
    assert.equal(await page.locator('.assignment-drag-handle').count(), 3);
    assert.equal(await page.locator('[data-assignment-id]').count(), 3);
    pass('manual mode exposes one drag handle per visible assignment');

    const first = page.locator('[data-assignment-id="A01"] .assignment-drag-handle');
    const third = page.locator('[data-assignment-id="A03"]');
    const firstBox = await first.boundingBox(); const thirdBox = await third.boundingBox();
    await page.evaluate(() => {
      const handle = document.querySelector('[data-assignment-id="A01"] .assignment-drag-handle');
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId: 1, pointerType: 'touch', button: 0, clientX: 100, clientY: 100 }));
    });
    await page.waitForTimeout(520);
    assert.equal(await page.locator('.assignment-item-card.is-dragging').count(), 1);
    assert.equal(await page.locator('.assignment-drag-placeholder').count(), 1);
    await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: x, clientY: y })), { x: thirdBox.x + thirdBox.width / 2, y: thirdBox.y + thirdBox.height * 0.85 });
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, isPrimary: true, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 })));
    await page.waitForFunction(() => Array.isArray(window.__reorderRequests) && window.__reorderRequests.length === 1);
    const order = await page.locator('[data-assignment-id]').evaluateAll(cards => cards.map(card => card.dataset.assignmentId));
    assert.deepEqual(order, ['A02', 'A03', 'A01']);
    assert.equal(await page.locator('.assignment-item-card.is-dragging').count(), 0);
    assert.equal(await page.locator('.assignment-drag-placeholder').count(), 0);
    assert.ok((await page.locator('#toast-notif').textContent()).includes('同步'));
    pass('long press moves the card with placeholder animation and persists the new order');

    await page.evaluate(() => { assignmentBrowserState.sortBy = 'newest'; renderAll(); });
    assert.equal(await page.locator('.assignment-drag-handle').count(), 0);
    pass('drag handles stay hidden outside manual mode');
    await page.evaluate(() => { currentUser = state.Users[2]; activeWorkspace = 'team'; assignmentBrowserState.sortBy = 'manual'; renderAll(); });
    assert.equal(await page.locator('.assignment-drag-handle').count(), 0);
    assert.equal(await page.locator('[data-assignment-id]').count(), 3);
    pass('students can see the saved order but cannot reorder it');

    await page.evaluate(() => { currentUser = state.Users[0]; activeWorkspace = 'admin'; assignmentBrowserState.sortBy = 'manual'; renderAll(); });
    const manualTip = page.locator('[role="status"]', { hasText: '長按項目' });
    assert.equal(await manualTip.isVisible(), true);
    await page.screenshot({ path: '/tmp/assignment-long-press-order.png' });
    assert.deepEqual(errors, []); pass('manual mode guidance and effects render without browser errors');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
async function main() {
  runBackendChecks();
  await runBrowserChecks();
  fs.writeFileSync(path.join(root, 'audit/assignment-reorder-results-2026-09-12.json'), JSON.stringify({ scope: 'Local fixtures and mocked requests only', passed: checks.length, checks }, null, 2));
  console.log(JSON.stringify({ passed: checks.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
