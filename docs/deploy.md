# 배포 정보 (VPS) — product-auto-input

제품 웹/백엔드는 **apps VPS**(systemd + Cloudflare tunnel)에서 실행한다.
웹 백엔드는 `node:sqlite`를 쓰므로 영속 디스크가 없는 Vercel 대신 VPS를 사용한다.

| 항목 | 값 |
| --- | --- |
| 공개 URL | `https://product-auto-input.onnurimun.com` |
| VPS | `49.247.192.39` (Tailscale `100.65.186.87`, root SSH 키) |
| 앱 경로 | `/opt/apps/product-auto-input` (소유 `appuser`) |
| systemd | `app-product-auto-input.service`, `127.0.0.1:3022` 바인딩 |
| 아티팩트 | `web/dist/server.mjs` → `/opt/apps/product-auto-input/releases/<release>/server.mjs` (현재 `0.2.0`) |
| DB | `/opt/apps/product-auto-input/data/app.sqlite` |
| env | `/opt/apps/product-auto-input/.env.production.local` (600, appuser) |
| tunnel | `apps-vpc`, hostname은 `cafe24-vps-migrate/scripts/add_public_hostname.py`로 추가 |

## 배포 절차 (코드 변경 시)

```bash
# 로컬
cd web && npm ci && npm run typecheck && npm test && npm run build
scp -o BatchMode=yes -o HostKeyAlias=49.247.192.39 \
  dist/server.mjs root@100.65.186.87:/tmp/product-auto-input-server.mjs
ssh -o BatchMode=yes -o HostKeyAlias=49.247.192.39 root@100.65.186.87 \
  'mkdir -p /opt/apps/product-auto-input/releases/<release> &&
   install -o appuser -g appuser -m 644 /tmp/product-auto-input-server.mjs \
     /opt/apps/product-auto-input/releases/<release>/server.mjs &&
   rm -f /tmp/product-auto-input-server.mjs'
# systemd ExecStart의 release 경로를 바꾼 뒤
systemctl daemon-reload
systemctl restart app-product-auto-input
curl -fsS https://product-auto-input.onnurimun.com/health
```

새 호스트명/포트를 등록할 때만 `add_public_hostname.py product-auto-input.onnurimun.com 3022`를
실행한다(멱등).

## env 키 (`/opt/apps/product-auto-input/.env.production.local`)

| 키 | 값/상태 |
| --- | --- |
| `NODE_ENV` | `production` |
| `HOST` / `PORT` | `127.0.0.1` / `3022` |
| `APP_BASE_URL` | `https://product-auto-input.onnurimun.com` |
| `DB_PATH` | `/opt/apps/product-auto-input/data/app.sqlite` |
| `DEV_LOG_EMAIL` | `false` |
| `PADDLE_ENV` | `live` |
| `PADDLE_API_KEY` | 설정됨 (서버 측 전용) |
| `PADDLE_PRICE_ID` | `pri_01m5cm63qqtrkt4h1r1v6tyydq` — ₩4,900 KRW/월, `tax_mode: internal` |
| `PADDLE_WEBHOOK_SECRET` | 설정됨 (Product Auto Input 전용 destination) |
| `PADDLE_CLIENT_TOKEN` | 설정됨 (Paddle.js 공개 토큰, 계정 페이지 결제창) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | `smtp.gmail.com` / `465` / `true` |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | 설정됨 (Gmail 앱 비밀번호, 서버 측 전용) |

## 인증

Clerk 없이 **magic-link(이메일 일회용 링크)** 로 로그인한다. 운영은
`DEV_LOG_EMAIL=false`이며 위 SMTP 설정으로 실제 발송한다.

## Paddle 상태 (2026-10-20)

- Live product: `pro_01m5chkzddk8sp2sj603jhkq97` (`상품 등록 도우미`)
- Live price: `pri_01m5cm63qqtrkt4h1r1v6tyydq` (`₩4,900`/월, KRW, tax internal)
- 이전 `₩9,900` 가격(`pri_01m5chmqfqz7ekbafcefj6g9y2`)은 archived 처리했다.
- Live webhook destination: `ntfset_01m5cje5fxr0gdhkqyqpr12a20`
- Paddle.js client token: `ctkn_01m5ck4rydhc0gtdz9nnemdz2g` (public)
- 기존 legacy `godomall-review.vercel.app` destination(`ntfset_01m0w32...`)을 비활성화해
  활성 destination 10개 한도를 확보했다.
- **Website approval 완료:** `product-auto-input.onnurimun.com`이 2026-10-20 Paddle에서
  승인되었고 Apple Pay도 verified 상태다(도메인 ID `chedom_01m5cjy2p0m0tj72vchypzt118`).
- Paddle.js용 공개 client token을 발급해 `/account`에서 초기화한다. `_ptxn` 결제 링크가
  열리면 Paddle Checkout 오버레이가 자동으로 표시된다.
- Live checkout 수동 검증: `₩4,900` (VAT 포함 총액) 결제창이 정상 렌더링됨을 확인했고,
  실제 결제는 실행하지 않았다.

## 주의

- `node:sqlite`는 실험 기능이라 journal에 경고가 남을 수 있다(동작에는 문제 없음).
- 서비스는 loopback(`127.0.0.1:3022`)에만 바인딩되며 공개는 tunnel을 통해서만 이뤄진다.
- env 파일은 `appuser:appuser` 600. 값을 회수/출력하지 않는다.
- 확장 프로그램은 `host_permissions`에 제품 오리진을 추가한 새 버전(0.2.0)이라
  Chrome/Edge/Whale/Firefox 스토어 재심사가 필요하다.
