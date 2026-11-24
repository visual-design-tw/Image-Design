const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const { chromium } = require('playwright');
const { fixture } = require('./stability.test.cjs');

const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'gas/Code.gs'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const requestId = () => crypto.randomBytes(16).toString('hex');
const MiB = 1024 * 1024;
const day = 86400000;
const taipeiDue = time => new Date(time + 8 * 3600000).toISOString().slice(0, 16);
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function startCatalogServer() {
  const files = { '/': 'index.html', '/catalog-upload.html': 'catalog-upload.html',
    '/catalog-upload.js': 'catalog-upload.js', '/catalog-upload.css': 'catalog-upload.css' };
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  const server = http.createServer((req, res) => {
    const file = files[req.url.split('?')[0]];
    if (!file) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', types[path.extname(file)] + '; charset=utf-8');
    res.end(fs.readFileSync(path.join(root, file)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: 'http://127.0.0.1:' + server.address().port };
}

function fakeWorkspace() {
  const seed = fixture();
  seed.Users.push({ User_ID: 'U05', Name: '收件組員', Email: 'reviewer@example.invalid', Team_ID: 'T00', Role: 'Admin', Status: 'Active' });
  const data = { Catalog_Roster: [], Catalog_Items: [], Catalog_Targets: [], Catalog_Submissions: [], Catalog_Purged_Items: [], Teams: seed.Teams };
  const props = new Map(), cache = new Map(), uploads = new Map(), files = new Map(), mail = [];
  const result = { data, props, cache, uploads, files, mail, reads: 0, cloudWrites: 0, ranges: [], probeCalls: 0, clock: Date.now() };
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [result.clock])); }
    static now() { return result.clock; }
  }
  let lockDepth = 0;
  let sessions = [];
  const foldersById = new Map();
  const folderIterator = list => ({ hasNext: () => list.length > 0, next: () => list.shift() });
  function privateFolder(id, name = 'Root', parent = null) {
    const folders = new Map();
    const folder = { getId: () => id, getName: () => name, getParents: () => folderIterator(parent ? [parent] : []),
      getSharingAccess: () => result.publicFolder ? 'PUBLIC' : 'PRIVATE',
      getFoldersByName: childName => ({ hasNext: () => folders.has(childName), next: () => folders.get(childName) }),
      createFolder: childName => { const child = privateFolder(id + ':' + childName, childName, folder); folders.set(childName, child); return child; } };
    foldersById.set(id, folder);
    return folder;
  }
  const folder = privateFolder('ROOT');
  const uw = {
    getUuid: () => crypto.randomUUID(), formatDate: date => date.toISOString(),
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (algo, value) => crypto.createHash(algo).update(value).digest(),
    computeHmacSha256Signature: (value, key) => crypto.createHmac('sha256', key).update(value).digest(),
    base64Encode: bytes => Buffer.from(bytes).toString('base64'),
    base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url'),
    base64Decode: value => Buffer.from(value, 'base64')
  };
  const c = vm.createContext({
    console, Date: Clock, Utilities: uw, Logger: { log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key) || null,
      setProperty: (key, value) => props.set(key, value) }) },
    CacheService: { getScriptCache: () => ({
      get: key => { const item = cache.get(key); return item?.expires > result.clock ? item.value : null; },
      put: (key, value, seconds) => cache.set(key, { value, expires: result.clock + seconds * 1000 }),
      remove: key => cache.delete(key)
    }) },
    LockService: { getScriptLock: () => ({ waitLock: () => { assert.equal(lockDepth++, 0); },
      releaseLock: () => { assert.equal(lockDepth--, 1); } }) },
    DriveApp: { Access: { PRIVATE: 'PRIVATE' }, getFolderById: () => folder, getFileById: id => {
      const file = files.get(id);
      assert.ok(file);
      return { getParents: () => folderIterator(file.parents.map(id => foldersById.get(id))), isTrashed: () => Boolean(file.trashed),
        setTrashed: trashed => { if (result.driveTrashFailure) throw Error('Mock Drive unavailable'); file.trashed = trashed; } };
    } },
    ScriptApp: { getOAuthToken: () => 'FIXTURE_ONLY' }
  });
  vm.runInContext(code, c);
  c.jsonResponse_ = (ok, body, error) => clone({ ok, data: body, error: error ? { message: error.message } : null });
  c.readCatalogTables_ = names => {
    result.reads++;
    return Object.fromEntries(Array.from(names, name => [name, clone(data[name])]));
  };
  c.writeCatalogTables_ = tables => {
    assert.equal(lockDepth, 1, 'dedicated writes are locked');
    if (result.writeFailure === 'before') {
      result.writeFailure = null;
      throw new Error('TEST_SHEETS_UNAVAILABLE');
    }
    Object.assign(data, clone(tables));
    result.cloudWrites += 1;
    if (result.writeFailure === 'after') {
      result.writeFailure = null;
      throw new Error('TEST_RESPONSE_LOST');
    }
  };
  c.getConfig_ = () => ({ frontendBaseUrl: 'https://example.invalid/project/index.html?x=1', driveRootFolderId: 'ROOT',
    spreadsheetId: 'MOCK', timeZone: 'Asia/Taipei', passwordResetExpiryMinutes: 30 });
  seed.Users.forEach(user => { user.Password = c.hashPassword_('local-test-password', 'test-salt'); });
  c.loadState_ = () => c.normalizeState_(clone(seed));
  c.loadResumableUploadAuthState_ = () => ({ Users: clone(seed.Users) });
  c.loadLoginUser_ = email => clone(seed.Users.find(u => u.Email === email) || null);
  c.loadAuthSessions_ = () => clone(sessions);
  c.persistAuthSessions_ = records => { sessions = clone(records); };
  c.SpreadsheetApp = { openById: () => ({}) };
  c.readMetaSheet_ = () => clone(seed.Meta);
  c.buildHeatmapStats_ = () => ({});
  c.sendSystemEmail_ = (to, subject, text) => {
    if (result.mailFailure) throw new Error('FIXTURE_MAIL_FAILED');
    mail.push({ to, subject, text });
  };
  c.getDriveFileInRoot_ = id => {
    const stored = files.get(id);
    assert.ok(stored);
    return { getSize: () => stored.size, isTrashed: () => false };
  };
  const fakeResponse = (code, headers, body, bytes = null) => ({
    getResponseCode: () => code, getAllHeaders: () => headers,
    getContentText: () => JSON.stringify(body || {}), getContent: () => bytes
  });
  c.UrlFetchApp = { fetch: (url, options) => {
    if (options.method === 'post' && url.startsWith('https://www.googleapis.com/upload/drive/')) {
      assert.equal(lockDepth, 1);
      const meta = JSON.parse(options.payload);
      const id = 'fixture_file_' + (uploads.size + 1);
      const uploadUrl = 'https://example.invalid/resumable/' + id;
      uploads.set(uploadUrl, { id, size: Number(options.headers['X-Upload-Content-Length']), parents: meta.parents, next: 0 });
      return fakeResponse(200, { Location: uploadUrl });
    }
    if (options.headers.Range) {
      const id = url.match(/\/files\/([^?]+)/)[1];
      const record = files.get(id);
      assert.ok(record);
      const [, a, b] = options.headers.Range.match(/^bytes=(\d+)-(\d+)$/).map(Number);
      return fakeResponse(206, { 'Content-Range': 'bytes ' + a + '-' + b + '/' + record.size }, null, Buffer.alloc(b - a + 1, 90));
    }
    const upload = uploads.get(url);
    assert.ok(upload, 'only mocked Drive URLs are used');
    const range = options.headers['Content-Range'];
    if (range.startsWith('bytes */')) result.probeCalls += 1;
    else {
      const [, from, to, total] = range.match(/^bytes (\d+)-(\d+)\/(\d+)$/).map(Number);
      assert.equal(total, upload.size);
      assert.equal(options.payload.length, to - from + 1);
      assert.equal(from, upload.next);
      upload.next = to + 1;
      result.ranges.push([from, to]);
      if (result.onChunk) result.onChunk();
    }
    if (upload.next === upload.size) {
      files.set(upload.id, upload);
      return fakeResponse(200, {}, upload);
    }
    return fakeResponse(308, upload.next ? { Range: 'bytes=0-' + (upload.next - 1) } : {});
  } };
  const dispatch = payload => c.doPost({ postData: { contents: JSON.stringify(payload) } });
  const call = (action, payload = {}) => {
    const response = dispatch({ ...payload, action });
    if (!response.ok) throw new Error(response.error.message);
    return response.data;
  };
  const tokens = Object.fromEntries(seed.Users.map(user => [user.User_ID, c.issueSession_(user).token]));
  const staff = (action, payload = {}, user = 'U01') => call(action, { ...payload, sessionToken: tokens[user] });
  const addGroup = (number, legacyTeamId = '') => staff('catalogSaveGroup', { requestId: requestId(), number,
    project: '專刊作品 ' + number, advisor: '測試老師', email: 'group' + number + '@example.invalid',
    memberCount: '2', leaderName: '組長' + number, memberName: '組員' + number, legacyTeamId }).group;
  const addItem = (format = 'text', verifyEmail = false, due = result.clock + day, textFields) => staff('catalogSaveItem', { requestId: requestId(),
    title: '專刊圖文', requirements: '請依照規格繳交。', format, verifyEmail, dueAt: taipeiDue(due), textFields }).item;
  const assign = (item, group, reviewerId = 'U05') => {
    staff('catalogAssignReviewer', { itemId: item.id, groupIds: [group.id], reviewerId });
    return staff('catalogBoard').rows.find(row => row.item.id === item.id && row.group.id === group.id);
  };
  const share = (target, operation = 'copy', user = target.reviewerId) => {
    const response = staff('catalogLink', { targetId: target.id, revision: target.revision, operation }, user);
    return response.url ? new URL(response.url).hash.slice(1) : '';
  };
  const addTarget = (number = '17', format, verifyEmail) => {
    const group = addGroup(number), item = addItem(format, verifyEmail), target = assign(item, group);
    return { group, item, target, linkToken: share(target) };
  };
  return Object.assign(result, { c, seed, dispatch, call, staff, tokens, addGroup, addItem, assign, share, addTarget });
}

function fundWorkspace() {
  const f = fakeWorkspace();
  const teacher = { User_ID: 'U06', Name: '測試教師', Email: f.c.SHAPE_PRINT_TEACHER_EMAIL, Team_ID: 'T00', Role: 'SuperAdmin', Status: 'Active' };
  f.seed.Users.push(teacher);
  f.tokens.U06 = f.c.issueSession_(teacher).token;
  f.c.SpreadsheetApp = { openById: () => ({ getSheetByName: name => Object.hasOwn(f.data, name) ? {} : null }), flush() {} };
  f.c.ensureSheet_ = (_, name) => { f.data[name] ??= []; };
  f.c.readFreshWorkspaceTables_ = (_, names) => Object.fromEntries(Array.from(names, name => [name, clone(f.data[name])]));
  f.c.commitTablesAtomically_ = (_, tables) => f.c.writeCatalogTables_(tables);
  const owner = { getEmail: () => 'private@example.invalid' };
  const files = new Map();
  let folder = null;
  const iterator = records => ({ hasNext: () => records.length > 0, next: () => records.shift() });
  const access = () => ({ getOwner: () => owner, isTrashed: () => false, getSharingAccess: () => 'PRIVATE', getEditors: () => [owner], getViewers: () => [] });
  f.c.Utilities.newBlob = (bytes, mimeType, name) => ({ getBytes: () => bytes, mimeType, name });
  f.c.DriveApp = { Access: { PRIVATE: 'PRIVATE' }, getFileById: id => files.get(id), getRootFolder: () => ({ ...access(),
    getFoldersByName: () => iterator(folder ? [folder] : []), createFolder: () => {
      folder = { ...access(), getId: () => 'fund-folder', getFilesByName: name => iterator([...files.values()].filter(file => file.name === name)),
        getViewers: () => f.sharedFundFolder ? [{ getEmail: () => 'outside@example.invalid' }] : [],
        createFile: blob => {
          const id = 'fund-photo-' + (files.size + 1);
          const file = { ...access(), name: blob.name, getId: () => id, getMimeType: () => blob.mimeType,
            getSize: () => blob.getBytes().length, getBlob: () => blob, getParents: () => iterator([folder]) };
          files.set(id, file);
          return file;
        } };
      return folder;
    } }) };
  f.fundPhotos = files;
  return f;
}

const fundPlan = { goal: 2400, amount: 200, count: 4, startMonth: '2026-11', managerId: 'U05',
  participantIds: ['U01', 'U04', 'U05'], revision: 0, month: '2026-11' };
const fundPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('fund plans are set by the leader, roll over calendar years, and never enter shared snapshots', () => {
  const f = fundWorkspace();
  assert.equal(f.staff('competitionFundBoard').plan, null);
  assert.equal(Object.hasOwn(f.data, 'Competition_Fund'), false, 'read does not create sheets');
  assert.throws(() => f.call('competitionFundBoard'), /AUTH_REQUIRED/);
  assert.throws(() => f.staff('competitionFundBoard', {}, 'U02'), /FORBIDDEN/);
  for (const actor of ['U04', 'U05', 'U06']) assert.throws(() => f.staff('competitionFundSave', fundPlan, actor), /FORBIDDEN/);
  for (const input of [{ amount: 1.5 }, { count: 37 }, { startMonth: '2026-13' }, { startMonth: '2099-12' }, { managerId: 'U02' },
    { participantIds: ['U02'] }, { participantIds: ['U06'] }, { participantIds: ['U04', 'U04'] }]) {
    assert.throws(() => f.staff('competitionFundSave', { ...fundPlan, ...input }), /FUND_INPUT_INVALID/);
  }
  const board = f.staff('competitionFundSave', fundPlan);
  assert.equal(board.plan.managerName, '收件組員');
  assert.equal(board.plan.expected, 2400);
  assert.equal(board.plan.collected, 0);
  assert.deepEqual(board.periods.map(period => period.month), ['2026-11', '2026-12', '2027-01', '2027-02']);
  const member = f.staff('competitionFundBoard', {}, 'U04');
  assert.equal(member.canConfirm, false);
  assert.deepEqual(member.rows.map(row => row.id), ['U04']);
  assert.deepEqual(member.plan.participants, []);
  assert.deepEqual(member.candidates, []);
  assert.equal(f.staff('competitionFundBoard', {}, 'U05').rows.length, 3);
  assert.equal(f.staff('competitionFundBoard', {}, 'U06').rows.length, 0);
  assert.doesNotMatch(JSON.stringify(f.staff('bootstrap')), /Competition_Fund|managerName/);
  assert.equal(f.mail.length, 0);
});

test('fund receipts are idempotent, reject stale changes, and keep old amounts and confirmer on reversal', () => {
  const f = fundWorkspace();
  f.staff('competitionFundSave', fundPlan);
  const confirm = { month: '2026-11', memberId: 'U04', paid: true, revision: 1, previousEventId: '', requestId: requestId() };
  assert.throws(() => f.staff('competitionFundSetPaid', confirm, 'U04'), /FORBIDDEN/);
  assert.throws(() => f.staff('competitionFundSetPaid', { ...confirm, month: '2026-10' }, 'U05'), /FUND_INPUT_INVALID/);
  assert.throws(() => f.staff('competitionFundSetPaid', { ...confirm, memberId: 'U02' }, 'U05'), /FUND_INPUT_INVALID/);
  f.writeFailure = 'after';
  assert.throws(() => f.staff('competitionFundSetPaid', confirm, 'U05'), /TEST_RESPONSE_LOST/);
  assert.equal(f.staff('competitionFundSetPaid', confirm, 'U05').plan.collected, 200);
  assert.equal(f.data.Competition_Fund_Events.length, 1);
  assert.throws(() => f.staff('competitionFundSetPaid', { ...confirm, requestId: requestId() }), /FUND_CHANGED/);
  assert.throws(() => f.staff('competitionFundSave', { ...fundPlan, amount: 201, revision: 1 }), /FUND_LOCKED/);
  assert.throws(() => f.staff('competitionFundSave', { ...fundPlan, participantIds: ['U01'], revision: 1 }), /FUND_LOCKED/);
  const reassigned = f.staff('competitionFundSave', { ...fundPlan, goal: 2500, managerId: 'U04', revision: 1 });
  assert.equal(reassigned.plan.revision, 2);
  const undo = { ...confirm, previousEventId: confirm.requestId, paid: false, requestId: requestId(), revision: 2 };
  assert.throws(() => f.staff('competitionFundSetPaid', undo, 'U05'), /FORBIDDEN/);
  assert.equal(f.staff('competitionFundSetPaid', undo, 'U04').plan.collected, 0);
  assert.throws(() => f.staff('competitionFundSetPaid', confirm, 'U04'), /FUND_CHANGED/);
  assert.deepEqual(f.data.Competition_Fund_Events.map(event => [event.Amount, event.Paid, event.Actor_ID]), [[200, true, 'U05'], [200, false, 'U04']]);
  f.seed.Users.find(user => user.User_ID === 'U04').Status = 'Suspended';
  assert.throws(() => f.staff('competitionFundSetPaid', undo, 'U04'), /AUTH_EXPIRED/);
  assert.equal(f.staff('competitionFundBoard').plan.managerInactive, true);
});

test('fund announcements track Taiwan deadlines, snapshot collections, and serve only the latest private photo', () => {
  const f = fundWorkspace();
  f.clock = Date.parse('2027-02-27T17:00:00Z');
  for (const user of f.seed.Users) f.tokens[user.User_ID] = f.c.issueSession_(user).token;
  assert.throws(() => f.staff('competitionFundSave', { ...fundPlan, announcementDay: 32 }), /FUND_INPUT_INVALID/);
  const board = f.staff('competitionFundSave', { ...fundPlan, announcementDay: 31 });
  assert.equal(board.periods[0].announcementStatus, 'overdue');
  assert.equal(board.periods[3].deadline, '2027-02-28');
  assert.equal(board.periods[3].announcementStatus, 'pending');
  assert.equal(f.c.competitionFundAnnouncementDeadline_('2028-02', 31), '2028-02-29');
  const confirmation = { month: '2027-02', memberId: 'U01', paid: true, revision: 1, previousEventId: '', requestId: requestId() };
  f.staff('competitionFundSetPaid', confirmation, 'U05');
  const publish = { month: '2027-02', revision: 1, expectedConfirmed: 1, previousAnnouncementId: '', note: '本期收款摘要', requestId: requestId(),
    photo: { mimeType: 'image/png', size: fundPng.length, base64: fundPng.toString('base64') } };
  assert.throws(() => f.staff('competitionFundPublishAnnouncement', publish, 'U04'), /FORBIDDEN/);
  assert.throws(() => f.staff('competitionFundPublishAnnouncement', { ...publish, photo: null }, 'U05'), /FUND_PHOTO_INVALID/);
  assert.throws(() => f.staff('competitionFundPublishAnnouncement', { ...publish, photo: { ...publish.photo, mimeType: 'image/jpeg' } }, 'U05'), /FUND_PHOTO_INVALID/);
  assert.throws(() => f.staff('competitionFundPublishAnnouncement', { ...publish, expectedConfirmed: 0 }, 'U05'), /FUND_CHANGED/);
  f.sharedFundFolder = true;
  assert.throws(() => f.staff('competitionFundPublishAnnouncement', publish, 'U05'), /FUND_PHOTO_UNAVAILABLE/);
  f.sharedFundFolder = false;
  f.writeFailure = 'before';
  assert.throws(() => f.staff('competitionFundPublishAnnouncement', publish, 'U05'), /TEST_SHEETS_UNAVAILABLE/);
  assert.equal(f.fundPhotos.size, 1);
  f.writeFailure = 'after';
  assert.throws(() => f.staff('competitionFundPublishAnnouncement', publish, 'U05'), /TEST_RESPONSE_LOST/);
  const published = f.staff('competitionFundPublishAnnouncement', publish, 'U05');
  assert.equal(f.fundPhotos.size, 1);
  assert.equal(f.data.Competition_Fund_Announcements.length, 1);
  assert.equal(published.announcement.collected, 200);
  assert.equal(published.periods[3].announcementStatus, 'published');
  assert.doesNotMatch(JSON.stringify(published), /fund-photo-|Photo_Hash|contentBase64/);
  const selector = { month: publish.month, announcementId: publish.requestId };
  assert.throws(() => f.staff('competitionFundAnnouncementPhoto', selector, 'U02'), /FORBIDDEN/);
  f.sharedFundFolder = true;
  assert.throws(() => f.staff('competitionFundAnnouncementPhoto', selector, 'U04'), /FUND_PHOTO_UNAVAILABLE/);
  f.sharedFundFolder = false;
  assert.equal(f.staff('competitionFundAnnouncementPhoto', selector, 'U04').contentBase64, publish.photo.base64);
  assert.throws(() => f.staff('competitionFundAnnouncementPhoto', { ...selector, month: '2027-01' }, 'U04'), /FUND_PHOTO_UNAVAILABLE/);
  f.staff('competitionFundSetPaid', { ...confirmation, memberId: 'U04', requestId: requestId() }, 'U05');
  assert.equal(f.staff('competitionFundBoard', { month: publish.month }, 'U04').announcement.confirmed, 1);
  const revised = { ...publish, previousAnnouncementId: publish.requestId, requestId: requestId(), expectedConfirmed: 2, photo: null };
  assert.equal(f.staff('competitionFundPublishAnnouncement', revised, 'U05').announcement.collected, 400);
  assert.equal(f.fundPhotos.size, 1);
  assert.throws(() => f.staff('competitionFundAnnouncementPhoto', selector, 'U04'), /FUND_PHOTO_UNAVAILABLE/);
  assert.equal(f.staff('competitionFundAnnouncementPhoto', { ...selector, announcementId: revised.requestId }, 'U04').size, fundPng.length);
});

test('the fund UI supports one month at a time, manager confirmation, and a private member view', { timeout: 60000 }, async () => {
  const f = fundWorkspace();
  const { server, url } = await startCatalogServer();
  const errors = [];
  let browser;
  try {
    browser = await chromium.launch({ executablePath: chromePath, headless: true });
    async function signIn(userId) {
      const context = await browser.newContext({ viewport: { width: 1380, height: 960 }, reducedMotion: 'reduce' });
      await context.route(/https:\/\/script\.(google|googleusercontent)\.com\//, async route => {
        const request = route.request();
        const payload = request.method() === 'POST' ? JSON.parse(request.postData()) : Object.fromEntries(new URL(request.url()).searchParams);
        const result = request.method() === 'POST' ? f.dispatch(payload) : f.c.doGet({ parameter: payload });
        await route.fulfill({ json: result, headers: { 'access-control-allow-origin': '*' } });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on('pageerror', error => errors.push(error.message));
      const profile = clone(f.seed.Users.find(user => user.User_ID === userId));
      delete profile.Password;
      await page.addInitScript(({ profile, token }) => localStorage.setItem('shapeprint_auth_session_v1',
        JSON.stringify({ userId: profile.User_ID, profile, workspace: 'admin', sessionToken: token })), { profile, token: f.tokens[userId] });
      await page.goto(url);
      await page.locator('#navigation-list button').first().waitFor();
      return page;
    }
    const nav = page => page.locator('#navigation-list').getByRole('button', { name: '競賽基金', exact: true });
    const view = page => page.locator('[data-competition-fund]');
    const leader = await signIn('U01');
    await nav(leader).click();
    await view(leader).getByRole('button', { name: '建立基金' }).click();
    const settings = view(leader).getByRole('form', { name: '基金設定' });
    const goal = settings.getByLabel('基金目標（NT$）');
    const monthly = settings.getByLabel('每人每月應繳（NT$）');
    const periods = settings.getByLabel('繳款期數（月）');
    const dualRole = settings.getByRole('checkbox', { name: 'Audit dual role' });
    await monthly.fill('2000');
    assert.equal(await goal.inputValue(), '6000');
    await periods.fill('5');
    assert.equal(await goal.inputValue(), '30000');
    assert.equal(await dualRole.isVisible(), false);
    await settings.locator('summary').click();
    await dualRole.uncheck();
    assert.equal(await goal.inputValue(), '20000');
    await goal.fill('20003');
    assert.equal(await monthly.inputValue(), '2001');
    await settings.getByText('按目前設定預計收取 NT$ 20,010（每人每月進位到整元，較目標多 NT$ 7）', { exact: true }).waitFor();
    await periods.fill('4');
    assert.equal(await goal.inputValue(), '20003');
    assert.equal(await monthly.inputValue(), '2501');
    await goal.fill('');
    assert.equal(await monthly.inputValue(), '');
    await monthly.fill('100000000');
    assert.equal(await goal.evaluate(input => input.validity.rangeOverflow), true);
    await settings.getByText(/換算目標超過/).waitFor();
    await settings.getByRole('checkbox', { name: 'Audit manager' }).uncheck();
    await settings.getByRole('checkbox', { name: '收件組員' }).uncheck();
    assert.equal(await goal.inputValue(), '');
    await settings.getByText('請先選擇繳款成員。', { exact: true }).waitFor();
    await settings.getByRole('checkbox', { name: 'Audit manager' }).check();
    await settings.getByRole('checkbox', { name: '收件組員' }).check();
    await dualRole.check();
    await goal.fill('2400');
    assert.equal(await monthly.inputValue(), '200');
    await settings.getByLabel('第一期月份').fill('2026-11');
    await settings.getByLabel('管理組員').selectOption('U05');
    await settings.getByLabel('每月公告截止日').selectOption('31');
    await settings.getByText('按目前設定預計收取 NT$ 2,400', { exact: true }).waitFor();
    await settings.getByRole('button', { name: '儲存設定' }).click();
    await view(leader).getByText('基金設定已儲存。').waitFor();
    const manager = await signIn('U05');
    await nav(manager).click();
    const month = view(manager).getByLabel('查看繳款月份');
    await month.selectOption('2027-01');
    await view(manager).getByRole('button', { name: '標記已繳：Audit dual role' }).click();
    await view(manager).getByText('2027 年 1 月 · NT$ 200', { exact: true }).waitFor();
    assert.equal(f.data.Competition_Fund_Events.length, 0);
    await view(manager).getByRole('button', { name: '確認收到', exact: true }).click();
    await view(manager).getByText('已確認繳款。').waitFor();
    assert.equal(f.data.Competition_Fund_Events[0].Month, '2027-01');
    const announcement = page => view(page).getByRole('region', { name: '本期公告' });
    await announcement(manager).getByText('截止 2027/01/31', { exact: true }).waitFor();
    await announcement(manager).getByRole('button', { name: '撰寫公告' }).click();
    const editor = announcement(manager).getByRole('form', { name: '發布繳款公告' });
    await editor.getByRole('button', { name: '發布公告' }).click();
    await view(manager).getByRole('alert').getByText('第一次發布請附上照片。').waitFor();
    await editor.getByLabel('補充說明（選填）').fill('一月繳費紀錄');
    await editor.getByLabel('公告照片').setInputFiles({ name: 'fund-sample.png', mimeType: 'image/png', buffer: fundPng });
    await editor.getByText(/已選取：fund-sample\.png/).waitFor();
    await editor.getByRole('button', { name: '發布公告' }).click();
    await announcement(manager).getByText('已公告', { exact: true }).waitFor();
    await view(leader).getByRole('button', { name: '重新整理', exact: true }).click();
    await view(leader).getByText('NT$ 200', { exact: true }).waitFor();
    await view(leader).getByRole('button', { name: '基金設定', exact: true }).click();
    assert.equal(await monthly.getAttribute('readonly'), '');
    await goal.fill('2500');
    assert.equal(await monthly.inputValue(), '200');
    await settings.getByRole('button', { name: '取消', exact: true }).click();
    const member = await signIn('U04');
    await nav(member).click();
    await view(member).getByLabel('查看繳款月份').selectOption('2027-01');
    await view(member).getByText('已確認', { exact: true }).waitFor();
    assert.equal(await view(member).getByRole('listitem').count(), 1);
    assert.equal(await view(member).getByRole('button', { name: /標記已繳|撤銷確認|基金設定/ }).count(), 0);
    assert.equal(await announcement(member).getByRole('button', { name: '更新公告' }).count(), 0);
    await announcement(member).getByText('一月繳費紀錄', { exact: true }).waitFor();
    await announcement(member).getByRole('button', { name: '查看照片' }).click();
    await announcement(member).getByRole('img', { name: '本期繳款公告照片' }).waitFor();
    await member.waitForFunction(() => document.querySelector('img[alt="本期繳款公告照片"]')?.naturalWidth > 0);
    await member.setViewportSize({ width: 390, height: 844 });
    assert.equal(await view(member).evaluate(node => node.scrollWidth <= Math.ceil(node.getBoundingClientRect().width)), true);
    if (process.env.FUND_ARTIFACT_DIR) {
      fs.mkdirSync(process.env.FUND_ARTIFACT_DIR, { recursive: true });
      await view(manager).screenshot({ path: path.join(process.env.FUND_ARTIFACT_DIR, 'fund-manager.png'), animations: 'disabled' });
      await view(member).screenshot({ path: path.join(process.env.FUND_ARTIFACT_DIR, 'fund-mobile.png'), animations: 'disabled' });
    }
    await view(manager).getByRole('button', { name: '撤銷確認：Audit dual role' }).click();
    await view(manager).getByRole('button', { name: '確認撤銷' }).click();
    await view(manager).getByText('已撤銷這筆確認。').waitFor();
    await announcement(manager).getByText('繳款狀態已有更新，可重新發布公告。').waitFor();
    const outside = await signIn('U02');
    assert.equal(await nav(outside).count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('the roster is management-only, preserves old teams, and never creates external accounts', () => {
  const f = fakeWorkspace();
  const old = clone(f.seed);
  assert.throws(() => f.staff('catalogSaveGroup', {}, 'U05'), /FORBIDDEN/);
  const a = f.addGroup('01', 'T01');
  assert.equal(a.advisor, '測試老師');
  assert.equal(a.memberCount, 2);
  assert.equal(a.displayName, '組長01、組員01');
  assert.throws(() => f.addGroup('1'), /已在名冊/);
  assert.throws(() => f.addGroup('02', 'T01'), /已在名冊/);
  assert.deepEqual(f.seed, old);
  assert.equal(f.staff('catalogBoard', {}, 'U05').groups.length, 0);
  assert.throws(() => f.staff('catalogBoard', {}, 'U02'), /FORBIDDEN/);
  assert.throws(() => f.assign(f.addItem(), f.addGroup('02', 'T02'), 'U04'), /畢製組別/);
});

test('roster requires the right names for one-person and two-person groups', () => {
  const f = fakeWorkspace();
  const request = { requestId: requestId(), number: '01', advisor: '老師' };
  assert.throws(() => f.staff('catalogSaveGroup', { ...request, memberCount: '1' }), /組員姓名/);
  assert.throws(() => f.staff('catalogSaveGroup', { ...request, memberCount: '2', leaderName: '組長' }), /組長與組員姓名/);
  assert.throws(() => f.staff('catalogSaveGroup', { ...request, memberCount: '3', leaderName: '組長' }), /一人一組或兩人一組/);

  const one = f.staff('catalogSaveGroup', { requestId: requestId(), number: '01', advisor: '老師', memberCount: '1', leaderName: '單人同學' }).group;
  const two = f.staff('catalogSaveGroup', { requestId: requestId(), number: '02', advisor: '老師', memberCount: '2', leaderName: '組長同學', memberName: '組員同學' }).group;
  assert.deepEqual([one.memberCount, one.displayName, one.memberName], [1, '單人同學', '']);
  assert.deepEqual([two.memberCount, two.displayName], [2, '組長同學、組員同學']);
});

test('a group number still links to its existing team and blocks self-review', () => {
  const f = fakeWorkspace();
  f.seed.Teams.find(team => team.Team_ID === 'T01').Team_Name = '17 專刊小組';
  f.seed.Users.find(user => user.User_ID === 'U04').Team_ID = 'T01';
  f.tokens.U04 = f.c.issueSession_(f.seed.Users.find(user => user.User_ID === 'U04')).token;
  const group = f.staff('catalogSaveGroup', { requestId: requestId(), number: '17', advisor: '老師',
    memberCount: '1', leaderName: '小組同學' }).group;
  assert.equal(group.legacyTeamId, 'T01');
  assert.throws(() => f.assign(f.addItem(), group, 'U04'), /畢製組別/);
});

test('only a manager can explicitly switch, including invalidating old outside sessions on the API', () => {
  const f = fakeWorkspace();
  assert.equal(f.staff('catalogBoard').workspaceInternalOnly, false);
  assert.throws(() => f.staff('catalogWorkspaceMode', { internalOnly: true, revision: 0, confirm: true }, 'U05'), /FORBIDDEN/);
  assert.throws(() => f.staff('catalogWorkspaceMode', { internalOnly: true, revision: 0 }), /確認/);
  const old = clone(f.seed);
  const intake = f.addTarget();
  f.staff('catalogWorkspaceMode', { internalOnly: true, revision: 0, confirm: true });
  assert.equal(f.call('getRegistrationOptions').registrationOptions.leader, false);
  assert.equal(f.call('getRegistrationOptions').registrationOptions.shapePrint, true);
  for (const action of ['bootstrap', 'heatmap', 'registerLeader', 'registerMember', 'activatePending']) {
    assert.throws(() => f.staff(action, {}, 'U02'), /WORKSPACE_INTERNAL_ONLY/);
  }
  assert.throws(() => f.call('login', { email: f.seed.Users[1].Email, password: 'local-test-password' }), /WORKSPACE_INTERNAL_ONLY/);
  f.call('requestPasswordReset', { email: f.seed.Users[1].Email });
  assert.equal(f.mail.length, 0);
  assert.equal(f.call('catalogGuestDescribe', intake).verified, true);
  assert.deepEqual(f.seed, old);
  assert.throws(() => f.staff('catalogWorkspaceMode', { internalOnly: false, revision: 0, confirm: true }), /CATALOG_CHANGED/);
  f.staff('catalogWorkspaceMode', { internalOnly: false, revision: 1, confirm: true });
  assert.equal(f.call('getRegistrationOptions').registrationOptions.leader, true);
  assert.equal(f.staff('bootstrap', {}, 'U02').currentUser.User_ID, 'U02');
});

test('links are scoped, can be copied without changing, and stop working after revoke or contact change', () => {
  const f = fakeWorkspace();
  const a = f.addTarget('17'), b = f.addTarget('18');
  const before = f.reads;
  assert.throws(() => f.call('catalogGuestDescribe', { linkToken: a.linkToken + 'a' }), /CATALOG_LINK_INVALID/);
  assert.equal(f.reads, before);
  assert.throws(() => f.call('catalogGuestDescribe', { linkToken: b.linkToken.split('.')[0] + a.linkToken.slice(a.linkToken.indexOf('.')) }), /CATALOG_LINK_INVALID/);
  const info = f.call('catalogGuestDescribe', { linkToken: a.linkToken, targetId: b.target.id, groupId: b.group.id });
  assert.equal(info.groupNumber, '17');
  assert.doesNotMatch(JSON.stringify(info), /example\.invalid|Contact_Email|Drive_File_ID|Reviewer_ID/);
  assert.equal(f.share(f.staff('catalogBoard').rows[0]), a.linkToken);
  assert.throws(() => f.share(b.target, 'copy', 'U04'), /FORBIDDEN/);
  const current = f.staff('catalogBoard').rows[0];
  const renewed = f.share(current, 'rotate');
  assert.notEqual(renewed, a.linkToken);
  assert.throws(() => f.call('catalogGuestDescribe', { linkToken: a.linkToken }), /CATALOG_LINK_INVALID/);
  f.share(f.staff('catalogBoard').rows[0], 'revoke');
  assert.throws(() => f.call('catalogGuestDescribe', { linkToken: renewed }), /CATALOG_LINK_INVALID/);
  f.staff('catalogSaveGroup', { ...b.group, groupId: b.group.id, email: 'new@example.invalid' });
  assert.throws(() => f.call('catalogGuestDescribe', b), /CATALOG_LINK_INVALID/);
});

test('optional mail verification binds a time-limited grant to the exact link and roster address', () => {
  const f = fakeWorkspace(), a = f.addTarget('17', 'text', true), b = f.addTarget('18', 'text', true);
  const access = { linkToken: a.linkToken };
  assert.equal(f.call('catalogGuestDescribe', access).requirements, undefined);
  assert.throws(() => f.call('catalogGuestBegin', { ...access, text: 'Hello', requestId: requestId(), expectedVersion: 0 }), /VERIFY_REQUIRED/);
  assert.equal(f.call('catalogGuestSendCode', { ...access, email: 'wrong@example.invalid' }).sent, true);
  assert.equal(f.mail[0].to, f.data.Catalog_Roster.find(group => group.Group_ID === a.group.id).Contact_Email);
  assert.throws(() => f.call('catalogGuestSendCode', access), /CATALOG_WAIT/);
  const code = f.mail[0].text.match(/驗證碼：(\d{6})/)[1];
  assert.throws(() => f.call('catalogGuestVerify', { ...access, code: code === '111111' ? '222222' : '111111' }), /CODE_INVALID/);
  const { guestGrant } = f.call('catalogGuestVerify', { ...access, code });
  assert.throws(() => f.call('catalogGuestVerify', { ...access, code }), /CODE_INVALID/);
  assert.equal(f.call('catalogGuestDescribe', { ...access, guestGrant }).verified, true);
  assert.equal(f.call('catalogGuestDescribe', { linkToken: b.linkToken, guestGrant }).verified, false);
  f.clock += 7200001;
  assert.equal(f.call('catalogGuestDescribe', { ...access, guestGrant }).verified, false);
});

test('a roster without an email uses its private link and reports review results without mail', () => {
  const f = fakeWorkspace();
  const group = f.staff('catalogSaveGroup', { requestId: requestId(), number: '19', advisor: '老師',
    memberCount: '1', leaderName: '單人同學' }).group;
  const item = f.addItem('text', true);
  const target = f.assign(item, group);
  const linkToken = f.share(target);
  const guest = f.call('catalogGuestDescribe', { linkToken });
  assert.equal(guest.requiresVerification, false);
  assert.equal(guest.verified, true);
  assert.deepEqual(guest.members, ['單人同學']);
  assert.deepEqual(f.call('catalogGuestSendCode', { linkToken }), { sent: false });

  f.call('catalogGuestBegin', { linkToken, requestId: requestId(), text: '專刊內容', expectedVersion: 0 });
  const row = f.staff('catalogBoard').rows.find(entry => entry.id === target.id);
  const reviewed = f.staff('catalogReview', { targetId: row.id, submissionId: row.versions[0].id, decision: 'approved' }, 'U05');
  assert.equal(reviewed.submission.mailStatus, 'no-email');
  assert.equal(f.mail.length, 0);
  assert.equal(f.call('catalogGuestDescribe', { linkToken }).latest.status, 'approved');
});

test('a reassigned reviewer loses access, reviews are single-use, and correction preserves both versions', () => {
  const f = fakeWorkspace(), a = f.addTarget();
  const send1 = { linkToken: a.linkToken, requestId: requestId(), text: '第一版', expectedVersion: 0 };
  f.writeFailure = 'after';
  assert.throws(() => f.call('catalogGuestBegin', send1), /CATALOG_UNAVAILABLE/);
  assert.equal(f.call('catalogGuestBegin', send1).receipt.version, 1);
  assert.equal(f.data.Catalog_Submissions.length, 1);
  assert.throws(() => f.call('catalogGuestBegin', { ...send1, text: 'changed' }), /CATALOG_CHANGED/);
  const row = f.staff('catalogBoard').rows[0], sub = row.versions[0];
  const review = { targetId: row.id, submissionId: sub.id, decision: 'returned', note: '請補圖說', correctionDays: 7 };
  assert.throws(() => f.staff('catalogReview', review), /FORBIDDEN/);
  assert.throws(() => f.staff('catalogReview', { ...review, note: '' }, 'U05'), /補件原因/);
  f.staff('catalogAssignReviewer', { targetId: row.id, revision: row.revision, reviewerId: 'U04' });
  assert.equal(f.staff('catalogBoard', {}, 'U05').rows.length, 0);
  assert.throws(() => f.staff('catalogReview', review, 'U05'), /FORBIDDEN/);
  assert.throws(() => f.staff('getFilePreview', { recordType: 'catalog-submission', recordId: sub.id }, 'U05'), /FORBIDDEN/);
  f.clock += 2 * day;
  f.tokens.U04 = f.c.issueSession_(f.seed.Users[3]).token;
  f.tokens.U01 = f.c.issueSession_(f.seed.Users[0]).token;
  f.mailFailure = true;
  assert.equal(f.staff('catalogReview', review, 'U04').submission.mailStatus, 'failed');
  assert.equal(f.call('catalogGuestDescribe', a).latest.note, '請補圖說');
  assert.equal(f.call('catalogGuestDescribe', a).canSubmit, true);
  assert.throws(() => f.call('catalogGuestBegin', { ...send1, requestId: requestId() }), /CATALOG_CHANGED/);
  const send2 = { ...send1, requestId: requestId(), text: '補件版', expectedVersion: 1 };
  assert.equal(f.call('catalogGuestBegin', send2).receipt.version, 2);
  assert.throws(() => f.staff('catalogReview', review, 'U04'), /CATALOG_CHANGED/);
  f.mailFailure = false;
  const pass = { targetId: row.id, submissionId: f.staff('catalogBoard').rows[0].versions[0].id, decision: 'approved' };
  assert.equal(f.staff('catalogReview', pass, 'U04').submission.mailStatus, 'sent');
  assert.equal(f.staff('catalogReview', pass, 'U04').submission.mailStatus, 'sent');
  assert.equal(f.mail.length, 1);
  assert.deepEqual(f.data.Catalog_Submissions.map(s => [s.Version, s.Status, s.Text_Content]), [[1, 'returned', '第一版'], [2, 'approved', '補件版']]);
  assert.equal(f.call('catalogGuestDescribe', a).canSubmit, false);
});

test('private files are not accepted via forged IDs, and revocation is checked again after a last chunk', () => {
  const f = fakeWorkspace(), a = f.addTarget('17', 'both');
  const begin = { linkToken: a.linkToken, requestId: requestId(), expectedVersion: 0, text: '測試', fileName: 'sample.zip', fileSize: 2 };
  assert.throws(() => f.call('catalogGuestBegin', { ...begin, fileSize: 100 * MiB + 1 }), /INPUT_INVALID/);
  assert.throws(() => f.call('catalogGuestBegin', { ...begin, fileName: 'sample.html' }), /INPUT_INVALID/);
  f.publicFolder = true;
  assert.throws(() => f.call('catalogGuestBegin', begin), /私人/);
  f.publicFolder = false;
  f.call('catalogGuestBegin', { ...begin, driveFileId: 'forged' });
  const chunk = { linkToken: a.linkToken, requestId: begin.requestId, start: 0, end: 1, base64: 'QUI=' };
  assert.throws(() => f.call('catalogGuestChunk', { ...chunk, end: 2 }), /UPLOAD_RETRY/);
  assert.equal(f.ranges.length, 0);
  f.onChunk = () => f.share(f.staff('catalogBoard').rows[0], 'revoke');
  assert.throws(() => f.call('catalogGuestChunk', chunk), /CATALOG_LINK_INVALID/);
  assert.equal(f.data.Catalog_Submissions.length, 0);
});

test('older catalog tables can be read without the new trailing columns', () => {
  const { c } = fakeWorkspace();
  const names = ['Catalog_Items', 'Catalog_Submissions'];
  const itemHeader = Array.from(c.TABLE_SCHEMAS.Catalog_Items.headers).slice(0, -2);
  const submissionHeader = Array.from(c.TABLE_SCHEMAS.Catalog_Submissions.headers).slice(0, -1);
  const values = [
    { values: [itemHeader, ['old-item', '舊項目', '原有規格', 'text', '', false, 1, '']] },
    { values: [submissionHeader, ['old-submission', 'old-target', '', '', '', 1, '原有文字']] }
  ];
  c.UrlFetchApp.fetch = url => {
    assert.deepEqual(new URL(url).searchParams.getAll('ranges'), ["'Catalog_Items'", "'Catalog_Submissions'"]);
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ valueRanges: values }) };
  };
  const tables = c.readFreshWorkspaceTables_(c.getConfig_(), names);
  assert.equal(tables.Catalog_Items[0].Text_Fields, null);
  assert.equal(tables.Catalog_Items[0].Deleted_At, '');
  assert.equal(tables.Catalog_Submissions[0].Text_Content, '原有文字');
  assert.equal(tables.Catalog_Submissions[0].Text_Answers, null);
  values[0].values[1][itemHeader.length] = 'unexpected data without a header';
  assert.throws(() => c.readFreshWorkspaceTables_(c.getConfig_(), names), /SYNC_NOT_CONFIRMED/);
  itemHeader.push('Text_Fields');
  values[0].values[1][8] = JSON.stringify([{ label: '作品介紹' }]);
  assert.equal(c.readFreshWorkspaceTables_(c.getConfig_(), names).Catalog_Items[0].Text_Fields[0].label, '作品介紹');
});

test('deleting and restoring an item preserves submissions, scopes links and enforces permissions and revisions', () => {
  const f = fakeWorkspace(), a = f.addTarget('17'), b = f.addTarget('18');
  f.call('catalogGuestBegin', { linkToken: a.linkToken, requestId: requestId(), expectedVersion: 0, text: '已提交的說明' });
  const before = clone(f.data.Catalog_Submissions);
  const edit = { itemId: a.item.id, revision: a.item.revision, deleted: true, confirm: true };
  assert.throws(() => f.staff('catalogSetItemDeleted', edit, 'U05'), /FORBIDDEN/);
  assert.throws(() => f.staff('catalogSetItemDeleted', { ...edit, confirm: false }), /確認/);
  assert.throws(() => f.staff('catalogSetItemDeleted', { ...edit, revision: 0 }), /CATALOG_CHANGED/);
  f.writeFailure = 'after';
  assert.throws(() => f.staff('catalogSetItemDeleted', edit), /TEST_RESPONSE_LOST/);
  const writes = f.cloudWrites;
  assert.equal(f.staff('catalogSetItemDeleted', edit).deleted, true);
  assert.equal(f.cloudWrites, writes);
  assert.deepEqual(f.data.Catalog_Submissions, before);
  assert.equal(f.data.Catalog_Targets.length, 2);
  assert.equal(f.mail.length, 0);
  const board = f.staff('catalogBoard');
  assert.deepEqual(board.items.map(item => item.id), [b.item.id]);
  assert.deepEqual(board.rows.map(row => row.id), [b.target.id]);
  assert.deepEqual(f.staff('catalogBoard', {}, 'U05').deletedItems, []);
  assert.throws(() => f.call('catalogGuestDescribe', a), /CATALOG_LINK_INVALID/);
  assert.equal(f.call('catalogGuestDescribe', b).verified, true);
  assert.throws(() => f.staff('catalogLink', { targetId: a.target.id, operation: 'copy' }, 'U05'), /FORBIDDEN/);
  assert.throws(() => f.staff('catalogAssignReviewer', { targetId: a.target.id, reviewerId: 'U05' }), /找不到/);
  assert.throws(() => f.staff('catalogSaveItem', { itemId: a.item.id }), /已刪除/);
  const restore = { ...edit, revision: board.deletedItems[0].revision, deleted: false };
  assert.equal(f.staff('catalogSetItemDeleted', restore).deleted, false);
  assert.throws(() => f.staff('catalogSetItemDeleted', edit), /CATALOG_CHANGED/);
  const row = f.staff('catalogBoard').rows.find(entry => entry.id === a.target.id);
  assert.equal(row.item.dueAt, a.item.dueAt);
  assert.equal(row.linkStatus, 'inactive');
  assert.equal(row.versions[0].text, '已提交的說明');
  assert.notEqual(f.share(row), a.linkToken);
  assert.throws(() => f.call('catalogGuestDescribe', a), /CATALOG_LINK_INVALID/);
});

test('permanent deletion only purges a recycled item and its records while preserving Drive originals and preventing replay', () => {
  const f = fakeWorkspace(), a = f.addTarget('17', 'both'), b = f.addTarget('18');
  const upload = { linkToken: a.linkToken, requestId: requestId(), expectedVersion: 0, fileName: 'original.zip', fileSize: 2, text: '要永久移除的文字' };
  f.call('catalogGuestBegin', upload);
  f.call('catalogGuestChunk', { ...upload, start: 0, end: 1, base64: 'QUI=' });
  const submission = f.data.Catalog_Submissions[0];
  f.staff('catalogReview', { targetId: a.target.id, submissionId: submission.Submission_ID, decision: 'approved', note: '舊審核意見' }, 'U05');
  f.call('catalogGuestBegin', { linkToken: b.linkToken, requestId: requestId(), expectedVersion: 0, text: '另一個項目' });
  const preserved = clone(f.data.Catalog_Submissions[1]);
  const roster = clone(f.data.Catalog_Roster);
  const purge = { itemId: a.item.id, revision: a.item.revision, confirmation: '永久刪除' };
  const change = { ...purge, confirm: true, deleted: true };
  assert.throws(() => f.call('catalogPurgeItem', purge), /AUTH_REQUIRED/);
  assert.throws(() => f.staff('catalogPurgeItem', purge, 'U05'), /FORBIDDEN/);
  assert.throws(() => f.staff('catalogPurgeItem', purge), /只能永久刪除/);
  f.staff('catalogSetItemDeleted', change);
  const [deleted] = f.staff('catalogBoard').deletedItems;
  assert.deepEqual(deleted.purgeCounts, { targets: 1, submissions: 1, attachments: 1 });
  assert.doesNotMatch(JSON.stringify(deleted), /要永久移除的文字|舊審核意見|fixture_file_/);
  assert.throws(() => f.staff('catalogPurgeItem', { ...purge, revision: deleted.revision, confirmation: '確認' }), /請輸入/);
  f.staff('catalogSetItemDeleted', { ...change, revision: deleted.revision, deleted: false });
  assert.throws(() => f.staff('catalogPurgeItem', { ...purge, revision: deleted.revision }), /只能永久刪除/);
  f.staff('catalogSetItemDeleted', { ...change, revision: deleted.revision + 1 });
  assert.throws(() => f.staff('catalogPurgeItem', { ...purge, revision: deleted.revision }), /CATALOG_CHANGED/);
  const request = { ...purge, revision: deleted.revision + 2 };
  f.writeFailure = 'before';
  assert.throws(() => f.staff('catalogPurgeItem', request), /TEST_SHEETS_UNAVAILABLE/);
  assert.equal(f.data.Catalog_Submissions.length, 2);
  assert.equal(f.data.Catalog_Purged_Items.length, 0);
  f.writeFailure = 'after';
  assert.throws(() => f.staff('catalogPurgeItem', request), /TEST_RESPONSE_LOST/);
  const writes = f.cloudWrites;
  assert.deepEqual(f.staff('catalogPurgeItem', request), { itemId: a.item.id, purged: true });
  assert.equal(f.cloudWrites, writes);
  assert.deepEqual(f.data.Catalog_Items.map(item => item.Item_ID), [b.item.id]);
  assert.deepEqual(f.data.Catalog_Targets.map(target => target.Target_ID), [b.target.id]);
  assert.deepEqual(f.data.Catalog_Submissions, [preserved]);
  assert.deepEqual(f.data.Catalog_Roster, roster);
  assert.equal(Boolean(f.files.get(submission.Drive_File_ID).trashed), false);
  assert.equal(f.data.Catalog_Purged_Items[0].Drive_Cleanup, null);
  assert.deepEqual(f.staff('catalogBoard').deletedItems, []);
  assert.throws(() => f.staff('catalogSetItemDeleted', { ...change, deleted: false }), /CATALOG_CHANGED/);
  assert.throws(() => f.staff('catalogSaveItem', { requestId: a.item.id.slice(4) }), /已永久刪除/);
  assert.throws(() => f.call('catalogGuestDescribe', a), /CATALOG_LINK_INVALID/);
  assert.equal(f.call('catalogGuestDescribe', b).verified, true);
});

test('opt-in cleanup trashes only owned attachments after a confirmed purge and can retry a Drive failure', () => {
  const f = fakeWorkspace(), a = f.addTarget('17', 'file'), b = f.addTarget('18', 'file');
  for (const entry of [a, b]) {
    const upload = { linkToken: entry.linkToken, requestId: requestId(), expectedVersion: 0, fileName: 'original.zip', fileSize: 2 };
    f.call('catalogGuestBegin', upload);
    f.call('catalogGuestChunk', { ...upload, start: 0, end: 1, base64: 'QUI=' });
  }
  const [first, shared] = f.data.Catalog_Submissions;
  const moved = 'fixture_moved_file';
  f.files.set(moved, { parents: ['ROOT'] });
  f.data.Catalog_Submissions.push({ Target_ID: first.Target_ID, Drive_File_ID: shared.Drive_File_ID }, { Target_ID: first.Target_ID, Drive_File_ID: moved });
  f.staff('catalogSetItemDeleted', { itemId: a.item.id, revision: a.item.revision, deleted: true, confirm: true });
  const [item] = f.staff('catalogBoard').deletedItems;
  assert.equal(item.purgeCounts.attachments, 3);
  const payload = { itemId: item.id, revision: item.revision, confirmation: '永久刪除', trashAttachments: true };
  f.writeFailure = 'before';
  assert.throws(() => f.staff('catalogPurgeItem', payload), /TEST_SHEETS_UNAVAILABLE/);
  assert.equal(Boolean(f.files.get(first.Drive_File_ID).trashed), false);
  f.driveTrashFailure = true;
  assert.deepEqual(f.staff('catalogPurgeItem', payload).driveTrash, { trashed: 0, retained: 2, pending: 1 });
  assert.equal(f.staff('catalogBoard').pendingAttachmentTrash[0].remaining, 1);
  assert.deepEqual(f.staff('catalogBoard', {}, 'U05').pendingAttachmentTrash, []);
  assert.throws(() => f.staff('catalogRetryPurgeAttachments', payload, 'U05'), /FORBIDDEN/);
  f.driveTrashFailure = false;
  assert.deepEqual(f.staff('catalogRetryPurgeAttachments', payload).driveTrash, { trashed: 1, retained: 2, pending: 0 });
  assert.equal(f.files.get(first.Drive_File_ID).trashed, true);
  assert.equal(Boolean(f.files.get(shared.Drive_File_ID).trashed), false);
  assert.equal(Boolean(f.files.get(moved).trashed), false);
  assert.deepEqual(f.staff('catalogBoard').pendingAttachmentTrash, []);
  assert.deepEqual(f.staff('catalogPurgeItem', payload).driveTrash, { trashed: 1, retained: 2, pending: 0 });
  assert.throws(() => f.staff('catalogPurgeItem', { ...payload, trashAttachments: false }), /CATALOG_CHANGED/);
});

test('deletion during transfer prevents the last chunk from creating a submission', () => {
  const f = fakeWorkspace(), a = f.addTarget('17', 'file');
  const begin = { linkToken: a.linkToken, requestId: requestId(), expectedVersion: 0, fileName: 'sample.zip', fileSize: 2 };
  f.call('catalogGuestBegin', begin);
  f.onChunk = () => f.staff('catalogSetItemDeleted', { itemId: a.item.id, revision: a.item.revision, deleted: true, confirm: true });
  assert.throws(() => f.call('catalogGuestChunk', { ...begin, start: 0, end: 1, base64: 'QUI=' }), /CATALOG_LINK_INVALID/);
  assert.equal(f.data.Catalog_Submissions.length, 0);
});

test('managers can configure the format before assignment and cannot change the requirements mid-submission', () => {
  const f = fakeWorkspace();
  const rules = [{ label: '作品介紹', minChars: 3, maxChars: 10 }, { label: '設計理念', minChars: 2, maxChars: 20 }];
  const add = (fields, format = 'text') => f.addItem(format, false, f.clock + day, fields);
  assert.throws(() => add([], 'both'), /1 至 8/);
  assert.throws(() => add(rules, 'file'), /不需要文字/);
  assert.throws(() => add([{ ...rules[0], minChars: 11 }]), /最少與最多字數/);
  assert.throws(() => add([{ ...rules[0], minChars: 2.5 }]), /最少與最多字數/);
  assert.throws(() => add([rules[0], { ...rules[1], label: ' 作品介紹 ' }]), /不可重複/);
  assert.throws(() => add([{ ...rules[0], maxChars: 4990 }, rules[1]]), /加總/);
  assert.equal(f.data.Catalog_Items.length, 0);
  const initial = add([], 'file');
  const update = (item, format, textFields) => f.staff('catalogSaveItem', {
    ...item, itemId: item.id, dueAt: taipeiDue(Date.parse(item.dueAt)), format, textFields
  }).item;
  const item = update(initial, 'both', rules);
  assert.equal(item.fieldsLocked, false);
  assert.deepEqual(item.textFields, rules.map((rule, index) => ({ id: 'text-' + (index + 1), ...rule })));
  f.assign(item, f.addGroup('21'));
  const locked = f.staff('catalogBoard').items.find(row => row.id === item.id);
  assert.equal(locked.fieldsLocked, true);
  assert.throws(() => update(locked, 'file', []), /不能更改/);
  assert.throws(() => update(locked, 'both', [rules[1]]), /不能更改/);
  const renamed = update({ ...locked, title: '修正標題' }, 'both', undefined);
  assert.equal(renamed.title, '修正標題');
  assert.deepEqual(renamed.textFields, item.textFields);
});

test('structured answers enforce each range and keep labels and values in each reviewed version', () => {
  const f = fakeWorkspace();
  const rules = [{ label: '作品介紹', minChars: 3, maxChars: 4 }, { label: '設計理念', minChars: 2, maxChars: 3 }];
  const item = f.addItem('text', false, f.clock + day, rules);
  const target = f.assign(item, f.addGroup('21'));
  const linkToken = f.share(target);
  const form = f.call('catalogGuestDescribe', { linkToken });
  assert.deepEqual(form.textFields, item.textFields);
  const answers = [{ id: 'text-1', value: ' 甲乙😀 ' }, { id: 'text-2', value: '丙丁戊', label: '不可竄改名稱' }];
  const begin = { linkToken, requestId: requestId(), expectedVersion: 0, textAnswers: answers };
  assert.throws(() => f.call('catalogGuestBegin', { ...begin, textAnswers: undefined, text: '舊版送出' }), /CATALOG_FORM_UPDATED/);
  assert.throws(() => f.call('catalogGuestBegin', { ...begin, textAnswers: [answers[0]] }), /INPUT_INVALID/);
  assert.throws(() => f.call('catalogGuestBegin', { ...begin, textAnswers: [answers[0], answers[0]] }), /INPUT_INVALID/);
  assert.throws(() => f.call('catalogGuestBegin', { ...begin, textAnswers: [answers[0], { ...answers[1], id: 'unknown' }] }), /缺少「設計理念」/);
  assert.throws(() => f.call('catalogGuestBegin', { ...begin, textAnswers: [{ ...answers[0], value: ' 甲乙 ' }, answers[1]] }), /作品介紹.*目前 2 字/);
  assert.throws(() => f.call('catalogGuestBegin', { ...begin, textAnswers: [answers[0], { ...answers[1], value: '甲乙丙丁' }] }), /設計理念.*目前 4 字/);
  assert.throws(() => f.call('catalogGuestBegin', { ...begin, fileName: 'sample.zip', fileSize: 3 }), /只收文字/);
  assert.equal(f.data.Catalog_Submissions.length, 0);
  f.writeFailure = 'after';
  assert.throws(() => f.call('catalogGuestBegin', begin), /CATALOG_UNAVAILABLE/);
  assert.equal(f.call('catalogGuestBegin', { ...begin, textAnswers: answers.slice().reverse() }).receipt.version, 1);
  const row = f.staff('catalogBoard', {}, 'U05').rows.find(entry => entry.id === target.id);
  assert.deepEqual(row.versions[0].textAnswers, [
    { id: 'text-1', label: '作品介紹', value: '甲乙😀' }, { id: 'text-2', label: '設計理念', value: '丙丁戊' }
  ]);
  assert.doesNotMatch(JSON.stringify(f.call('catalogGuestDescribe', { linkToken }).latest), /甲乙|丙丁/);
  f.staff('catalogReview', { targetId: target.id, submissionId: row.versions[0].id, decision: 'returned', note: '請修改作品介紹' }, 'U05');
  assert.equal(f.call('catalogGuestBegin', { ...begin, requestId: requestId(), expectedVersion: 1,
    textAnswers: [{ ...answers[0], value: '修正完整' }, answers[1]] }).receipt.version, 2);
  assert.deepEqual(f.data.Catalog_Submissions.map(entry => entry.Text_Answers[0].value), ['甲乙😀', '修正完整']);
});

test('guest layout separates guidance from the draft and keeps details behind verification', { timeout: 60000 }, async () => {
  const f = fakeWorkspace();
  const group = f.staff('catalogSaveGroup', { requestId: requestId(), number: '17', advisor: '示範老師',
    memberCount: 2, leaderName: '示範組長', memberName: '示範組員' }).group;
  const requirements = '請上傳作品原檔，並填寫 150 字以內的作品介紹。\n\n檔案命名：組別_作品名稱.zip\n如有多張圖片，請和原檔一起打包。';
  const item = f.staff('catalogSaveItem', { requestId: requestId(), title: '專刊作品圖文', requirements, format: 'both',
    verifyEmail: false, dueAt: taipeiDue(f.clock + 7 * day) }).item;
  const linkToken = f.share(f.assign(item, group));
  const legacy = f.addTarget('18', 'text', true);
  const fileOnly = f.addTarget('19', 'file', false);
  const textOnly = f.addItem('text', false, f.clock + day, [{ label: '作品介紹', minChars: 2, maxChars: 80 }]);
  const textOnlyLink = f.share(f.assign(textOnly, fileOnly.group));
  const { server, url } = await startCatalogServer();
  let browser;
  const errors = [];
  let describeFails = false;
  let calls = 0;
  try {
    browser = await chromium.launch({ executablePath: chromePath, headless: true });
    async function guest(viewport) {
      const page = await browser.newPage({ viewport, timezoneId: 'Asia/Taipei', reducedMotion: 'reduce' });
      page.setDefaultTimeout(8000);
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/https:\/\/script\.(google|googleusercontent)\.com\//, route => {
        const payload = JSON.parse(route.request().postData());
        assert.match(payload.action, /^catalogGuest/);
        calls++;
        if (describeFails && payload.action === 'catalogGuestDescribe') {
          describeFails = false;
          return route.abort('failed');
        }
        return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify(f.dispatch(payload)) });
      });
      return page;
    }
    async function assertActiveStep(page, name) {
      const steps = page.locator('#intake-steps');
      assert.equal(await steps.locator('[aria-current="step"]').count(), 1);
      assert.equal(await steps.locator('[aria-current="step"]').getAttribute('data-step'), name);
      const aligned = await steps.evaluate(rail => {
        const capsule = getComputedStyle(rail, '::before');
        const track = rail.getBoundingClientRect();
        const active = rail.querySelector('[aria-current="step"]').getBoundingClientRect();
        const offset = new DOMMatrixReadOnly(capsule.transform).m41;
        const left = track.left + rail.clientLeft + parseFloat(capsule.left) + offset;
        return Math.abs(active.left - left) <= 1 && Math.abs(active.width - parseFloat(capsule.width)) <= 1;
      });
      assert.ok(aligned, 'one capsule fits entirely within the active segment');
    }
    const entry = url + '/catalog-upload.html';
    const desktop = await guest({ width: 1280, height: 800 });
    await desktop.goto(entry + '#' + linkToken);
    await desktop.getByRole('heading', { name: '專刊作品圖文', exact: true }).waitFor();
    await desktop.locator('#requirements').waitFor();
    assert.equal(await desktop.locator('#format-label').textContent(), '檔案與文字');
    assert.ok(await desktop.locator('#due-label').getAttribute('datetime'));
    const brief = await desktop.locator('.brief').boundingBox();
    const workbench = await desktop.locator('.workbench').boundingBox();
    const identity = await desktop.locator('.brief-content').boundingBox();
    const facts = await desktop.locator('#brief-facts').boundingBox();
    assert.ok(workbench.y >= brief.y + brief.height && workbench.x === brief.x && workbench.width === brief.width,
      'desktop uses aligned summary and workflow cards');
    assert.ok(facts.x > identity.x + identity.width, 'desktop shows deadline and format next to the title');
    assert.equal(await desktop.locator('body').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(245, 245, 247)');
    await assertActiveStep(desktop, 'overview');
    assert.equal(await desktop.locator('#intake-text').isVisible(), false);
    if (process.env.CATALOG_ARTIFACT_DIR) {
      await desktop.screenshot({ path: path.join(process.env.CATALOG_ARTIFACT_DIR, 'catalog-guest-desktop.png'), fullPage: true });
    }
    await desktop.emulateMedia({ reducedMotion: 'no-preference' });
    await desktop.getByRole('button', { name: '開始填寫' }).click();
    await desktop.locator('#intake-steps').evaluate(async rail => {
      await Promise.all(rail.getAnimations({ subtree: true }).map(animation => animation.finished));
    });
    await assertActiveStep(desktop, 'edit');
    if (process.env.CATALOG_ARTIFACT_DIR) {
      await desktop.screenshot({ path: path.join(process.env.CATALOG_ARTIFACT_DIR, 'catalog-guest-writing.png'),
        fullPage: true, animations: 'disabled' });
    }

    const phone = await guest({ width: 320, height: 760 });
    const assertNoOverflow = async () => assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const before = calls;
    await phone.goto(entry);
    await phone.getByRole('heading', { name: '無法開啟上傳頁' }).waitFor();
    assert.equal(calls, before);
    assert.equal(await phone.locator('#brief-facts, #intake-steps').filter({ visible: true }).count(), 0);
    assert.equal(await phone.locator('#retry-load').isVisible(), false);

    describeFails = true;
    await phone.goto(entry + '?case=retry#' + linkToken);
    await phone.getByRole('button', { name: '重新檢查' }).click();
    await phone.getByRole('heading', { name: '這次要交什麼？' }).waitFor();
    const mobileBrief = await phone.locator('.brief').boundingBox();
    const mobileWorkbench = await phone.locator('.workbench').boundingBox();
    const mobileIdentity = await phone.locator('.brief-content').boundingBox();
    const mobileFacts = await phone.locator('#brief-facts').boundingBox();
    assert.ok(mobileWorkbench.y >= mobileBrief.y + mobileBrief.height && mobileFacts.y > mobileIdentity.y + mobileIdentity.height,
      'mobile stacks the title, metadata, and workflow');
    await assertActiveStep(phone, 'overview');
    await assertNoOverflow();
    if (process.env.CATALOG_ARTIFACT_DIR) {
      const preview = await guest({ width: 390, height: 880 });
      await preview.goto(entry + '#' + linkToken);
      await preview.getByRole('button', { name: '開始填寫' }).waitFor();
      await preview.screenshot({ path: path.join(process.env.CATALOG_ARTIFACT_DIR, 'catalog-guest-mobile.png'), fullPage: true });
      await preview.close();
    }
    await phone.getByRole('button', { name: '開始填寫' }).click();
    await assertActiveStep(phone, 'edit');
    assert.equal(await phone.locator('#edit-title').evaluate(node => document.activeElement === node), true);
    const draft = '專刊介紹\n保留換行';
    await phone.getByLabel('文字內容', { exact: true }).fill(draft);
    assert.equal(await phone.locator('#text-count').textContent(), draft.length + ' / 5,000');
    const fileName = '作品原檔-' + 'a'.repeat(155) + '.zip';
    await phone.locator('#intake-file').setInputFiles({ name: fileName, mimeType: 'application/zip', buffer: Buffer.from('ZIP') });
    assert.match(await phone.locator('#file-selection').textContent(), /作品原檔-/);
    assert.equal(await phone.locator('#file-button-label').textContent(), '更換檔案');
    await assertNoOverflow();
    await phone.getByRole('button', { name: '下一步：確認內容' }).click();
    await assertActiveStep(phone, 'confirm');
    assert.equal(await phone.locator('#intake-steps [data-complete]').count(), 2);
    assert.equal(await phone.locator('#confirm-text').textContent(), draft);
    assert.ok((await phone.locator('#confirm-file').textContent()).startsWith(fileName));
    assert.equal(f.data.Catalog_Submissions.length, 0);
    await assertNoOverflow();
    await phone.getByRole('button', { name: '返回修改' }).click();
    await assertActiveStep(phone, 'edit');
    assert.equal(await phone.locator('#intake-text').inputValue(), draft);
    assert.equal(await phone.locator('#intake-file').evaluate(node => node.files[0].name), fileName);

    await phone.goto(entry + '?case=verification#' + legacy.linkToken);
    await phone.getByRole('heading', { name: '先確認是這個小組' }).waitFor();
    assert.equal(await phone.locator('#brief-facts').isVisible(), false);
    assert.equal(await phone.locator('#requirements').textContent(), '');
    assert.doesNotMatch(await phone.locator('#project-label').textContent(), /組長18|組員18/);
    await phone.getByRole('button', { name: '寄送驗證碼' }).click();
    await phone.getByText(/驗證碼已寄出/).waitFor();
    await phone.getByLabel('6 位數字驗證碼').fill(f.mail.at(-1).text.match(/驗證碼：(\d{6})/)[1]);
    await phone.getByRole('button', { name: '驗證並繼續' }).click();
    await phone.getByRole('button', { name: '開始填寫' }).click();
    assert.equal(await phone.locator('#file-fields').isVisible(), false);
    assert.equal(await phone.locator('#format-label').textContent(), '僅文字');
    await assertNoOverflow();
    await phone.goto(entry + '?case=file#' + fileOnly.linkToken);
    await phone.getByRole('button', { name: '開始填寫' }).click();
    assert.equal(await phone.locator('#screen-edit textarea').count(), 0);
    assert.equal(await phone.locator('#file-fields').isVisible(), true);
    assert.equal(await phone.locator('#format-label').textContent(), '僅檔案');
    await phone.locator('#intake-file').setInputFiles({ name: 'file-only.zip', mimeType: 'application/zip', buffer: Buffer.from('ZIP') });
    await phone.getByRole('button', { name: '下一步：確認內容' }).click();
    assert.equal(await phone.locator('#confirm-file-row').isVisible(), true);
    assert.equal(await phone.locator('[data-confirm-answer]').count(), 0);
    await phone.getByRole('button', { name: '送出給形印組' }).click();
    await phone.getByRole('heading', { name: '資料已送出' }).waitFor();
    await phone.goto(entry + '?case=text#' + textOnlyLink);
    await phone.getByRole('button', { name: '開始填寫' }).click();
    assert.equal(await phone.locator('#file-fields').isVisible(), false);
    await phone.getByLabel('作品介紹', { exact: true }).fill('只繳交文字');
    await phone.getByRole('button', { name: '下一步：確認內容' }).click();
    assert.equal(await phone.locator('#confirm-file-row').isVisible(), false);
    await phone.getByRole('button', { name: '送出給形印組' }).click();
    await phone.getByRole('heading', { name: '資料已送出' }).waitFor();
    assert.equal(f.data.Catalog_Submissions[1].Text_Answers[0].value, '只繳交文字');
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('two separate guest pages complete approval and correction and resume a 50 MiB transfer', { timeout: 90000 }, async () => {
  const f = fakeWorkspace();
  const largeName = 'mock-catalog-original.zip';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-browser-'));
  const synthetic = path.join(dir, largeName);
  fs.closeSync(fs.openSync(synthetic, 'w'));
  fs.truncateSync(synthetic, 50 * MiB);
  const { server, url } = await startCatalogServer();
  let browser;
  const errors = [];
  const outsideCalls = [];
  let dropChunkAcknowledgement = true;
  let firstRequest = '';
  try {
    browser = await chromium.launch({ executablePath: chromePath, headless: true });
    async function newPage({ guest = false } = {}) {
      const context = await browser.newContext({ acceptDownloads: true, viewport: guest ? { width: 320, height: 760 } : { width: 1380, height: 960 },
        timezoneId: 'Asia/Taipei', reducedMotion: 'reduce' });
      await context.route(/https:\/\/script\.(google|googleusercontent)\.com\//, async route => {
        const req = route.request();
        const payload = req.method() === 'POST' ? JSON.parse(req.postData()) : Object.fromEntries(new URL(req.url()).searchParams);
        if (guest) {
          assert.match(payload.action, /^catalogGuest/);
          assert.equal(payload.sessionToken, undefined);
          outsideCalls.push(payload.action);
        }
        const result = req.method() === 'POST' ? f.dispatch(payload) : f.c.doGet({ parameter: payload });
        if (payload.action === 'catalogGuestChunk' && dropChunkAcknowledgement && payload.start === 0 && payload.end === 8 * MiB - 1) {
          assert.equal(result.data.nextByte, 8 * MiB);
          dropChunkAcknowledgement = false;
          firstRequest = payload.requestId;
          return route.abort('failed');
        }
        if (payload.action === 'catalogGuestChunk' && payload.start === 8 * MiB) assert.equal(payload.requestId, firstRequest);
        await route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(result) });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.setDefaultTimeout(10000);
      return page;
    }
    async function staffPage(userId) {
      const page = await newPage();
      const profile = clone(f.seed.Users.find(user => user.User_ID === userId));
      delete profile.Password;
      await page.addInitScript(({ profile, token }) => localStorage.setItem('shapeprint_auth_session_v1',
        JSON.stringify({ userId: profile.User_ID, profile, workspace: 'admin', sessionToken: token })), { profile, token: f.tokens[userId] });
      await page.goto(url);
      await page.locator('#navigation-list').getByRole('button', { name: '專刊收件', exact: true }).click();
      await page.locator('[data-catalog-workspace]').getByRole('button', { name: '重新整理', exact: true }).waitFor();
      return page;
    }
    const manager = await staffPage('U01');
    const admin = () => manager.locator('[data-catalog-workspace]');
    const selectSection = name => admin().getByRole('navigation', { name: '專刊功能' }).getByRole('button', { name, exact: true }).click();
    await selectSection('小組名冊');
    for (const number of ['17', '18']) {
      await admin().getByRole('button', { name: '新增小組', exact: true }).click();
      const form = manager.locator('#catalog-editor');
      await form.getByLabel('組別', { exact: true }).fill(number);
      await form.getByLabel('指導老師').fill('測試老師');
      if (number === '18') {
        await form.getByRole('button', { name: '一人一組' }).click();
        await form.getByRole('button', { name: '兩人一組', exact: true }).click();
      }
      if (number === '17') {
        await form.getByLabel('組員姓名').fill('單人姓名17');
      } else {
        await form.getByLabel('組長姓名').fill('組長姓名18');
        await form.getByLabel('組員姓名').fill('組員姓名18');
      }
      await form.getByRole('button', { name: '儲存', exact: true }).click();
      const names = number === '17' ? '單人姓名17' : '組長姓名18、組員姓名18';
      await admin().getByText(number + '｜' + names, { exact: true }).waitFor();
    }
    await selectSection('收件項目');
    await admin().getByRole('button', { name: '建立收件項目', exact: true }).click();
    const form = manager.locator('#catalog-editor');
    const textOptions = form.locator('[data-catalog-item-section="text"]');
    const verification = form.locator('[data-catalog-item-section="verification"]');
    const textField = index => form.locator('[data-catalog-text-field]').nth(index);
    const requireEmail = verification.getByRole('checkbox', { includeHidden: true });
    assert.equal(await textOptions.getAttribute('open'), null);
    assert.equal(await verification.getAttribute('open'), null);
    assert.equal(await textField(0).isVisible(), false);
    assert.equal(await requireEmail.isVisible(), false);
    if (process.env.CATALOG_ARTIFACT_DIR) {
      await form.screenshot({ path: path.join(process.env.CATALOG_ARTIFACT_DIR, 'catalog-editor-compact.png') });
    }
    await form.getByLabel('收件名稱').fill('專刊圖文測試');
    await textOptions.locator('summary').press('Enter');
    await textField(0).getByLabel('欄位名稱').fill('作品介紹');
    await textField(0).getByLabel('最少字數').fill('3');
    await textField(0).getByLabel('最多字數').fill('16');
    await form.getByRole('button', { name: /新增文字欄位/ }).click();
    await textField(1).getByLabel('欄位名稱').fill('設計理念');
    await textField(1).getByLabel('最少字數').fill('2');
    await textField(1).getByLabel('最多字數').fill('12');
    await form.getByRole('button', { name: /新增文字欄位/ }).click();
    await form.getByRole('button', { name: '移除文字欄位 3' }).click();
    await form.getByText('只收附件', { exact: true }).click();
    assert.equal(await textOptions.count(), 0);
    await form.getByText('只收文字', { exact: true }).click();
    assert.equal(await textField(0).getByLabel('欄位名稱').inputValue(), '作品介紹');
    await form.getByText('文字與附件', { exact: true }).click();
    assert.equal(await textField(1).isVisible(), true);
    assert.equal(await form.locator('[data-catalog-text-field]').count(), 2);
    await textOptions.locator('summary').getByText('2 欄', { exact: true }).waitFor();
    await verification.locator('summary').click();
    await requireEmail.check();
    await verification.locator('summary').getByText('開啟', { exact: true }).waitFor();
    await verification.locator('summary').click();
    assert.equal(await requireEmail.isChecked(), true);
    await verification.locator('summary').click();
    await requireEmail.uncheck();
    await verification.locator('summary').getByText('關閉', { exact: true }).waitFor();
    await verification.locator('summary').click();
    await form.getByLabel('繳交規格').fill('請提供原檔與作品介紹');
    await form.getByRole('button', { name: '選擇收件截止時間' }).click();
    await manager.locator('#date-time-picker-portal').getByRole('button', { name: '23:59' }).click();
    await manager.locator('#date-time-picker-portal').getByRole('button', { name: '完成' }).click();
    if (process.env.CATALOG_ARTIFACT_DIR) {
      await form.locator('[data-catalog-form-settings]').screenshot({ path: path.join(process.env.CATALOG_ARTIFACT_DIR, 'catalog-editor-expanded.png') });
    }
    await manager.setViewportSize({ width: 390, height: 844 });
    assert.equal(await form.evaluate(node => node.scrollWidth <= Math.ceil(node.getBoundingClientRect().width)), true);
    await manager.setViewportSize({ width: 1380, height: 960 });
    await textField(1).getByLabel('最多字數').fill('1');
    await textOptions.locator('summary').click();
    assert.equal(await textField(1).isVisible(), false);
    await form.getByRole('button', { name: '儲存', exact: true }).click();
    await admin().getByText(/最多字數不可小於最少字數/).waitFor();
    assert.equal(await textField(1).getByLabel('最多字數').evaluate(node => document.activeElement === node), true);
    assert.equal(f.data.Catalog_Items.length, 0);
    await textField(1).getByLabel('最多字數').fill('12');
    await form.getByRole('button', { name: '儲存', exact: true }).click();
    await admin().getByRole('button', { name: '分配小組', exact: true }).click();
    await form.getByLabel(/17｜單人姓名17/).check();
    await form.getByLabel(/18｜組長姓名18、組員姓名18/).check();
    await form.getByRole('button', { name: '選擇形印組帳號', exact: true }).click();
    await form.getByRole('button', { name: '收件組員', exact: true }).click();
    await form.getByRole('button', { name: '儲存', exact: true }).click();
    await admin().getByText('第 17 組｜單人姓名17', { exact: true }).waitFor();
    assert.equal(f.data.Catalog_Targets.length, 2);

    const reviewer = await staffPage('U05');
    await reviewer.getByRole('heading', { name: '我負責的小組' }).waitFor();
    assert.equal(await reviewer.getByRole('navigation', { name: '專刊功能' }).count(), 0);
    const caseFor = number => reviewer.locator('[data-catalog-case]').filter({ hasText: '第 ' + number + ' 組｜' });
    async function getLink(number) {
      const row = caseFor(number);
      await row.locator('summary').first().click();
      await row.getByRole('button', { name: '建立上傳連結', exact: true }).click();
      const link = await reviewer.getByLabel('專屬上傳連結').inputValue();
      await reviewer.locator('#catalog-link-panel').getByRole('button', { name: '關閉' }).click();
      return new URL(link).hash;
    }
    const links = [await getLink('17'), await getLink('18')];
    const guests = [];
    for (const [index, number] of ['17', '18'].entries()) {
      const guest = await newPage({ guest: true });
      guests.push(guest);
      await guest.goto(url + '/catalog-upload.html' + links[index]);
      await guest.getByText('請提供原檔與作品介紹', { exact: true }).waitFor();
      await guest.getByText(index === 0 ? '組員：單人姓名17' : '組員：組長姓名18、組員姓名18', { exact: true }).waitFor();
      assert.equal(await guest.locator('nav, #auth-section, #dashboard-section').count(), 0);
      assert.equal(await guest.locator('#intake-file').isVisible(), false);
      assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await guest.getByRole('button', { name: '開始填寫' }).click();
      const intro = guest.getByLabel('作品介紹', { exact: true });
      const theme = guest.getByLabel('設計理念', { exact: true });
      assert.equal(await guest.locator('#text-fields textarea').count(), 2);
      if (index === 0) {
        await intro.fill('短');
        await theme.fill('設'.repeat(13));
        await guest.getByRole('button', { name: '下一步：確認內容' }).click();
        assert.equal(await intro.getAttribute('aria-invalid'), 'true');
        assert.equal(await theme.getAttribute('aria-invalid'), 'true');
        assert.equal(f.data.Catalog_Submissions.length, 0);
      }
      await intro.fill('作品原始介紹 ' + number);
      await theme.fill('作品使用壓印與留白');
      assert.equal(await intro.getAttribute('aria-invalid'), null);
      assert.equal(await theme.getAttribute('aria-invalid'), null);
      await guest.locator('#intake-file').setInputFiles(index === 0 ? synthetic
        : { name: 'small.zip', mimeType: 'application/zip', buffer: Buffer.from('ZIP') });
      if (process.env.CATALOG_ARTIFACT_DIR && index === 0) {
        await guest.locator('#screen-edit').screenshot({ path: path.join(process.env.CATALOG_ARTIFACT_DIR, 'catalog-guest-form.png') });
      }
      await guest.getByRole('button', { name: '下一步：確認內容' }).click();
      await guest.getByRole('heading', { name: '確認後送出' }).waitFor();
      assert.deepEqual(await guest.locator('[data-confirm-answer] dt').allTextContents(), ['作品介紹', '設計理念']);
      assert.deepEqual(await guest.locator('[data-confirm-answer] dd').allTextContents(), ['作品原始介紹 ' + number, '作品使用壓印與留白']);
      assert.equal(f.data.Catalog_Submissions.length, index, 'preview step makes no upload request');
      await guest.getByRole('button', { name: '送出給形印組' }).click();
      if (index === 0) {
        await guest.getByRole('button', { name: '重試送出' }).waitFor();
        assert.equal(f.data.Catalog_Submissions.length, 0);
        assert.equal(await guest.locator('#intake-file').evaluate(input => input.files[0].size), 50 * MiB);
        await guest.getByRole('button', { name: '重試送出' }).click();
      }
      await guest.getByRole('heading', { name: '資料已送出' }).waitFor({ timeout: 30000 });
      assert.match(await guest.locator('#receipt-label').textContent(), /第 1 版/);
      assert.ok(await guest.locator('#receipt-time').getAttribute('datetime'));
    }
    assert.ok(f.probeCalls >= 1);
    assert.equal(f.ranges[6][1], 50 * MiB - 1);
    assert.deepEqual(f.ranges.slice(0, 7).map(([from]) => from), [0, 8, 16, 24, 32, 40, 48].map(n => n * MiB));
    await reviewer.getByRole('button', { name: '重新整理', exact: true }).click();
    await caseFor('17').locator('[data-catalog-status="pending"]').waitFor();
    for (const [index, number] of ['17', '18'].entries()) {
      const row = caseFor(number);
      if (await row.getAttribute('open') === null) await row.locator('summary').first().click();
      await row.getByText('作品原始介紹 ' + number, { exact: true }).waitFor();
      assert.deepEqual(await row.locator('dl dt').allTextContents(), ['作品介紹', '設計理念']);
      if (index === 1) {
        const download = reviewer.waitForEvent('download');
        await row.getByRole('button', { name: '下載原檔', exact: true }).click();
        assert.equal((await download).suggestedFilename(), 'small.zip');
      }
      await row.getByRole('button', { name: '開始審核' }).click();
      const review = reviewer.locator('#catalog-editor');
      if (index === 1) await review.getByLabel(/審核意見/).fill('請補上攝影者資訊');
      await review.getByRole('button', { name: index === 0 ? '通過' : '退回補件', exact: true }).click();
      await row.locator(index === 0 ? '[data-catalog-status="approved"]' : '[data-catalog-status="returned"]').waitFor();
      await guests[index].getByRole('button', { name: '查看收件狀態' }).click();
    }
    await guests[0].getByText('審核已通過', { exact: true }).waitFor();
    assert.equal(await guests[0].locator('#intake-steps').isVisible(), false);
    assert.equal(await guests[0].locator('#requirements-block').getAttribute('open'), null);
    await guests[1].getByText('請補上攝影者資訊', { exact: true }).waitFor();
    assert.equal(await guests[1].locator('#due-kind').textContent(), '補件期限');
    assert.equal(await guests[1].locator('#overview-heading').getAttribute('data-tone'), 'warning');
    await guests[1].getByRole('button', { name: '開始補件' }).click();
    await guests[1].getByLabel('作品介紹', { exact: true }).fill('已補攝影者資訊');
    await guests[1].getByLabel('設計理念', { exact: true }).fill('作品使用壓印與留白');
    await guests[1].locator('#intake-file').setInputFiles({ name: 'correction.zip', mimeType: 'application/zip', buffer: Buffer.from('ZIP2') });
    await guests[1].getByRole('button', { name: '下一步：確認內容' }).click();
    await guests[1].getByRole('button', { name: '送出給形印組' }).click();
    await guests[1].getByText(/已確認收到第 2 版/).waitFor();
    assert.deepEqual(f.data.Catalog_Submissions.map(row => row.Status), ['approved', 'returned', 'pending']);
    assert.equal(f.mail.length, 0);

    await selectSection('收件項目');
    const storedSubmissions = clone(f.data.Catalog_Submissions);
    await admin().getByRole('button', { name: '刪除', exact: true }).click();
    await form.getByRole('heading', { name: '確認刪除收件項目？' }).waitFor();
    await form.getByRole('button', { name: '取消', exact: true }).click();
    assert.ok(!f.data.Catalog_Items[0].Deleted_At);
    await admin().getByRole('button', { name: '刪除', exact: true }).click();
    await form.getByRole('button', { name: '確認刪除', exact: true }).click();
    await admin().getByText('已刪除項目（1）', { exact: true }).waitFor();
    assert.deepEqual(f.data.Catalog_Submissions, storedSubmissions);
    await guests[0].getByRole('button', { name: '更新狀態' }).click();
    await guests[0].getByRole('heading', { name: '無法開啟上傳頁' }).waitFor();
    await admin().getByRole('button', { name: '復原', exact: true }).click();
    await form.getByRole('button', { name: '確認復原', exact: true }).click();
    await admin().getByRole('button', { name: '刪除', exact: true }).waitFor();
    await reviewer.getByRole('button', { name: '重新整理', exact: true }).click();
    await caseFor('17').locator('[data-catalog-status="approved"]').waitFor();
    assert.deepEqual(f.data.Catalog_Submissions, storedSubmissions);

    await admin().getByRole('button', { name: '刪除', exact: true }).click();
    await form.getByRole('button', { name: '確認刪除', exact: true }).click();
    await admin().getByText('已刪除項目（1）', { exact: true }).waitFor();
    const purgeButton = admin().getByRole('button', { name: '永久刪除', exact: true });
    await purgeButton.click();
    await form.getByText(/2 筆小組分配和 3 份繳交版本/).waitFor();
    const trashAttachments = form.getByRole('checkbox', { name: /同時將原始附件移到 Google Drive 垃圾桶/ });
    assert.equal(await trashAttachments.isChecked(), false);
    const confirmation = form.getByLabel('輸入「永久刪除」確認');
    assert.equal(await form.getByRole('button', { name: '永久刪除', exact: true }).isDisabled(), true);
    await confirmation.fill('確認刪除');
    assert.equal(await form.getByRole('button', { name: '永久刪除', exact: true }).isDisabled(), true);
    await form.getByRole('button', { name: '取消', exact: true }).click();
    assert.equal(f.data.Catalog_Submissions.length, 3);
    await purgeButton.click();
    await trashAttachments.check();
    await confirmation.fill('永久刪除');
    await form.getByRole('button', { name: '永久刪除', exact: true }).click();
    await admin().getByText(/已永久刪除收件項目與網站紀錄/).waitFor();
    await admin().getByText(/已將 3 個附件移到 Google Drive 垃圾桶/).waitFor();
    assert.equal(await admin().getByText('已刪除項目（1）', { exact: true }).count(), 0);
    assert.equal(f.data.Catalog_Items.length, 0);
    assert.equal(f.data.Catalog_Submissions.length, 0);
    assert.equal(f.data.Catalog_Roster.length, 2);
    assert.equal([...f.files.values()].filter(file => file.trashed).length, 3);

    await selectSection('開放設定');
    await admin().getByRole('button', { name: '切換為形印組專用', exact: true }).click();
    await form.getByLabel('我已確認這次切換的影響').check();
    await form.getByRole('button', { name: '確認切換' }).click();
    await admin().getByText('其他畢製小組只能使用各自的上傳連結，無法登入工作台。', { exact: true }).waitFor();
    assert.equal(f.c.getWorkspaceAccessPolicy_().workspaceInternalOnly, true);
    const outside = await newPage();
    await outside.addInitScript(({ profile, token, seed }) => {
      localStorage.setItem('shapeprint_auth_session_v1', JSON.stringify({ userId: profile.User_ID, profile, sessionToken: token, workspace: 'team' }));
      localStorage.setItem('shapeprint_remote_state_v1:' + profile.User_ID, JSON.stringify({ userId: profile.User_ID, state: seed, cachedAt: Date.now() }));
    }, { profile: { User_ID: 'U02', Role: 'Member', Team_ID: 'T01' }, token: f.tokens.U02, seed: f.seed });
    await outside.goto(url);
    await outside.locator('#login-feedback').getByText(/工作台僅限形印組/).waitFor();
    assert.equal(await outside.locator('#dashboard-section').isVisible(), false);
    assert.ok(outsideCalls.length > 10);
    assert.deepEqual(errors, []);
    if (process.env.CATALOG_ARTIFACT_DIR) {
      await reviewer.locator('[data-catalog-workspace]').screenshot({ path: path.join(process.env.CATALOG_ARTIFACT_DIR, 'catalog-board.png') });
      await guests[1].evaluate(() => scrollTo(0, 0));
      await guests[1].screenshot({ path: path.join(process.env.CATALOG_ARTIFACT_DIR, 'catalog-mobile-receipt.png'), fullPage: true });
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
