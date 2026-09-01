# OMAR CLINIC PRO — Master Product Requirements

## Product model

OMAR CLINIC PRO is a reusable **single-clinic master product**, not a centralized SaaS or shared multi-tenant database.

Every sold clinic receives an independent application, deployment, Supabase project when required, identity/configuration, users, data, and domain. Multiple employees, practitioners, or branches may later exist inside one clinic's independent installation, but customer clinics must not share a central operational database.

## Reusable configuration

Clinic name, logo, colors, phone, WhatsApp number, address, currency, working hours/days, services, and general system behavior should be controlled through settings or environment variables instead of repeated code edits.

## Delivery principles

- Preserve the live clinic and existing data during development.
- Keep GitHub as the source of truth for every database and application change.
- Inspect actual GitHub, Cloudflare, and Supabase state before changing a feature.
- Make database changes additive and rollback-friendly where practical.
- Keep secrets and `service_role` credentials out of frontend code and GitHub.
- Test build, RLS, logs, old data compatibility, and the complete workflow before deployment.
- Deliver one coherent feature group per phase with a clear commit.
- Treat Casanova feedback as candidates for the reusable master product.

## Priority roadmap

1. Quick Booking from one screen, including patient lookup/create, service, date/time, duration, price, deposit method, notes, conflict warning, summary, and atomic linked deposit.
2. Professional daily/weekly appointments with eight states, colors, filters, fast editing, reasons, delay tracking, conflict protection, and optional drag/drop.
3. Patient dashboard with summary, appointments, sessions, packages, account, photos, clinical notes, activity timeline, and fast actions.
4. Fast global patient search by Arabic/English name, phone, file number, and national ID where available.
5. Operational finance with income, expenses, receivables, deposits, payment methods, cash opening/closing, reconciliation, audit trail, and daily/weekly/monthly reports.
6. Management dashboard with appointments, attendance, patient retention, revenue, expenses, sessions, packages, receivables, top services, inactive patients, and upcoming appointments.
7. Deduplicated notification center for receivables, overdue follow-up, unconfirmed/no-show appointments, and near-term appointments.
8. Provider-neutral WhatsApp architecture with editable templates, automated reminders/follow-ups, manual send actions, delivery status, patient message history, and server-side secrets.

## Production gate

A release may reach Cloudflare only after a repeatable source build, dry run, browser smoke test, Supabase/RLS verification, and confirmation that production data was not altered unexpectedly.
