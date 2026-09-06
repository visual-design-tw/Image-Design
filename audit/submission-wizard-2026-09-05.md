# Student Submission Wizard

## Scope

Local frontend update in `index.html`. No production deployment or live GAS,
Drive, email, account, or assignment mutation was performed.

Eligible student submissions now show three sequential panels: requirements,
content preparation, and confirmation. Navigation does not recreate inputs.
History and discussion are collapsed in the requirements panel. Existing
teacher review and non-resubmittable record views remain available.

## Safeguards

- Existing validation gates step two and final submission.
- Large files must complete the existing stable upload flow before confirmation.
- Implicit form submission cannot bypass the confirmation step.
- Same-draft redraws preserve file inputs and text. Reopening loads saved text
  and completed upload metadata instead of copying stale hidden input values.
- Navigation and redraws are locked during final submission. Failure preserves
  the draft and request identity for retry; only cloud confirmation means success.
- Upload progress follows the visible step. Footer layout supports narrow screens,
  including the longer pending-submission label.
- Step changes announce position, focus a heading, and respect reduced motion.

## Verification

All 79 local checks passed:

- `tests/submission-wizard.test.cjs`: 14 browser checks.
- `tests/stability.test.cjs`: 28 existing regression checks.
- `tests/full-health-fixes.test.cjs`: 37 existing health checks.

Results are stored in the three `submission-wizard*-results-2026-09-05.json`
reports in this directory. Tests use isolated fixtures and intercepted requests,
not production data. Screenshots were visually inspected at desktop and mobile
sizes; mobile layout checks cover 390px and 320px widths.

The stability submission test now explicitly advances to confirmation. The
health suite accepts `HEALTH_REPORT_PATH` so reruns can preserve the earlier
health-fix report.

## Remaining Verification

After publishing the frontend, perform an authorized end-to-end submission with
the deployed GAS version, including a real large file and a mobile device.
This local change does not resolve or bypass any previously documented backend
migration or deployment requirements.
