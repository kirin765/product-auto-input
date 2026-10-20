# 상품 등록 도우미 — Product Auto Input

국내 주요 오픈마켓 **판매자센터의 상품 등록 폼을 자동으로 채워 주는 Chrome 확장**입니다.
상품 정보를 한 번 JSON으로 정리해 두면, 마켓마다 반복해서 입력하던 상품명·가격·재고·배송·이미지·상세 설명을
현재 화면의 폼에 맞춰 입력합니다.

> **저장·제출은 자동으로 하지 않습니다.** 입력값을 확인하고 마지막 버튼은 판매자가 직접 누릅니다.
> 판매자 본인의 로그인 세션에서만 동작하며, 상품 데이터를 외부 서버로 보내지 않습니다.

## 지원 마켓

| 마켓 | 판매자센터 | 상태 |
|---|---|---|
| 네이버 스마트스토어 | `sell.smartstore.naver.com` | 어댑터 골격 · **셀렉터 미검증** |
| 쿠팡 Wing | `wing.coupang.com` | 어댑터 골격 · **셀렉터 미검증** |
| G마켓 ESM Trade | `etrade.gmarket.co.kr` | 어댑터 골격 · **셀렉터 미검증** |
| 옥션 ESM Trade | `etrade.auction.co.kr` | 어댑터 골격 · **셀렉터 미검증** |
| 11번가 셀러오피스 | `soffice.11st.co.kr` | 어댑터 골격 · **셀렉터 미검증** |
| 지그재그 파트너센터 | `partner.zigzag.kr` | 어댑터 골격 · **셀렉터 미검증** |
| 에이블리 셀러센터 | `seller.a-bly.com` | 어댑터 골격 · **셀렉터 미검증** |

현재 버전은 **동작하는 스캐폴드**입니다. 공통 DOM 엔진(라벨 기반 필드 탐색, React/Vue 호환 값 설정,
이미지 업로드, 폼 스캔)은 구현·테스트되어 있지만, 마켓별 실제 셀렉터와 옵션 빌더는 판매자 계정으로
검증되지 않았습니다. 각 마켓의 검증 절차는 [`docs/marketplaces.md`](docs/marketplaces.md)를 참고하세요.

## 동작 방식

```
상품 JSON ──▶ 표준 상품 모델 정규화 ──▶ 마켓 어댑터(필드 명세) ──▶ 현재 페이지 DOM 채우기
                     │                         │
                     └─ 검증(필수/경고)         └─ 라벨·별칭 매칭 + 명시 셀렉터
```

1. 팝업에 상품 JSON을 붙여넣거나 `예시`로 시작합니다.
2. 판매자센터의 **상품 등록 화면**을 엽니다.
3. 마켓을 선택하고 `폼 스캔`으로 입력란을 확인합니다.
4. `폼 채우기`를 누르면 현재 화면의 입력란을 채웁니다.
5. 값과 옵션·카테고리를 확인한 뒤 **직접 저장·제출**합니다.

등록 화면이 여러 단계로 나뉘는 마켓(쿠팡 등)은 단계마다 `폼 채우기`를 다시 실행합니다.

## 설치 (개발 빌드)

```bash
npm install
npm run build        # dist/ 생성
```

Chrome → `chrome://extensions` → 개발자 모드 → **압축해제된 확장 프로그램 로드** → `dist/` 선택.

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
- **CAPTCHA 우회 없음** — 인증이 뜨면 사용자가 직접 처리합니다.
- 자동화 허용 범위는 각 마켓 이용약관·판매자 정책을 확인하세요.

## 개발

```bash
npm run typecheck    # tsc --noEmit
npm test             # Vitest (정규화·검증·DOM 엔진·어댑터)
npm run build        # esbuild → dist/
npm run verify       # typecheck + test + build
```

```
src/
  shared/       표준 상품 모델, 검증, 라벨 사전, DOM 엔진, 메시지
  adapters/     마켓별 필드 명세 + 레지스트리
  content/      판매자센터 페이지에서 실행되는 content script
  popup/        확장 팝업 UI
public/         manifest·popup HTML/CSS·아이콘
test/           Vitest
docs/           구조·마켓 검증·로드맵
```

구조와 확장 방법은 [`docs/architecture.md`](docs/architecture.md),
마켓별 검증 체크리스트는 [`docs/marketplaces.md`](docs/marketplaces.md),
다음 단계는 [`docs/roadmap.md`](docs/roadmap.md)에 있습니다.

## 라이선스

MIT
