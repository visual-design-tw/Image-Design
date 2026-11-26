const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { backend } = require('./stability.test.cjs');
const { createSiteServer } = require('./site-test-server.cjs');

const clone = value => JSON.parse(JSON.stringify(value));
const requestId = '1'.repeat(32);
const eventId = 'CE_ORIGINAL';
const body = { title: 'Test print layout', description: 'Initial notes', startsAt: '2027-03-26 09:00',
  endsAt: '2027-04-09 23:59', eventType: 'production', allDay: false, stageId: 'S01' };

function setup() {
  const c = backend();
  c.Logger = { log() {} };
  c.SpreadsheetApp = { openById: () => ({}) };
  const manager = c.db.Users[0];
  c.db.Calendar_Events = [{ ...c.buildCalendarEventFromPayload_(body, manager), Event_ID: eventId }];
  c.db.Meta.State_Revision = 10;
  let locked = false;
  let writes = 0;
  let reads = 0;
  c.loadState_ = options => {
    assert.equal(locked, true);
    assert.equal(options?.fresh, true);
    reads++;
    if (c.failReadback && writes > 0) throw new Error('Unconfirmed read');
    return clone(c.db);
  };
  c.requireSessionUser_ = (state, payload, roles) => {
    const user = state.Users.find(u => payload.sessionToken === 'TOKEN_' + u.User_ID);
    if (!user) throw new Error('AUTH_EXPIRED');
    if (!roles.includes(user.Role)) throw new Error('FORBIDDEN');
    return user;
  };
  c.withLock_ = callback => {
    assert.equal(locked, false);
    locked = true;
    try { return callback(); } finally { locked = false; }
  };
  c.writeStateTables_ = (_, next, previous) => {
    assert.equal(locked, true);
    assert.deepEqual(clone(previous), clone(c.db));
    for (const key of Object.keys(previous).filter(key => !['Calendar_Events', 'Meta'].includes(key))) {
      assert.deepEqual(clone(next[key]), clone(previous[key]));
    }
    c.db = clone(next);
    writes++;
  };
  c.appendActivityLogEntries_ = entries => {
    if (c.failAudit) throw new Error('Log unavailable');
    c.activityLogs.push(...clone(entries));
  };
  c.buildClientStateResultForUser_ = (state, user, data) => ({
    state: c.filterStateForUser_(state, user), currentUser: user, stateRevision: state.Meta.State_Revision, ...data
  });
  c.jsonResponse_ = (ok, data, error) => ({ ok, data, error: error && { message: error.message } });
  const dispatch = payload => c.doPost({ postData: { contents: JSON.stringify(payload) } });
  const save = (action, values = {}) => dispatch({ ...body, action, sessionToken: 'TOKEN_U01', stateRevision: 1, ...values });
  return { c, dispatch, save, writes: () => writes, reads: () => reads };
}

test('an edit bypasses unrelated revision changes, writes confirmed dates and preserves other records', () => {
  const f = setup();
  f.c.db.Assignments[0].Title = 'Another manager changed this';
  f.c.db.Meta.State_Revision = 43;
  const result = f.save('updateCalendarEvent', {
    eventId, expectedEvent: clone(f.c.db.Calendar_Events[0]), description: 'Updated notes'
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.data.calendarEvent.Description, 'Updated notes');
  assert.equal(result.data.calendarEvent.Starts_At, body.startsAt);
  assert.equal(result.data.calendarEvent.Ends_At, body.endsAt);
  assert.equal(result.data.state.Assignments[0].Title, 'Another manager changed this');
  assert.equal(result.data.stateRevision, 44);
  assert.equal(f.writes(), 1);
  assert.equal(f.reads(), 2);
});

test('another editor is detected even when Updated_At is identical; removed events are not re-created', () => {
  const f = setup(), expectedEvent = clone(f.c.db.Calendar_Events[0]);
  f.c.db.Calendar_Events[0].Title = 'Cloud version';
  f.c.db.Meta.State_Revision++;
  const change = { eventId, expectedEvent, description: 'Draft notes' };
  const result = f.save('updateCalendarEvent', change);
  assert.equal(result.data.calendarConflict.event.Title, 'Cloud version');
  f.c.db.Calendar_Events = [];
  assert.equal(f.save('updateCalendarEvent', change).data.calendarConflict.event, null);
  assert.equal(f.writes(), 0);
});

test('new-event retries confirm a prior commit without duplicate rows or recreation from the recycle bin', () => {
  const f = setup();
  f.c.failReadback = true;
  const pending = f.save('createCalendarEvent', { requestId });
  assert.match(pending.error.message, /CALENDAR_SAVE_NOT_CONFIRMED/);
  f.c.failReadback = false;
  const result = f.save('createCalendarEvent', { requestId });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.writes(), 1);
  assert.equal(f.c.db.Calendar_Events.length, 2);
  const id = result.data.calendarEvent.Event_ID;
  assert.equal(f.save('createCalendarEvent', { requestId, title: 'Changed draft' }).data.calendarConflict.event.Event_ID, id);
  f.c.db.Calendar_Events.shift();
  f.c.db.Recycle_Bin.push({ Entity_Type: 'calendar-event', Entity_ID: id });
  assert.equal(f.save('createCalendarEvent', { requestId }).data.calendarConflict.event, null);
  assert.equal(f.writes(), 1);
});

test('legacy callers, permissions, validation and audit failures retain safe behavior', () => {
  const f = setup(), expectedEvent = clone(f.c.db.Calendar_Events[0]);
  assert.match(f.save('updateCalendarEvent', { eventId }).error.message, /STATE_CONFLICT/);
  assert.match(f.save('updateCalendarEvent', { eventId, expectedEvent, sessionToken: 'TOKEN_U03' }).error.message, /FORBIDDEN/);
  assert.match(f.save('createCalendarEvent', { requestId, endsAt: '2027-03-25 23:59' }).error.message, /結束時間/);
  assert.equal(f.writes(), 0);
  f.c.failAudit = true;
  const values = { eventId, expectedEvent, description: 'Confirmed once', sessionToken: 'TOKEN_U04' };
  assert.equal(f.save('updateCalendarEvent', values).ok, true);
  assert.equal(f.save('updateCalendarEvent', values).ok, true);
  assert.equal(f.writes(), 1);
});

test('real editor saves despite unrelated changes and preserves a conflicting draft until an explicit rebase', async () => {
  const f = setup();
  const html = fs.readFileSync(path.join(__dirname, '../index.html'));
  const server = createSiteServer((req, res) => res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Taipei', reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', async route => {
      const request = route.request();
      if (!/^https:\/\/script\.(google|googleusercontent)\.com\//.test(request.url())) return route.abort();
      const payload = request.postDataJSON();
      return route.fulfill({ json: payload?.action === 'updateCalendarEvent' ? f.dispatch(payload)
        : { ok: true, data: { registrationOptions: {} } } });
    });
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'load' });
    await page.evaluate(({ seed, eventId }) => {
      authEpoch++; state = seed; normalizeStateSchema(); currentUser = state.Users[0];
      activeWorkspace = 'admin'; activeTab = 'calendar'; authSessionToken = 'TOKEN_U01';
      remoteStateRevision = state.Meta.State_Revision; gasConnectionStatus = 'remote';
      setSaveFeedback('idle', ''); renderAll(); openCalendarEventModal(eventId);
    }, { seed: f.c.db, eventId });
    const modal = page.getByRole('dialog', { name: '編輯工作事件' });
    const save = modal.getByRole('button', { name: '儲存事件' });
    const notes = modal.getByLabel('備註');
    const title = modal.getByLabel('事件名稱');
    f.c.db.Meta.State_Revision++;
    f.c.db.Assignments[0].Title = 'Unrelated change while modal open';
    await notes.fill('First save');
    await save.click();
    await modal.waitFor({ state: 'hidden' });
    assert.equal(f.c.db.Calendar_Events[0].Description, 'First save');
    assert.equal(f.writes(), 1);

    await page.evaluate(id => openCalendarEventModal(id), eventId);
    f.c.db.Calendar_Events[0].Title = 'New cloud title';
    f.c.db.Meta.State_Revision++;
    await notes.fill('My local draft');
    await save.click();
    await modal.getByText('New cloud title').waitFor();
    assert.equal(await notes.inputValue(), 'My local draft');
    assert.equal(await save.isDisabled(), true);
    assert.equal(f.writes(), 1);

    await modal.getByRole('button', { name: '保留我的修改，套用到最新版' }).click();
    assert.equal(await title.inputValue(), 'New cloud title');
    assert.equal(await notes.inputValue(), 'My local draft');
    assert.equal(await save.isDisabled(), false);
    assert.equal(f.writes(), 1);
    await save.click();
    await modal.waitFor({ state: 'hidden' });
    assert.equal(f.c.db.Calendar_Events[0].Title, 'New cloud title');
    assert.equal(f.c.db.Calendar_Events[0].Description, 'My local draft');
    assert.equal(f.writes(), 2);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
