# 상품 등록 도우미 — Product Auto Input

국내 주요 오픈마켓 **판매자센터의 상품 등록 폼을 자동으로 채워 주는 Chrome 확장**입니다.
상품 정보를 한 번 JSON으로 정리해 두면, 마켓마다 반복해서 입력하던 상품명·가격·재고·배송·이미지·상세 설명을
현재 화면의 폼에 맞춰 입력합니다.

> **저장·제출은 자동으로 하지 않습니다.** 입력값을 확인하고 마지막 버튼은 판매자가 직접 누릅니다.
> 판매자 본인의 로그인 세션에서만 동작하며, 상품 데이터를 외부 서버로 보내지 않습니다.

## 지원 마켓

| 마켓 | 판매자센터 | 상태 |
|---|---|---|
| 네이버 스마트스토어 | `sell.smartstore.naver.com` | 상품명·브랜드·판매가·재고 확인 |
| 쿠팡 Wing | `wing.coupang.com` | 1단계(상품명·제조자·제조국) 확인 · 옵션/가격 미검증 |
| ESM Plus (G마켓·옥션) | `www.esmplus.com` | 상품명·판매가·재고·판매자코드 확인 |
| 11번가 셀러오피스 | `soffice.11st.co.kr` | 상품명·브랜드·판매가·재고·SKU·배송방법 확인 |
| 지그재그 파트너센터 | `partner.zigzag.kr` | 어댑터 골격 · **셀렉터 미검증** |
| 에이블리 셀러센터 | `my.a-bly.com` (폼: `seller-admin.a-bly.com`) | 상품명·판매가·SKU·상세·이미지·해시태그 확인 · 옵션/카테고리 수동 |

현재 버전은 **동작하는 스캐폴드**입니다. 공통 DOM 엔진(라벨 기반 필드 탐색, React/Vue 호환 값 설정,
이미지 업로드, 폼 스캔)은 구현·테스트되어 있지만, 마켓별 실제 셀렉터와 옵션 빌더는 판매자 계정으로
일부만 검증되었습니다. ESM Trade는 종료되어 ESM Plus로 통합되었습니다.
각 마켓의 검증 절차는 [`docs/marketplaces.md`](docs/marketplaces.md)를 참고하세요.

## 동작 방식

```
상품 JSON ──▶ 표준 상품 모델 정규화 ──▶ 마켓 어댑터(필드 명세) ──▶ 현재 페이지 DOM 채우기
                     │                         │
                     └─ 검증(필수/경고)         └─ 라벨·별칭 매칭 + 명시 셀렉터
```

1. 팝업에서 고정 CSV/XLSX 템플릿을 내려받아 1개 상품을 입력하거나, 상품 JSON을 붙여넣습니다.
2. 가져온 값의 누락·형식 오류를 팝업에서 바로 수정합니다.
3. 판매자센터의 **상품 등록 화면**을 엽니다.
4. 마켓을 선택하고 `폼 스캔`으로 입력란을 확인합니다.
5. `폼 채우기`를 누르면 현재 화면의 입력란을 채웁니다.
6. 값과 옵션·카테고리를 확인한 뒤 **직접 저장·제출**합니다.

등록 화면이 여러 단계로 나뉘는 마켓(쿠팡 등)은 단계마다 `폼 채우기`를 다시 실행합니다.

## 설치 (개발 빌드)

```bash
npm install
npm run build        # dist/ 생성
```

Chrome → `chrome://extensions` → 개발자 모드 → **압축해제된 확장 프로그램 로드** → `dist/` 선택.

## 요금과 제품 계정

- 무료: 하루 5회까지 `폼 채우기`.
- 구독: **월 ₩4,900**, 횟수 제한 없음. Paddle Billing으로 결제하며 언제든 다음 결제를 해지할 수 있습니다.
- 제품 사이트: <https://product-auto-input.onnurimun.com> — 이메일 magic-link 로그인,
  확장 연결, 구독/결제 관리.
- 팝업의 `계정 연결` → 제품 사이트에서 로그인·승인 → 팝업에서 `승인 확인` 순서로 연결합니다.
- 결제·구독 확인은 제품 서버가 Paddle 웹훅으로 검증합니다. 상품 초안과 폼 입력 데이터는
  제품 서버로 전송되지 않습니다.

웹 백엔드는 [`web/`](web/)에 있으며 `node:sqlite`와 Paddle Billing을 사용합니다.
배포 절차는 [`docs/deploy.md`](docs/deploy.md)를 참고하세요.

## 상품 JSON

표준 모델은 [`src/shared/product.ts`](src/shared/product.ts)에 정의되어 있습니다.
전체 예시는 [`examples/sample-product.json`](examples/sample-product.json).

```json
{
  "title": "온누리 스테인리스 텀블러 500ml",
  "price": 18900,
  "originalPrice": 25000,
  "stock": 120,
  "sku": "ONN-TMB-500",
  "categoryPath": ["생활/건강", "주방용품", "컵/텀블러"],
  "images": [{ "url": "https://example.com/main.jpg", "type": "main" }],
  "detailText": "이중 진공 구조로 보온·보냉이 오래갑니다.",
  "optionGroups": [
    { "name": "색상", "values": [{ "name": "실버" }, { "name": "블랙" }] }
  ],
  "shipping": { "origin": "대한민국", "method": "택배", "fee": 3000 }
}
```

`12,900원`, `7개`, `패션 > 남성 > 상의` 같은 표기도 관대하게 정규화합니다.
`categoryCodes`에 마켓별 카테고리 코드를 넣어 두면 이후 자동 선택 단계에서 사용할 수 있습니다.

## 안전 원칙

- **제출 자동화 없음** — 저장/등록/결제 버튼을 코드에서 찾거나 누르지 않습니다.
- **자격증명 수집 없음** — 판매자센터 로그인은 브라우저 세션을 그대로 사용합니다.
- **로컬 저장** — 초안은 `chrome.storage.local`에만 저장됩니다.
- **계정/결제 분리** — 제품 서버는 계정·구독 권한만 다루며 상품 데이터는 받지 않습니다.
- **CAPTCHA 우회 없음** — 인증이 뜨면 사용자가 직접 처리합니다.
- 자동화 허용 범위는 각 마켓 이용약관·판매자 정책을 확인하세요.

## 개발

```bash
npm run typecheck    # tsc --noEmit
npm test             # Vitest (정규화·검증·DOM 엔진·어댑터)
npm run build        # esbuild → dist/
npm run verify       # typecheck + test + build
npm --prefix web run typecheck && npm --prefix web test   # 계정/결제 백엔드
```

```
src/
  shared/       표준 상품 모델, 검증, 라벨 사전, DOM 엔진, 계정/권한, 메시지
  adapters/     마켓별 필드 명세 + 레지스트리
  content/      판매자센터 페이지에서 실행되는 content script
  popup/        확장 팝업 UI
shared/         확장·백엔드 공용 계정/구독 계약
web/            제품 사이트 + Paddle Billing 백엔드
public/         manifest·popup HTML/CSS·아이콘
test/           Vitest
docs/           구조·마켓 검증·배포·로드맵
```

구조와 확장 방법은 [`docs/architecture.md`](docs/architecture.md),
마켓별 검증 체크리스트는 [`docs/marketplaces.md`](docs/marketplaces.md),
다음 단계는 [`docs/roadmap.md`](docs/roadmap.md)에 있습니다.

## 라이선스

MIT
