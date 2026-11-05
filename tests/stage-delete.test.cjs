const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { fixture, backend } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error('FAIL ' + name + '\n' + error.stack); }
}

function seed() {
  const state = fixture();
  state.Meta.State_Revision = 5;
  state.Config_Stages = [
    { Stage_ID: 'S01', Stage_Name: 'First review', Is_Active: false, Budget_Allocated: 1000 },
    { Stage_ID: 'S02', Stage_Name: 'Second review', Is_Active: true, Budget_Allocated: 2000 }
  ];
  return state;
}

async function backendChecks() {
  await test('fresh state reads bypass a stale script cache', () => {
    const c = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(root, 'gas/Code.gs'), 'utf8'), c);
    const old = clone(seed()), current = clone(seed());
    old.Meta.State_Revision = 4;
    c.getCachedState_ = () => clone(old);
    c.setupSheets_ = () => {};
    c.getConfig_ = () => ({ spreadsheetId: 'ISOLATED_SHEET' });
    c.SpreadsheetApp = { openById: () => ({}) };
    c.readTable_ = (_, name) => clone(current[name] || []);
    c.readMetaSheet_ = () => clone(current.Meta);
    c.cacheState_ = () => {};
    c.ScriptApp = { getOAuthToken: () => 'ISOLATED_TOKEN' };
    c.UrlFetchApp = { fetch: url => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({
      valueRanges: new URL(url).searchParams.getAll('ranges').map(range => {
        const name = range.match(/^'([^']+)'/)[1], schema = c.TABLE_SCHEMAS[name];
        const rows = name === 'Meta' ? Object.entries(current.Meta).map(([Key, Value]) => ({ Key, Value })) : current[name] || [];
        return { range, values: [schema.headers, ...rows.map(row => schema.headers.map(key => c.serializeValue_(row[key], schema.types[key] || 'string')))] };
      })
    }) }) };
    assert.equal(c.loadState_().Meta.State_Revision, 4);
    assert.equal(c.loadState_({ fresh: true }).Meta.State_Revision, 5);
  });

  await test('fresh bootstrap reads under the script lock', () => {
    const c = backend();
    const state = c.normalizeState_(seed());
    let locked = false;
    c.withLock_ = fn => { locked = true; try { return fn(); } finally { locked = false; } };
    c.requireSessionContext_ = () => ({ user: state.Users[0], session: {} });
    c.loadState_ = options => { assert.equal(locked, true); return clone(state); };
    const result = c.handleBootstrap_({ fresh: true, includeHeatmap: false });
    assert.equal(result.state.Meta.State_Revision, 5);
  });

  await test('fresh API errors and partial results never fall back to cached data', () => {
    const c = backend();
    c.ScriptApp = { getOAuthToken: () => 'ISOLATED_TOKEN' };
    for (const [code, body] of [[403, {}], [200, { valueRanges: [] }], [200, { valueRanges: Array(16).fill({ values: [['WRONG_HEADER']] }) }]]) {
      c.UrlFetchApp = { fetch: () => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(body) }) };
      assert.throws(() => c.readFreshStateTables_({ spreadsheetId: 'ISOLATED' }), /SYNC_NOT_CONFIRMED/);
    }
  });

  await test('legacy stage activation and deletion APIs are disabled without changing data', () => {
    const c = backend();
    c.db = c.normalizeState_(seed());
    const before = JSON.stringify(c.db);
    assert.throws(() => c.handleActivateStage_({ stageId: 'S02' }), /SINGLE_PROJECT_MODE/);
    assert.throws(() => c.handleDeleteStage_({ stageId: 'S02' }), /SINGLE_PROJECT_MODE/);
    assert.equal(JSON.stringify(c.db), before);
  });
}

async function browserChecks() {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html;charset=utf-8');
    res.end(fs.readFileSync(path.join(root, 'index.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.route(/https:\/\/script\.(google|googleusercontent)\.com\//, route => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ ok: true, data: { state: seed(), currentUser: null } })
    }));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });

    await test('phase navigation is absent and old phase routes remain blocked', async () => {
      const result = await page.evaluate(input => {
        state = input;
        normalizeStateSchema();
        currentUser = state.Users.find(user => user.User_ID === 'U01');
        authSessionToken = 'ISOLATED_MANAGER';
        activeWorkspace = 'admin';
        activeTab = 'overview';
        renderAll();
        const stageMenuVisible = getNavigationMenusForRole(getEffectiveRoleContext().effectiveRole).some(menu => menu.id === 'stages');
        const projectTitleVisible = document.getElementById('dashboard-section').innerText.includes('116級 畢業製作');
        switchTab('stages');
        return {
          stageCount: state.Config_Stages.length,
          stageTitle: state.Config_Stages[0].Stage_Name,
          stageMenuVisible,
          projectTitleVisible,
          oldRouteBlocked: activeTab !== 'stages',
          oldStageCreationHidden: !document.getElementById('main-view-container').innerText.includes('新增會審期數')
        };
      }, seed());
      assert.deepEqual(result, {
        stageCount: 1,
        stageTitle: '116級 畢業製作',
        stageMenuVisible: false,
        projectTitleVisible: true,
        oldRouteBlocked: true,
        oldStageCreationHidden: true
      });
    });

    await test('single-project layout has no horizontal overflow on desktop or mobile', async () => {
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 820 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, width + 'px');
      }
    });
    await test('no uncaught browser errors on the single-project view', () => assert.deepEqual(errors, []));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

(async () => {
  await backendChecks();
  await browserChecks();
  const report = { passed: results.filter(result => result.passed).length, failed: results.filter(result => !result.passed).length, results };
  if (process.env.STAGE_DELETE_REPORT_PATH) fs.writeFileSync(process.env.STAGE_DELETE_REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
  if (report.failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
