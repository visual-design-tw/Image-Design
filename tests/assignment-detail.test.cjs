const fs = require('node:fs');
const path = require('node:path');
const { createSiteServer } = require('./site-test-server.cjs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { fixture } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..');
const output = process.env.DETAIL_ARTIFACT_DIR || path.join(root, 'audit/assignment-detail-2026-10-24');
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error('FAIL ' + name + '\n' + error.stack); }
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const seed = fixture();
  seed.Config_Stages[0].Stage_Name = '第四次會審';
  seed.Users[0].Name = '測試管理者';
  seed.Teams[1].Team_Name = '01 視覺設計小組';
  seed.Teams[2].Team_Name = '02 品牌設計小組';
  seed.Teams.push({ Team_ID: 'T03', Team_Name: '03 包裝設計小組' }, { Team_ID: 'T04', Team_Name: '04 影像設計小組' });
  Object.assign(seed.Assignments[0], { Title: '第四次會審｜主視覺與設計說明', Submission_Mode: 'file-text',
    Body: '請使用附件公版製作主視覺。圖片需保留出血，並註明使用的字型。',
    Requirement_Text: '上傳主視覺 PDF，並附上 100 字設計說明。', Due_At: '2026-10-27 18:00' });
  seed.Assignment_Submissions = [
    { Submission_ID: 'SUB_REJECT', Team_ID: 'T02', Status: '退回修正', Review_Note: '請補上出血範圍。' },
    { Submission_ID: 'SUB_PASS', Team_ID: 'T03', Status: '通過' },
    { Submission_ID: 'SUB_PENDING', Team_ID: 'T01', Status: '已繳交' }
  ].map((s, i) => ({ Assignment_ID: 'A01', User_ID: 'U02', Submission_No: 1, Submission_Mode: 'file-text',
    Text_Content: '以幾何圖形與藍色呈現主視覺，保留清楚的標題層級。',
    Submitted_At: '2026-10-24 10:0' + i, File_Name: 'main-visual.pdf',
    Google_Drive_URL: 'https://drive.google.com/file/d/FIXTURE_ONLY/view', ...s }));
  const server = createSiteServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(process.env.DETAIL_PAGE_SOURCE || path.join(root, 'index.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1040 }, reducedMotion: 'reduce', timezoneId: 'Asia/Taipei' });
    await context.route(/https:\/\/script\.(google|googleusercontent)\.com\//, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: { state: seed, currentUser: null } }) }));
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
    await page.evaluate(seed => {
      window.__seed = seed;
      window.__resetDetail = (id = 'U01') => {
        authEpoch++; closeAssignmentDetailModal(true);
        state = JSON.parse(JSON.stringify(window.__seed)); normalizeStateSchema();
        currentUser = state.Users.find(user => user.User_ID === id); authSessionToken = 'FIXTURE_ONLY';
        remoteSaveInFlight = false; remoteSavePromise = null; pendingRemoteSave = false; remoteMutationInFlight = false;
        workspaceHydrationInFlight = false; remoteStateRevision = 1; gasConnectionStatus = 'remote';
        cancelQueuedRemoteStateSync(); activeWorkspace = id === 'U01' ? 'admin' : 'team'; activeTab = 'files';
        assignmentSubmitDrafts.clear(); sessionStorage.clear(); pendingLargeAssignmentAssetUpload = null;
        window.__requests = [];
        requestGas = async action => { window.__requests.push(action); throw new Error('Fixture blocks writes'); };
        setSaveFeedback('idle', ''); renderAll(); openAssignmentDetailModal('A01');
      };
      window.__resetDetail();
    }, seed);
    const shot = name => page.locator('#assignment-detail-modal > div').screenshot({ path: path.join(output, name + '.png') });
    if (process.env.DETAIL_BASELINE === '1') { await shot('before-desktop'); return; }
    await test('manager starts with review actions; setup, history and destructive actions are collapsed', async () => {
      assert.equal(await page.getByRole('tab', { name: '繳交與審核' }).getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#assignment-wizard-requirements').isVisible(), false);
      assert.equal(await page.locator('[data-assignment-timeline]').isVisible(), false);
      assert.equal(await page.locator('#assignment-thread-input').isVisible(), false);
      assert.equal(await page.getByRole('button', { name: '刪除項目', exact: true }).isVisible(), false);
      assert.equal(await page.locator('[data-assignment-progress]').count(), 0);
      assert.deepEqual(await page.locator('.assignment-detail-counts strong').allTextContents(), ['1', '1', '1', '1']);
      assert.match(await page.locator('[data-assignment-next-action]').textContent(), /等你審核/);
      assert.equal(await page.locator('.assignment-review-card').first().getAttribute('data-review-status'), 'submitted');
      await shot('manager-desktop');
    });
    await test('expanding a group exposes its file and review controls, without sending a decision', async () => {
      const card = page.locator('.assignment-review-card').first();
      assert.equal(await card.getByRole('button', { name: '通過', exact: true }).isVisible(), false);
      await card.locator('summary').click();
      assert.equal(await card.getByRole('button', { name: '預覽', exact: true }).isVisible(), true);
      await card.getByRole('button', { name: '通過', exact: true }).click();
      assert.equal(await page.locator('#assignment-review-modal').isVisible(), true);
      assert.equal(await page.evaluate(() => activeAssignmentReviewSubmissionId), 'SUB_PENDING');
      assert.deepEqual(await page.evaluate(() => window.__requests), []);
      await page.evaluate(() => closeAssignmentReviewModal());
    });
    await test('tabs keep expanded groups and drafts; redraw retains the selected panel', async () => {
      await page.locator('#assignment-comments-disclosure summary').click();
      await page.locator('#assignment-thread-input').fill('保留這則尚未送出的留言');
      await page.getByRole('tab', { name: '說明與附件' }).click();
      await page.locator('#assignment-guide-editor summary').click();
      await page.locator('#assignment-guide-url').fill('https://docs.google.com/presentation/d/FIXTURE_SLIDES_12345/edit');
      await page.getByRole('tab', { name: '繳交與審核' }).click();
      assert.equal(await page.locator('#assignment-thread-input').inputValue(), '保留這則尚未送出的留言');
      assert.equal(await page.locator('.assignment-review-card').first().getAttribute('open'), '');
      await page.getByRole('tab', { name: '說明與附件' }).click();
      await page.evaluate(() => renderAssignmentDetailModal());
      assert.equal(await page.getByRole('tab', { name: '說明與附件' }).getAttribute('aria-selected'), 'true');
      assert.match(await page.locator('#assignment-guide-url').inputValue(), /FIXTURE_SLIDES/);
      await page.getByRole('tab', { name: '繳交與審核' }).click();
      assert.equal(await page.locator('#assignment-thread-input').isVisible(), true);
      assert.equal(await page.locator('#assignment-thread-input').inputValue(), '保留這則尚未送出的留言');
    });
    await test('keyboard tab navigation and management controls remain reachable', async () => {
      await page.getByRole('tab', { name: '繳交與審核' }).focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.getByRole('tab', { name: '說明與附件' }).getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#assignment-resource-file-input').count(), 1);
      await page.locator('#assignment-item-settings summary').click();
      await page.getByRole('button', { name: '刪除項目', exact: true }).click();
      assert.equal(await page.locator('#assignment-delete-modal').isVisible(), true);
      assert.deepEqual(await page.evaluate(() => window.__requests), []);
      await page.evaluate(() => closeAssignmentDeleteModal());
    });
    await test('switching assignments or reopening starts at review without carrying expanded details', async () => {
      await page.evaluate(() => {
        state.Assignments.push({ ...state.Assignments[0], Assignment_ID: 'A02', Title: '另一份項目' });
        openAssignmentDetailModal('A02');
      });
      assert.equal(await page.getByRole('tab', { name: '繳交與審核' }).getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('[data-assignment-disclosure][open]').count(), 0);
      assert.match(await page.locator('[data-assignment-next-action]').textContent(), /等待小組繳交/);
      await page.evaluate(() => openAssignmentDetailModal('A01'));
      assert.equal(await page.locator('.assignment-review-card[open]').count(), 0);
    });
    await test('fully submitted but rejected work is not described as completed approval', async () => {
      await page.evaluate(() => {
        state.Assignments[0].Target_Mode = 'selected'; state.Assignments[0].Target_Team_IDs = ['T02'];
        renderAssignmentDetailModal();
      });
      assert.match(await page.locator('[data-assignment-next-action]').textContent(), /等待小組修正/);
      assert.deepEqual(await page.locator('.assignment-detail-counts strong').allTextContents(), ['0', '1', '0', '0']);
      assert.ok(!(await page.locator('#assignment-detail-modal-body').innerText()).includes('100%'));
      assert.equal(await page.locator('.assignment-review-card:visible').count(), 1);
      await page.locator('#assignment-other-submissions > summary').click();
      assert.equal(await page.locator('.assignment-review-card:visible').count(), 3);
      await page.locator('#assignment-other-submissions > summary').click();
      await shot('returned-desktop');
    });
    await test('mobile review and info panels fit, scroll, and retain reachable actions', async () => {
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(() => window.__resetDetail());
        for (const tab of ['繳交與審核', '說明與附件']) {
          await page.getByRole('tab', { name: tab }).click();
          const geometry = await page.evaluate(() => {
            const body = document.getElementById('assignment-detail-modal-body');
            body.scrollTop = body.scrollHeight;
            const box = body.parentElement.getBoundingClientRect();
            return { overflow: body.scrollWidth > body.clientWidth + 1, fits: box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
              scrolls: body.scrollHeight <= body.clientHeight || body.scrollTop > 0 };
          });
          assert.deepEqual(geometry, { overflow: false, fits: true, scrolls: true });
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => window.__resetDetail());
      await shot('manager-mobile');
      await page.setViewportSize({ width: 1440, height: 1040 });
    });
    await test('students still use sequential steps and do not see empty attachments or manager controls', async () => {
      await page.evaluate(() => window.__resetDetail('U03'));
      assert.equal(await page.locator('#assignment-detail-tabs').count(), 0);
      assert.equal(await page.locator('#assignment-wizard-requirements').isVisible(), true);
      assert.equal(await page.locator('#assignment-wizard-prepare').isVisible(), false);
      assert.equal(await page.getByText('尚未加入附件。', { exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: '刪除項目', exact: true }).count(), 0);
      assert.match(await page.locator('#assignment-wizard-requirements').innerText(), /請補上出血範圍/);
      await shot('student-desktop');
      await page.locator('#assignment-wizard-next').click();
      assert.equal(await page.locator('#assignment-wizard-prepare').isVisible(), true);
      assert.equal(await page.locator('#assignment-wizard-requirements').isVisible(), false);
      assert.deepEqual(await page.evaluate(() => window.__requests), []);
    });
    await test('no uncaught browser errors', async () => assert.deepEqual(errors, []));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results }, null, 2));
  if (results.some(result => !result.passed)) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
