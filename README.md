# menu-cms

QR restaurant menu + lightweight CMS. Next.js on Cloudflare Workers, Supabase, R2.

- Spec: `restaurant-qr-menu-BUILD-PROMPT.md`
- Plan & decisions: `docs/PLAN.md`
- Free-tier limits: `docs/LIMITS.md`

## Local development

```bash
npm install
cp .env.example .env.development.local   # dev only (never .env.local)
npm run dev                  # Next dev server  → http://localhost:3000
npm run preview              # Workers runtime  → http://localhost:8787
```

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`.
