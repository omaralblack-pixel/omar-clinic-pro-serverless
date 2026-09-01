# Source Reconstruction Status

## Purpose

The production bundle has no original React/Vite source in GitHub. This checkpoint creates a maintainable source tree without replacing `dist` or changing the Cloudflare deployment target.

## Implemented

- React/Vite application source under `src`.
- Branded RTL login matching the current production structure.
- Clinic-specific branding, contact, currency, timezone, Supabase URL, publishable key, and admin email moved to environment configuration.
- Existing 11-section application navigation shell reconstructed.
- Daily/weekly appointment calendar with service/status filters, eight status colors, quick editing, cancellation/no-show/delay details, conflict validation, and drag/drop rescheduling.
- Auth sessions restricted to the configured clinic admin email.
- Patient/service option loading through authenticated Supabase RLS.
- New Quick Booking modal with:
  - Existing patient lookup by name, phone, or file number.
  - Fast new-patient entry.
  - Service-driven duration and price.
  - Date/time, duration, price, deposit, payment method, and notes.
  - Booking summary.
  - Conflict lookup and explicit override.
  - Atomic appointment/deposit creation through `casanova_create_quick_booking`.
- Independent build output at `build/reconstructed`.
- Source maps enabled for future debugging.

## Safety boundary

`wrangler.jsonc` still deploys `dist`. The reconstructed source cannot reach Cloudflare through the current deployment command. This remains intentional until every active production screen is reconstructed and passes authenticated workflow testing.

## Remaining parity work

1. Dashboard metrics and upcoming appointments.
2. Patient list, create/edit, and patient dashboard.
3. Activities and follow-ups.
4. Laser sessions and packages.
5. Finance, inventory, and services management.
6. Reports and settings.
7. Authenticated browser regression tests using a dedicated non-production test account or an approved clinic login session.

## Build verification

Run `npm run build:source`. The build must complete without errors and must write only to `build/reconstructed`. Do not change Wrangler's assets directory until the parity checklist is complete.
