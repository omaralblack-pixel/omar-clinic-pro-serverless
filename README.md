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
