# Casanova Laser Clinic — Cloudflare Worker

Deployment-ready static SPA for Casanova Beauty Center. The frontend is served by Cloudflare Workers Static Assets and connects directly to the existing Supabase project for authentication and clinic data.

This package intentionally uses Static Assets without a Worker entry script. This avoids a Windows-specific Wrangler bundling issue and is sufficient for this client-side clinic application. SPA routing and security headers are defined through the static-asset configuration, `_redirects`, and `_headers`.

## Deploy

```bash
npm install
npm run check
npm run deploy
```

No service-role or secret database key is stored in this repository. The browser uses only the Supabase publishable key; access to clinic data remains protected by Supabase Auth and Row Level Security.

## Repository status

This repository currently contains the production build artifacts, not the original React/Vite application source. Do not make substantial product changes by editing the minified files in `dist/assets`.

- Production audit: [`docs/CURRENT_SYSTEM_AUDIT_2026-09-01.md`](docs/CURRENT_SYSTEM_AUDIT_2026-09-01.md)
- Master product requirements: [`docs/MASTER_PRODUCT_REQUIREMENTS.md`](docs/MASTER_PRODUCT_REQUIREMENTS.md)
- Database migrations: [`supabase/migrations`](supabase/migrations)

Before the next frontend feature, recover the exact source project that generated the current bundle or reconstruct a maintainable source tree and prove visual/data compatibility with production. Keep each clinic deployment and Supabase project independent; this is a reusable single-clinic product, not a shared multi-tenant SaaS.
