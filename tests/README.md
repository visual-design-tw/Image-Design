# Stability Regression Tests

## Workspace CSS

`workspace.css` is a prebuilt stylesheet for `index.html`. After changing
utility classes in the workspace, run `npm ci` (once per lockfile update) and
`npm run build:css`. Publish the stylesheet with the HTML and increment the
`workspace.css?v=` value in `index.html` when the generated file changes. Keep
conditional utilities as complete class names in the HTML or its inline
templates so Tailwind can discover them at build time. No build is required
on GitHub Pages, and the catalog and upload pages have separate styles.

`node --test tests/workspace-css.test.cjs` checks the relative stylesheet URL
under the GitHub Pages subdirectory and validates login and workbench styles
without any external network requests.

## Calendar Event Save

`node --test tests/calendar-event-save.test.cjs` uses a mocked workbook and the
real editor to verify unrelated and same-event conflicts, retained changes,
cross-month dates, and duplicate-free creation retries.

## Shape Print Invitations

`node --test tests/shape-print-invite.test.cjs` checks store-before-send,
single-recipient and manager authorization, duplicate prevention, manual
copy fallback, and the mobile invitation form. The mailer is mocked.

## Catalog Intake

```sh
node --test tests/catalog-intake.test.cjs
```

This suite uses a mocked workbook, mail sender and Drive, with the real Apps
Script request dispatcher and separate browser sessions for staff and guests.
It exercises roster creation and batch assignment, link and email-code scope,
all three intake formats, individual character ranges, legacy sheet headers,
approval, correction history, private download, legacy access cutover, and a
50 MiB synthetic upload that resumes after a lost acknowledgement. Guest UI
coverage includes the desktop and 320px layouts, retry on load failure,
email verification, long filenames, and draft preservation across steps.
Nothing is sent to the deployed system. Set `CATALOG_ARTIFACT_DIR` to a folder
to capture the admin field settings and guest form, overview, and receipt.

## Notification Center

`node tests/notification-center.test.cjs` checks grouped inbox rows, per-user
visibility, overlapping important/assignment categories, continuous search and
IME composition, advanced filters, explicit selection mode, scoped select-all,
pending read feedback and failure recovery, preserved delete confirmations,
related-assignment navigation, date boundaries, escaped text and mobile layouts.
Set `NOTIFICATION_ARTIFACT_DIR` for synthetic screenshots and JSON results.
Notification writes are mocked and no production messages are read or removed.

## Assignment Detail Navigation

`node tests/assignment-detail.test.cjs` checks the manager's review-first tabs,
pending-first group cards, collapsed history and management controls, keyboard
navigation, retained comment/guide drafts, assignment switching, returned-work
status, mobile overflow, and the student's existing three-step submission flow.
Set `DETAIL_ARTIFACT_DIR` for synthetic screenshots and results. The test blocks
production requests and opens review/delete confirmations without committing them.

## Design-Service Review Confirmation

`node tests/design-service-review.test.cjs` exercises the actual approval and
rejection buttons, one pending spinner, retained notes and explicit confirmation
retries, fresh locked reads, competing reviewers and changed deliverables,
permission boundaries, missing receipts, expiry, logout and mobile geometry.
Set `REVIEW_ARTIFACT_DIR` for fixture-only screenshots and the JSON result.
`REVIEW_BACKEND_ONLY=1` skips browser checks. No real case is reviewed and no
production notifications, files or student data are changed.

## Large Upload Throughput

`node tests/upload-speed.test.cjs` checks bounded live-account reads, expired and
revoked sessions, owner binding, legacy and new chunk sizes, pre-decode limits,
Drive acknowledgement boundaries, adaptive 2-8 MiB transfers, identical-range
retries, completion receipts, progress clocks and confirmed-byte speed/ETA.
A real isolated browser sends a synthetic 50 MiB file to a mocked endpoint.
The fast-link model uses 8 chunks instead of 25; this is a request-count
comparison, not a measured production speed claim. Set `UPLOAD_SPEED_ARTIFACT_DIR`
for the JSON report and mobile screenshot. No real account or Drive upload is used.

## Stateful Icons and Animation

`node tests/animation-icons.test.cjs` exercises actual pinned Lucide 1.61.0,
Morphicons 1.7.1 and Anime.js 4.5.0, rather than replacing their renderers with
stubs. It checks every configured icon state, repeated hydration, fast toggles,
single loading rings, late/failed modules, reduced motion, modal lifecycles,
desktop/mobile geometry and the actual standalone chunk-upload button against
a held mocked request. No production session, upload or account is used.
Set `MOTION_ASSET_DIR` to a directory containing verified `lucide.js`, `morph.js`,
and `anime.js` fixtures; otherwise the public dependency sources
are fetched. Set `MOTION_ARTIFACT_DIR` for JSON and synthetic screenshots.

## Design-Service Claim Confirmation

`node tests/design-service-claim.test.cjs` checks actual claim-button dispatch,
pending animation, repeated-click prevention, fresh locked reads and confirmed
state application, same-owner retry, lost responses, competing workers,
permissions and closed settings, missing parents, unrelated edits, expiry,
logout and mobile layout. Two isolated browser accounts exercise the real
frontend request path against one shared mocked backend. Set `CLAIM_ARTIFACT_DIR`
for JSON and synthetic loading-state screenshots. No production case is claimed,
no real eligibility settings are changed, and notifications are fixture-only.

## Authenticated Image Preview

`node tests/file-preview.test.cjs` checks private raster decoding through the
actual frontend request path and mocked Apps Script dispatch, record ownership,
assignment target teams, staff access, expired sessions, root-folder and trash
checks, bounded original/thumbnail responses, rejected active content, deliberate
retry, corrupted responses, late completion, temporary-URL cleanup, version
comparison, safe Drive fallback and mobile layout. Set `PREVIEW_ARTIFACT_DIR`
for a JSON report and synthetic desktop/mobile screenshots. No real Drive
permissions, production records or authenticated browser sessions are used.

## Upload Completion and Concurrent Comments

`node tests/upload-comments.test.cjs` checks both upload pages, legacy and
explicit completion responses, cached completion retry, final-chunk deduplication,
missing receipts and progress acknowledgements, authenticated append-only comments,
fresh reads under the server lock, lost-response retries, ownership boundaries,
draft retention, pending animation and duplicate-click protection. Two isolated
browser sessions also exercise the actual frontend request function against a
shared mocked backend. Set `UPLOAD_COMMENTS_REPORT_PATH` and
`UPLOAD_COMMENTS_SCREENSHOT_PATH` for the report and mobile retry screenshot.
No production data, mail, Drive files or credentials are used.

## Single-Project Mode

`node tests/stage-delete.test.cjs` checks that legacy stage activation and
deletion APIs are disabled, old navigation routes stay hidden, all clients
normalize to the single project title, fresh reads still bypass stale caches,
and desktop/mobile layouts remain usable. It uses isolated fixtures and never
changes production data.

## Password Reset and Storage Service

`node tests/password-reset.test.cjs` verifies explicit Sheets v4 configuration
without broader OAuth scopes, safe API-error classification, preserving atomic
save failure, save-before-mail ordering, account-enumeration protection,
duplicate-click prevention, retained email and clear timeout feedback, and
public reset requests with an expired workspace session. Set
`PASSWORD_RESET_REPORT_PATH` for a JSON report. All users, reset tokens, network
requests, and mail delivery are isolated fixtures; no production email is sent.

## Registration Entry Settings

`node tests/registration-options.test.cjs` covers the four public registration
entry switches, leader/teacher authorization, dedicated settings revisions,
old client saves, closed-route rejection, reopening, cross-device refresh,
failed saves, retained drafts, and all 16 entry combinations at desktop and
mobile widths. Set `REGISTRATION_REPORT_PATH` for a JSON result. Requests and
accounts are mocked; the suite makes no production registrations or changes.

## Assignment Guide Preview

`node tests/assignment-guides.test.cjs` checks Google Slides URL validation,
assignment creation and guide edits through mocked Apps Script dispatch,
schema persistence, role and target-team boundaries, retries, legacy saves,
recycle-bin retention, student drafts, and desktop/mobile preview layout.
Set `GUIDE_REPORT_PATH` to keep a JSON report. Google viewer requests are mocked;
this does not verify the real deck's sharing permissions or Google availability.


`stability.test.cjs` runs the local Apps Script logic in a VM and exercises the actual HTML in isolated headless Chrome. All GAS requests are mocked, and test accounts use `example.invalid`. It does not write to the production spreadsheet, send email, or upload files.

Requirements: Node.js, Playwright, and Chrome. The default Chrome path is the macOS application path; set `CHROME_PATH` for another installed executable. The page's existing CDN dependencies require network access.

From the project directory, with Playwright available to Node:

```sh
node tests/stability.test.cjs
```

On this workspace's bundled runtime:

```sh
env NODE_PATH=/Users/james/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/james/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/stability.test.cjs
```

Optional environment variables:

- `STABILITY_REPORT_PATH`: write a JSON result with source hashes. The containing directory must already exist.
- `AUDIT_SCREENSHOT_DIR`: create mobile layout screenshots in this directory.
- `CHROME_PATH`: override the installed Chrome executable.

A nonzero exit status indicates a failed test or harness error. The test server and browser are closed after execution. Fixture authentication and storage are mocked, so this suite does not prove real Google authorization, quota, email delivery, multi-user spreadsheet behavior, or Safari compatibility.

## Expanded Health Audit

The original audit below is a historical pre-fix reproducer. For the current
release, use the assertion-based regression gate instead:

```sh
node tests/full-health-fixes.test.cjs
```

This writes `audit/full-health-fixes-results-2026-09-05.json` and exits nonzero
for either an issue or a harness error. It covers all 11 findings, signed asset
receipts, changed-table atomic commits, partial restore retry, per-recipient
mail retry, real frontend request handling, stale responses, and 69 responsive
page views. Set `HEALTH_SCREENSHOT_PATH` to capture the restore-retry screen.
Keep running `stability.test.cjs` as well. Neither suite contacts production.

`node tests/full-health-audit.cjs` performs additional isolated fault-injection, authorization-boundary, reminder, restore, and browser checks. It imports fixture helpers without running the regression suite automatically. Use the same Node/Playwright environment as above.

It writes `audit/full-health-results-2026-09-05.json`. `issue` means the current behavior reproduced a concern; it is not a passing safety assertion. `pass` means the specific control check passed. Only `harness-error` causes a nonzero exit status, so do not use the exit code alone to declare the application healthy. This is an inspection tool, not a deployment gate.

If `/tmp/shapeprint-health-published-20260905.html` exists, the report records its hash and release marker. That file is an optional read-only public-page snapshot, not the source used for local browser tests.
