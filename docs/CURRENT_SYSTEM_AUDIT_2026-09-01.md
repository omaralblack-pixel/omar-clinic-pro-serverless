# Current System Audit — 2026-09-01

## Executive result

The live Casanova application is healthy and its JavaScript bundle is byte-identical to the bundle committed to `omaralblack-pixel/omar-clinic-pro-serverless`. The only observed HTML difference was the production cache-busting suffix `?v=af0747e`; this repository now records that suffix.

The repository is deployment-ready but is **not a maintainable frontend source repository**. It contains `dist`, Wrangler configuration, and static assets, while the original React/Vite source that produced the minified bundle is absent. Large frontend changes must wait until that source is recovered or safely reconstructed.

Supabase is the active backend. The application uses Supabase Auth and the production `casanova_*` schema. Row Level Security is enabled on all production clinic tables. The first Quick Booking backend foundation has been implemented as additive migrations without deleting or rewriting existing clinic data.

## Production topology

| Layer | Active production |
| --- | --- |
| GitHub | `omaralblack-pixel/omar-clinic-pro-serverless`, branch `main` |
| Cloudflare Worker | `casanova-laser-clinic` |
| Production URL | `https://casanova-laser-clinic.omaralblack.workers.dev` |
| Supabase project | `omar-clinic-pro` (`xaaydwxmpfvzawsfgayq`) |
| Primary database scope | `public.casanova_*` |
| Architecture | Independent single-clinic deployment |

The deleted `omaralblack-pixel/omar-clinic-pro` repository is not part of the active runtime and must not be treated as production source.

## Source and deployment audit

- Current repository files: compiled `dist`, static assets, `wrangler.jsonc`, `package.json`, and deployment documentation.
- No `src`, Vite configuration, TypeScript source, component source, or source maps are committed.
- Historical `src/index.js` was only a small Cloudflare static-asset Worker wrapper; it was not the clinic frontend source.
- `wrangler deploy --dry-run` is the intended pre-deployment check.
- The browser receives only a Supabase publishable key. No `service_role` secret was found in the repository.
- Cloudflare production returned HTTP 200 and served the JavaScript with the expected gzip encoding and content type at audit time.
- Production and GitHub JavaScript SHA-256: `27f2d0d78e9c58e63775639f7d9b0c61967ce3952178ffade998e168a62f2311`.

## Supabase audit

Active application tables observed in the compiled client include patients, patient activities, services, appointments, laser sessions, packages, transactions, inventory, and user settings under the `casanova_*` prefix.

Completed database hygiene:

- Removed the confirmed unused legacy schema in migration `20260831104147_remove_unused_legacy_clinic_schema`.
- Added 16 missing foreign-key indexes in migration `20260831104942_add_missing_foreign_key_indexes`.
- Added the Quick Booking foundation in migration `20260831110725_quick_booking_foundation`.
- Added the appointment status timestamp trigger in migration `20260901072210_appointment_status_timestamp_trigger`.
- Corrected the trigger to use the statement time in migration `20260901072710_use_statement_timestamp_for_appointment_status`.

Safety observations:

- RLS remains enabled on production clinic tables.
- `casanova_admins`, `casanova_admin_sessions`, `casanova_audit_log`, `casanova_login_attempts`, and `casanova_settings` have RLS but no direct client policies. This is informational until their intended server-side access paths are confirmed.
- The `casanova_patient_activities` ownership policy contains a suspicious self-comparison in its appointment branch. It is owner-scoped, but it should be corrected in a separately tested RLS migration after the frontend behavior is mapped.
- Supabase leaked-password protection cannot be enabled on the current Free plan. It requires upgrading the project plan; no safe database migration can replace that Auth setting.
- Current performance advisor output contains unused-index notices, not missing foreign-key-index warnings. Unused-index notices are informational at this data size; indexes should not be removed without workload evidence.

## Feature matrix

| Feature | Status before this phase | Supabase work | Frontend work | Cloudflare deployment |
| --- | --- | --- | --- | --- |
| Quick Booking | Partial modal with patient, service, time, duration, price, paid amount, notes | Foundation complete: atomic booking/deposit RPC, conflict lookup, methods, statuses | Must switch UI to RPC, add summary, conflict override, deposit method | Required after source recovery and testing |
| Appointments | Basic list/create/edit and 5 statuses | 8 statuses and status detail fields complete | Day/week calendar, badges, filters, fast edit, drag/drop | Required |
| Patient file | Partial dashboard and tabs | Existing related tables | Summary cards, clinical fields, photos, unified timeline and actions | Required |
| Global search | Basic patient search exists | Review normalized/indexed search after real query audit | Persistent fast search with richer result preview | Required |
| Finance | Transactions and basic reports exist | Deposit link now atomic; cash-shift/audit model still needed | Cash opening/closing, reconciliation and detailed reports | Required |
| Dashboard | Partial operational dashboard | Aggregation/RPC review may be needed | Complete requested KPIs and useful charts only | Required |
| Notifications | Not found | Notification/deduplication model needed | Notification center and deep links | Required |
| WhatsApp | Settings fields only; no provider/message delivery | Provider-neutral outbox, templates, message log, Edge Function secrets needed | Send actions, templates UI, status history | Required |

## First implemented feature: Quick Booking foundation

The database now supports:

- Appointment states: `scheduled`, `confirmed`, `arrived`, `in_progress`, `completed`, `cancelled`, `no_show`, and `delayed`.
- Cancellation reason, no-show reason, delay minutes, status note, and last status-change timestamp.
- Payment methods: cash, card, CliQ, bank transfer, legacy transfer, and other.
- Owner-scoped appointment conflict lookup.
- One authenticated atomic RPC that validates patient/service ownership, detects overlaps, creates the appointment, and creates a linked deposit transaction in the same database transaction.
- Explicit RPC permission for `authenticated` only; `anon` and `public` execution are revoked.
- An `(owner_id, starts_at)` index for the schedule access pattern.

The migration was verified with a transaction that created a future booking and CliQ deposit, checked the conflict result, then rolled back. The rollback preserved production data.

## Next implementation order

1. Recover or reconstruct maintainable React/Vite source and reproduce the production UI locally.
2. Integrate the Quick Booking modal with `casanova_find_appointment_conflicts` and `casanova_create_quick_booking`.
3. Add the day/week appointment calendar and full status workflow.
4. Improve the patient dashboard and global search.
5. Add finance controls, notifications, then provider-neutral WhatsApp delivery.

No Cloudflare deployment should occur until the source recovery build is compared against production and the clinic's current flows pass a browser smoke test.
