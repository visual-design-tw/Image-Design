# Stability Regression Tests

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
