# PNS calendar scan

The production Vercel cron is declared in `vercel.json`: `0 15 * * *`
(08:00 Pacific daylight time / 07:00 Pacific standard time).

Production requires `CRON_SECRET` and `RESEND_API_KEY`. Set these in Vercel's
production environment and redeploy. Do not put secret values into source control.
Vercel sends `Authorization: Bearer <CRON_SECRET>`; an arbitrary
`x-vercel-cron` header is not authentication. The daily scheduler runs only for
production deployments, not this local server or preview deployments.
Official documentation: https://vercel.com/docs/cron-jobs/manage-cron-jobs

Manual admin scans and scheduled scans now share the same pipeline. New meets
stay drafts and changes to published meets still wait for admin acceptance.
Only administrators receive the summary email; families are not emailed here.

`meet_sync_status/pns` records last attempt, last successful scan, scan failures,
counts, email delivery failure/success and pending notification retries. The
admin Meets page shows the scan and delivery status. Quiet scans send no email;
the same outstanding update is not emailed repeatedly. A changed source revision
can send a new alert. Failed mail remains queued for the next scan; mail retries
use a stable Resend idempotency key. A short Firestore lease prevents overlapping
manual and scheduled scans. A mail delivery failure does not discard scanned
meets, and the scheduled endpoint returns an error so logs show the failure.

Validation: `npm run test:meets`. All notification tests use an in-memory store
and fake sender, and send no real mail. `scripts/diagnose-pns-readonly.ts` reads
existing scan timestamps and compares live PNS data without ingesting, changing
meets, or sending email.

The current local changes are not deployed. Read-only diagnosis on 2026-10-29
found 88 real saved meets last checked on 2026-09-14, 0 pending updates, and a
working live PNS endpoint (75 current meets, 7 new and 18 with source differences).
This does not prove whether production CRON_SECRET is configured or whether
Vercel registered the cron; deployment settings/logs must still be checked.
