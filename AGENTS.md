# AGENTS.md

## Project

Chrome MV3 extension that prefills product-registration forms on Korean marketplace seller centers.
TypeScript bundled with esbuild; tests with Vitest (node + jsdom); no runtime dependencies.

## Commands

- `npm run verify` — typecheck, tests, build. Run before finishing any change.
- `npm run build` — outputs `dist/`; load it unpacked in Chrome.

## Invariants

- Never add code that clicks save/submit/publish/payment buttons. Prefilling only.
- Never collect or transmit credentials. Use the existing browser session.
- Keep product data local (`chrome.storage.local`); no analytics or remote logging.
- CAPTCHA/human-verification is always handled by the user.

## Conventions

- Canonical schema lives in `src/shared/product.ts`; normalize unknown input there, not in adapters.
- Adapter field specs are declarative (`src/adapters/*.ts`). Add verified `selectors` only after
  checking the live seller center with a real seller account, and set `verified: true` only then.
- Keep marketplace-specific quirks in adapter `notes`/`requirements`, and mention multi-step flows.
- Use the shared DOM helpers (`findControl`, `setNativeValue`, `selectChoice`, `uploadFromUrls`).
  They dispatch native `input`/`change` events needed by React/Vue forms.
- Add tests for normalization, validation, and any new DOM behavior. DOM tests use
  `// @vitest-environment jsdom`.
- UI copy is Korean; code and comments are English/Korean mixed as in existing files.
- Do not introduce a framework in the popup; plain DOM + CSS.

## Adding a marketplace

1. Create `src/adapters/<market>.ts` with `commonFields()` overrides.
2. Register it in `src/adapters/registry.ts`.
3. Add the host to `public/manifest.json` (`content_scripts` and `host_permissions`).
4. Add a detection test in `test/adapters.test.ts`.
5. Follow `docs/marketplaces.md` to verify selectors with a real seller account.
