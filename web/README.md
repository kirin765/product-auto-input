# 상품 등록 도우미 — web (product website + backend)

Self-contained Node 22 TypeScript package for the product account, Paddle billing,
extension linking, and entitlement API. Runtime uses Node built-ins
(`node:http`, `node:sqlite`, `node:crypto`, `node:url`) and Nodemailer for SMTP.

## Quick start

```bash
cd web
npm install
npm run build     # esbuild -> dist/server.mjs
npm start         # node dist/server.mjs
```

Other scripts:

```bash
npm run typecheck # tsc --noEmit
npm test          # vitest run
```

Default server: `http://localhost:3022` (`PORT`).

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3022` | HTTP listen port |
| `HOST` | `127.0.0.1` | Bind address |
| `APP_BASE_URL` | `http://localhost:3022` | Public base URL used in magic links / checkout redirects |
| `SMTP_HOST` | *(empty)* | SMTP host for magic-link email; when empty, dev-log fallback |
| `SMTP_PORT` | `587` | SMTP port (use 465 with `SMTP_SECURE=true` for Gmail) |
| `SMTP_SECURE` | `false` | `true` for implicit TLS (port 465) |
| `SMTP_USER` / `SMTP_PASS` | *(empty)* | SMTP credentials (Gmail app password) |
| `SMTP_FROM` | *(empty)* | From address |
| `PADDLE_ENV` | `sandbox` | `sandbox` or `live` |
| `PADDLE_API_KEY` | *(empty)* | Paddle server API key (server-side only) |
| `PADDLE_WEBHOOK_SECRET` | *(empty)* | Paddle webhook signing secret |
| `PADDLE_PRICE_ID` | *(empty)* | The single ₩4,900/month price id (`pri_...`) |
| `PADDLE_CLIENT_TOKEN` | *(empty)* | Public Paddle.js client token for the account checkout page |
| `DB_PATH` | `:memory:` | SQLite file path (`:memory:` for tests/dev) |
| `SESSION_TTL_MS` | 30 days | Login + extension session lifetime |
| `LINK_TTL_MS` | 10 min | Extension link request lifetime |
| `ENTITLEMENT_TTL_MS` | 24 h | Max offline entitlement cache; never beyond paid/grace deadline |
| `GRACE_MS` | 3 days | Past-due recovery grace |
| `DEV_LOG_EMAIL` | `true` | Console-log magic links; also returns `devLink` in the JSON response |

Paddle API base is selected automatically: sandbox → `https://sandbox-api.paddle.com`,
live → `https://api.paddle.com`. See [`env.example`](env.example) for a deploy template.
Keep the real env file out of git.

## Paddle catalog (live)

- Product: `pro_01m5chkzddk8sp2sj603jhkq97` (`상품 등록 도우미`)
- Price: `pri_01m5cm63qqtrkt4h1r1v6tyydq` (`₩4,900`, monthly, KRW, `tax_mode: internal`)
- Webhook destination: `ntfset_01m5cje5fxr0gdhkqyqpr12a20`
  → `https://product-auto-input.onnurimun.com/api/webhooks/paddle`
- Subscribe to `subscription.created`, `subscription.updated`, `subscription.canceled`,
  `transaction.completed`, `adjustment.created`, `adjustment.updated`.

The checkout domain `product-auto-input.onnurimun.com` is approved (2026-10-20,
Apple Pay verified). The account page initializes Paddle.js with the public
`PADDLE_CLIENT_TOKEN`, so Paddle checkout links containing `_ptxn` open the overlay
automatically.

## API surface

| Endpoint | Responsibility |
| --- | --- |
| `POST /api/auth/magic-link` | One-time email login link (always 200; no account enumeration) |
| `GET /auth/verify?token=` | Consume the one-time token, set `sid` cookie |
| `POST /api/extension/link/start` | Begin a short-lived account-link flow |
| `POST /api/extension/link/approve` | Approve a link request (web session) |
| `POST /api/extension/link/redeem` | Exchange approved proof for an extension session |
| `GET /api/link/status?requestId=` | Poll link request state |
| `GET /api/entitlement` | Current fill permission + bounded offline token |
| `POST /api/billing/checkout` | Account-bound checkout for the server-selected price |
| `POST /api/billing/portal` | Paddle customer portal URL |
| `POST /api/webhooks/paddle` | Verify and persist billing changes |
| `GET /health` | `{ "ok": true }` |

Pages: `/`, `/guide`, `/login`, `/extension-connect`, `/account`, `/pricing`,
`/privacy`, `/terms`, `/refund`.

## Data handling

The backend stores only product-account email/session data, revocable extension
tokens, and Paddle customer/subscription/transaction/adjustment mappings plus a
processed-event ledger. **Product drafts, marketplace page content, images, and
seller-cookies never reach the backend.**

## Deployment

Runs under `systemd` on the apps VPS behind the `apps-vpc` Cloudflare tunnel at
`https://product-auto-input.onnurimun.com`. Production uses
`/opt/apps/product-auto-input/data/app.sqlite`. See [`../docs/deploy.md`](../docs/deploy.md).
