# 구조

## 데이터 흐름

```
팝업 (src/popup)
  │  JSON 입력 → normalizeProduct → validateProduct
  │  chrome.tabs.sendMessage({type:"PREFILL", product})
  ▼
content script (src/content) — 판매자센터 페이지
  │  detectMarketplace(location.href)
  │  prefillProduct(product, adapter)
  ▼
공통 DOM 엔진 (src/shared/engine.ts, dom.ts)
  │  필드 명세 순회 → findControl → 값 설정 → 결과 보고
  ▼
FillReport → 팝업에 필드별 상태 표시
```

## 계정·구독 (선택)

```
팝업 (src/shared/account.ts)
  │  link/start → 제품 사이트 로그인·연결 승인 → link/redeem
  │  entitlement → 서버가 Paddle 구독 상태를 검증한 권한 응답
  ▼
제품 사이트·백엔드 (web/)
  │  magic-link 로그인, 확장 연결, Paddle checkout/portal
  │  Paddle 웹훅 → subscriptions/transactions/adjustments 저장
  ▼
무료/구독 판정: 서버 응답 + 24시간 이내 오프라인 토큰
```

- 무료는 하루 5회까지 `폼 채우기`를 허용하고, 구독은 횟수 제한이 없습니다.
- 서버는 계정 이메일·세션·확장 토큰·Paddle 매핑만 저장하며 상품 데이터는 받지 않습니다.
- 결제는 Paddle Checkout(`_ptxn` 링크 + Paddle.js)으로 열고, 성공 후 웹훅이 권한을 갱신합니다.

콘텐츠 스크립트는 선언적 주입(`manifest.json`)과 팝업의 `scripting.executeScript` 폴백을 모두 지원합니다.
중복 주입 시 리스너가 두 번 등록되지 않도록 `window.__productAutoInputLoaded` 플래그를 사용합니다.

## 표준 상품 모델

`src/shared/product.ts`의 `CanonicalProduct`가 유일한 진실입니다.

- 모든 입력은 `normalizeProduct()`를 거칩니다. 숫자·불리언·배열 표기, `12,900원`, `패션 > 남성` 같은
  공급사/크롤러 출력을 관대하게 흡수합니다.
- 알 수 없는 필드는 버립니다. 마켓별 확장은 `categoryCodes` JSON으로만 보관합니다.
- 옵션은 `optionGroups`(축)와 `variants`(조합)로 나뉩니다. 마켓별 옵션 빌더는 후속 단계입니다.

## 어댑터 계약

`src/adapters/types.ts`:

```ts
interface MarketplaceAdapter {
  id: MarketId;
  name: string;
  sellerCenter: string;
  createUrl: string;
  hosts: string[];
  urlPatterns: RegExp[];   // pathname + hash 기준
  verified: boolean;       // 실제 판매자 계정으로 DOM 확인 여부
  fields: FieldSpec[];     // 선언적 입력 명세
  requirements: string[];  // 등록 전 준비물
  notes: string[];
}

interface FieldSpec {
  key: FieldKey;           // 표준 모델에서 값을 꺼낼 키
  kind: "text" | "textarea" | "select" | "radio" | "checkbox"
      | "file" | "contenteditable" | "manual";
  labels?: string[];       // 라벨 별칭(없으면 FIELD_LABELS)
  selectors?: string[];    // 검증된 경우에만. 라벨 매칭보다 우선
  format?: "plain" | "comma" | "won";
  required?: boolean;
  note?: string;
}
```

### 필드 탐색

1. `selectors`가 있으면 해당 셀렉터에 매칭되는 입력란을 모두 찾습니다(검증된 셀렉터 전용).
2. 없으면 페이지의 `input/textarea/select/[contenteditable]`을 모아 라벨 텍스트를 수집합니다.
   - `aria-label`, `aria-labelledby`, `label[for]`, 래핑 `<label>`, `placeholder`, `title`,
     `id`/`name`, 짧은 행(row) 텍스트
3. `FIELD_LABELS` 별칭과 정규화 후 비교해 **정확 일치 1.0 / 시작 0.85 / 포함 0.65** 점수를 냅니다.
4. 0.6 이상인 입력란을 사용합니다. 같은 필드의 사이트별·탭별 중복 입력란은
   라벨을 정규화했을 때 **같은 의미**일 때만 함께 채웁니다.
   (`추가상품명`, `구입 당시 판매가`, `최소구매수량` 같은 유사 라벨은 제외)
5. 어댑터의 `kind`는 힌트로만 사용합니다. 실제 마켓이 `select`/`textarea`/`radio`로
   렌더링해도 값 입력이 가능한 컨트롤이면 매칭합니다.
6. 접힌 섹션·비활성 탭·숨겨진 입력란도 값 설정 대상에 포함합니다.
   단, 보이는 입력란을 우선하고 `input[type=search]`/`.filter-box`는 제외합니다.
7. 입력란 자체에 라벨이 없을 때만 바깥 섹션 헤더를 보조 라벨로 사용합니다.
8. 어댑터가 선언하지 않은 필드도 페이지 라벨에서 키를 추론해 값이 있으면 채웁니다.
9. `prepare`에서 `expandSections()`로 접힌 섹션을 먼저 펼칩니다. 이미 열린 섹션은 닫지 않습니다.

### 값 설정

- React/Vue 폼은 `element.value = x`만으로는 상태가 갱신되지 않습니다.
  `setNativeValue()`가 프로토타입 setter를 호출하고 `input`/`change` 이벤트를 발생시킵니다.
- `select`는 value 또는 option 텍스트를 정규화해 매칭합니다.
- 라디오/체크박스는 라벨 텍스트로 대상 컨트롤을 찾아 클릭합니다.
- `contenteditable`은 `textContent` + `input` 이벤트로 텍스트만 입력합니다(서식 없음).
- 파일 입력은 URL을 `fetch`해 `File`로 만들어 `DataTransfer`로 주입합니다.
  CORS로 실패하면 해당 이미지는 `error`로 보고하고 사용자가 직접 업로드합니다.

### 결과 상태

| 상태 | 의미 |
|---|---|
| `filled` | 실제로 값을 입력함 |
| `matched` | dryRun에서 입력란을 찾음 |
| `not-found` | 현재 화면에서 입력란을 못 찾음 |
| `manual` | 옵션 빌더·카테고리 선택 등 의도적으로 수동 처리 |
| `skipped` | 상품 값이 비어 있음 |
| `error` | 값 설정·업로드 실패 |

## 안전 불변식

- 저장/제출/게시/결제 버튼을 찾거나 클릭하는 코드가 없습니다.
- `FillReport.submitted`는 항상 `false`입니다.
- 자격증명·쿠키를 읽거나 전송하지 않습니다.
- 상품 JSON은 `chrome.storage.local` 초안으로만 저장됩니다.
- `verified: false` 어댑터는 팝업과 리포트에 경고를 표시합니다.

## 확장 포인트

- **마켓 추가**: `src/adapters/<market>.ts` + 레지스트리 + manifest host + 감지 테스트.
- **옵션 빌더**: `kind: "manual"` 필드를 어댑터별 커스텀 단계로 대체. `prefillProduct` 앞뒤에
  `beforePrefill`/`afterPrefill` 훅을 추가하는 방식이 유력합니다.
- **카테고리 코드 선택**: `categoryCodes[marketId]`를 이용한 검색·선택 단계.
- **일괄 등록**: 팝업 대신 로컬 큐(IndexedDB)와 탭 순회. 제출은 여전히 수동.
