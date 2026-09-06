const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { fixture } = require('./stability.test.cjs');
const root = path.resolve(__dirname, '..');
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error('FAIL ' + name + '\n' + error.stack); }
}
async function main() {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(root, 'index.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', timezoneId: 'Asia/Taipei' });
    await context.route(/https:\/\/script\.(google|googleusercontent)\.com\//, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: { state: fixture(), currentUser: null } }) }));
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
    await page.evaluate(seed => {
      window.__seed = seed;
      window.__reset = (mode = 'file-text', id = 'U03') => {
        authEpoch++;
        assignmentSubmitInFlight = false;
        closeAssignmentDetailModal(true);
        state = JSON.parse(JSON.stringify(window.__seed));
        state.Assignments[0].Submission_Mode = mode;
        state.Assignments[0].Title = '第二次會審：主視覺與設計說明';
        state.Assignments[0].Body = '請上傳主視覺 PDF，並填寫設計說明。';
        normalizeStateSchema();
        currentUser = state.Users.find(user => user.User_ID === id);
        authSessionToken = 'TEST-ONLY';
        remoteSaveInFlight = false; remoteSavePromise = null; pendingRemoteSave = false; remoteMutationInFlight = false;
        workspaceHydrationInFlight = false; remoteStateRevision = 1; gasConnectionStatus = 'remote';
        cancelQueuedRemoteStateSync();
        activeWorkspace = id === 'U01' ? 'admin' : 'team'; activeTab = 'files';
        assignmentSubmitDrafts.clear(); sessionStorage.clear(); pendingLargeAssignmentAssetUpload = null;
        window.__requests = [];
        requestGas = async (action, payload) => { window.__requests.push(action); throw new Error('Test network blocked'); };
        setSaveFeedback('idle', ''); renderAll(); openAssignmentDetailModal('A01');
      };
      window.__reset();
    }, fixture());
    const visible = id => page.locator('#' + id).isVisible();
    const next = () => page.locator('#assignment-wizard-next').click();
    const back = () => page.locator('#assignment-wizard-back').click();
    await test('opens only requirements, with collapsed history and no premature submit', async () => {
      assert.equal(await visible('assignment-wizard-requirements'), true);
      assert.equal(await visible('assignment-wizard-prepare'), false);
      assert.equal(await visible('assignment-wizard-confirm'), false);
      assert.equal(await visible('assignment-submit-button'), false);
      assert.equal(await visible('assignment-secondary-content'), false);
      assert.equal(await page.locator('#assignment-wizard-nav [aria-current="step"]').textContent(), '1. 確認規範');
      await page.screenshot({ path: '/tmp/submission-wizard-step1.png' });
    });
    await test('next shows only inputs; missing content stays on step two with a clear error', async () => {
      await next();
      assert.equal(await visible('assignment-wizard-requirements'), false);
      assert.equal(await visible('assignment-wizard-prepare'), true);
      assert.equal(await visible('assignment-wizard-confirm'), false);
      assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-wizard-heading')), true);
      await next();
      assert.equal(await page.evaluate(() => assignmentWizardStep), 2);
      assert.ok(await page.locator('#assignment-wizard-error').textContent());
      assert.deepEqual(await page.evaluate(() => window.__requests), []);
    });
    await test('file and text survive back/next and a same-assignment redraw', async () => {
      await page.locator('#assignment-submit-file').setInputFiles({ name: 'main-visual.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test-only') });
      await page.locator('#assignment-submit-text').fill('設計說明：以藍色與幾何圖形呈現主視覺。');
      await back(); await next();
      assert.equal(await page.locator('#assignment-submit-text').inputValue(), '設計說明：以藍色與幾何圖形呈現主視覺。');
      assert.equal(await page.evaluate(() => document.getElementById('assignment-submit-file').files[0].name), 'main-visual.pdf');
      await page.evaluate(() => renderAssignmentDetailModal());
      assert.equal(await page.evaluate(() => assignmentWizardStep), 2);
      assert.equal(await page.evaluate(() => document.getElementById('assignment-submit-file').files[0].name), 'main-visual.pdf');
      assert.ok((await page.locator('#assignment-submit-text').inputValue()).includes('幾何圖形'));
      await page.screenshot({ path: '/tmp/submission-wizard-step2.png' });
    });
    await test('confirmation shows summary and checklist, not editing controls; no upload yet', async () => {
      await next();
      assert.equal(await visible('assignment-wizard-confirm'), true);
      assert.equal(await visible('assignment-wizard-prepare'), false);
      assert.equal(await visible('assignment-submit-button'), true);
      assert.equal(await visible('assignment-wizard-next'), false);
      assert.ok((await page.locator('#assignment-wizard-summary').textContent()).includes('main-visual.pdf'));
      assert.equal(await page.evaluate(() => document.getElementById('assignment-upload-transfer-status').parentElement.id), 'assignment-wizard-confirm');
      assert.deepEqual(await page.evaluate(() => window.__requests), []);
      await page.screenshot({ path: '/tmp/submission-wizard-step3.png' });
    });
    await test('footer stays in viewport at narrow widths and every step is scrollable', async () => {
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 740 });
        for (const step of [1, 2, 3]) {
          await page.evaluate(step => setAssignmentWizardStep(step, false), step);
          const geometry = await page.evaluate(() => {
            const footer = document.getElementById('assignment-wizard-controls').getBoundingClientRect();
            const body = document.getElementById('assignment-detail-modal-body');
            body.scrollTop = body.scrollHeight;
            return { bottom: footer.bottom, left: footer.left, right: footer.right, height: innerHeight, width: innerWidth, maxHeight: getComputedStyle(body.parentElement).maxHeight, panelHeight: body.parentElement.getBoundingClientRect().height, overflow: body.scrollWidth > body.clientWidth + 1, canScroll: body.scrollHeight <= body.clientHeight || body.scrollTop > 0 };
          });
          await page.screenshot({ path: '/tmp/submission-wizard-mobile.png' });
          assert.ok(geometry.bottom <= geometry.height && geometry.left >= 0 && geometry.right <= geometry.width, JSON.stringify(geometry));
          assert.equal(geometry.overflow, false);
          assert.equal(geometry.canScroll, true);
        }
      }
      await page.screenshot({ path: '/tmp/submission-wizard-mobile.png' });
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await test('text-only Enter advances to confirmation rather than submitting', async () => {
      await page.evaluate(() => window.__reset('text'));
      await next();
      await page.locator('#assignment-submit-text').fill('文字作業');
      await page.evaluate(() => document.getElementById('assignment-submit-form').requestSubmit());
      assert.equal(await page.evaluate(() => assignmentWizardStep), 3);
      assert.deepEqual(await page.evaluate(() => window.__requests), []);
      assert.equal(await page.locator('#assignment-submit-file').count(), 0);
    });
    await test('real submit locks navigation, keeps failure draft and retry uses same request ID', async () => {
      await page.evaluate(() => {
        window.__payloads = [];
        requestGas = (action, payload) => {
          window.__payloads.push(payload);
          return new Promise((resolve, reject) => { window.__resolve = resolve; window.__reject = reject; });
        };
      });
      await page.locator('#assignment-submit-button').click();
      await page.waitForFunction(() => assignmentSubmitInFlight);
      await page.evaluate(() => renderAssignmentDetailModal());
      assert.equal(await page.locator('#assignment-wizard-back').isDisabled(), true);
      await page.setViewportSize({ width: 320, height: 740 });
      assert.equal(await page.evaluate(() => {
        const button = document.getElementById('assignment-submit-button').getBoundingClientRect();
        const back = document.getElementById('assignment-wizard-back').getBoundingClientRect();
        return button.right <= innerWidth && button.bottom <= innerHeight && button.left >= back.right;
      }), true);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.evaluate(() => window.__reject(new Error('Simulated offline')));
      await page.waitForFunction(() => !assignmentSubmitInFlight);
      assert.equal(await page.evaluate(() => assignmentWizardStep), 3);
      assert.equal(await page.locator('#assignment-submit-text').inputValue(), '文字作業');
      await page.locator('#assignment-submit-button').click();
      await page.waitForFunction(() => window.__payloads.length === 2);
      assert.equal(await page.evaluate(() => window.__payloads[0].requestId === window.__payloads[1].requestId), true);
      await page.evaluate(() => {
        const payload = window.__payloads[1];
        const item = { ...payload.submission, Submission_ID: 'TEST_SUB', Request_ID: payload.requestId, Status: '已繳交', Submission_No: 1 };
        const next = JSON.parse(JSON.stringify(state)); next.Assignment_Submissions.push(item);
        window.__resolve({ ok: true, data: { state: next, currentUser, submission: item, stateRevision: 2 } });
      });
      await page.waitForFunction(() => !assignmentSubmitInFlight && !activeAssignmentId);
      assert.equal(await page.evaluate(() => state.Assignment_Submissions.length), 1);
    });
    await test('file-only flow and an already uploaded large-file draft can reach confirmation', async () => {
      await page.evaluate(() => {
        window.__reset('file');
        const draft = getAssignmentSubmissionDraft('A01');
        draft.asset = { assignmentId: 'A01', teamId: 'T02', fileName: 'large-design.ai', fileSize: 175 * 1024 * 1024, fileUrl: 'https://drive.google.com/file/d/test/view', driveFileId: 'test', driveFolderId: 'folder' };
        persistAssignmentSubmissionDraft(draft); renderAssignmentDetailModal();
      });
      await next(); await next();
      assert.equal(await page.evaluate(() => assignmentWizardStep), 3);
      assert.ok((await page.locator('#assignment-wizard-summary').textContent()).includes('large-design.ai'));
      assert.equal(await page.locator('#assignment-submit-text').count(), 0);
    });
    await test('large file must finish its upload before moving to confirmation', async () => {
      await page.evaluate(() => window.__reset('file')); await next();
      await page.evaluate(() => {
        const transfer = new DataTransfer();
        transfer.items.add(new File([new Uint8Array(51 * 1024 * 1024)], 'large.ai', { type: 'application/postscript' }));
        const input = document.getElementById('assignment-submit-file');
        input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await next();
      assert.equal(await page.evaluate(() => assignmentWizardStep), 2);
      assert.equal(await visible('assignment-large-upload-panel'), true);
      assert.ok(await page.locator('#assignment-wizard-error').textContent());
      assert.deepEqual(await page.evaluate(() => window.__requests), []);
    });
    await test('student input is escaped in confirmation summary', async () => {
      await page.evaluate(() => window.__reset('text'));
      await next();
      await page.locator('#assignment-submit-text').fill('<img src=x onerror="window.bad=1">');
      await next();
      assert.equal(await page.locator('#assignment-wizard-summary img').count(), 0);
      assert.ok((await page.locator('#assignment-wizard-summary').textContent()).includes('<img'));
    });
    await test('switching assignments does not carry a selected file or skip requirements', async () => {
      await page.evaluate(() => window.__reset()); await next();
      await page.locator('#assignment-submit-file').setInputFiles({ name: 'private.pdf', mimeType: 'application/pdf', buffer: Buffer.from('test') });
      await page.evaluate(() => {
        state.Assignments.push({ ...state.Assignments[0], Assignment_ID: 'A02' });
        openAssignmentDetailModal('A02');
      });
      assert.equal(await page.evaluate(() => assignmentWizardStep), 1);
      assert.equal(await page.evaluate(() => document.getElementById('assignment-submit-file').files.length), 0);
    });
    await test('teacher review retains its existing non-wizard interface', async () => {
      await page.evaluate(() => window.__reset('text', 'U01'));
      assert.equal(await page.locator('#assignment-wizard-nav').count(), 0);
      assert.equal(await visible('assignment-secondary-content'), true);
      assert.equal(await visible('assignment-wizard-requirements'), true);
    });
    await test('submitted student with no resubmission sees records, not another submission wizard', async () => {
      await page.evaluate(() => {
        window.__reset('text'); state.Assignments[0].Allow_ReSubmit = false;
        state.Assignment_Submissions.push({ Submission_ID: 'SUB_DONE', Assignment_ID: 'A01', Team_ID: 'T02', User_ID: 'U03', Status: '已繳交', Submission_No: 1, Text_Content: 'Already submitted' });
        renderAssignmentDetailModal();
      });
      assert.equal(await page.locator('#assignment-wizard-nav').count(), 0);
      assert.equal(await visible('assignment-secondary-content'), true);
    });
    await test('all interactions complete without uncaught page errors', async () => assert.deepEqual(errors, []));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  fs.writeFileSync(path.join(root, 'audit/submission-wizard-results-2026-09-05.json'), JSON.stringify({ results }, null, 2));
  if (results.some(result => !result.passed)) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
