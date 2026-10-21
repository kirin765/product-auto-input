# 상품 등록 도우미 — 스토어 제출 기록

제출 작업일: 2026-10-20 (KST). Chrome/Edge는 0.1.1, Firefox/Whale는 0.1.0.

## 대시보드

- Chrome: https://chrome.google.com/u/1/webstore/devconsole/fcf2a83c-a418-4ddb-8a23-e283590048f0/hmphkaliifejpnmdlincepodpplojplc/edit
- Edge: https://partner.microsoft.com/en-us/dashboard/microsoftedge/c9b846c4-455a-4039-a098-d781e79a4728/packages/dashboard
- Firefox: https://addons.mozilla.org/en-US/developers/addon/상품-등록-도우미-product-auto-input/edit
- Whale: https://store.whale.naver.com/developers/edit/extension/fppcpckimjgcpggfhilhdkddeeloommm?published=false

최종 확인: 2026-10-20 20:35 KST. 아래 상태는 승인·공개 완료를 뜻하지 않습니다.

| 스토어 | 버전 | 상태 |
|---|---|---|
| Chrome Web Store | 0.1.1 | 재제출 완료, Pending review |
| Microsoft Edge Add-ons | 0.1.1 | 제출 완료, In review |
| Firefox AMO | 0.1.0 | 제출 완료, nominated / unreviewed |
| Naver Whale | 0.1.0 | 제출 완료, Under review |

## Chrome 0.1.0 반려 및 수정

2026-10-20 20:28 KST 이메일. `Keyword Spam`, violation `Yellow Argon`.
반려 대상은 manifest description의 마켓명 나열입니다.
수정 패키지는 0.1.1로 재제출했고 Pending review를 다시 확인했습니다.
0.1.1에서는 마켓명을 제거하고 CSV/XLSX/JSON 기반 폼 입력 기능만 짧게 설명합니다.
상세 소개에서도 마켓명 나열을 제거하고 정확한 지원 범위는 프로젝트 README로 안내합니다.
원래의 3개 게시 한도는 대시보드의 Request increase로 5개까지 즉시 늘어났습니다.

Edge Store ID: `0RDCKFMF1XCH`, CRX ID: `lanpkdajdnncfgplngpfdflfdnleakmk`.

## 공개 개인정보처리방침

https://gist.github.com/kirin765/44b1d376103f145ea6a64cb1994d6c06

원본: `PRIVACY.md`. 개발자 서버 전송 없음, 로컬 초안 저장, 사용자 요청 폼 입력,
이미지 URL의 credentials 생략 요청, 판매자센터 자체의 데이터 처리 구분을 설명합니다.

## 산출물

- `release/product-auto-input-<version>-chrome.zip`: Chrome / Edge / Whale 공통 MV3 패키지.
- 같은 폴더에 `-edge.zip`, `-whale.zip`, `-firefox.zip`, `-source.zip` 사본.
- `store-assets/description-ko.txt`: 0.1.1 상세 소개.
- `store-assets/review-notes-en.txt`: 심사용 사용 순서와 제약.
- `store-assets/screenshot-1280x800.png`: 예시 상품을 표시한 팝업 화면.
- `store-assets/icon300.png`, `tile.png`: Edge 로고와 작은 홍보 이미지.
- `amo-metadata.json`: Firefox 요약, 카테고리, MIT 라이선스, 릴리스 노트.

## 0.2.0 — 계정 연결 및 Paddle 구독 추가 (제출 예정)

0.2.0은 무료/구독 모델과 Paddle Billing을 추가한다.

- 무료: 하루 5회까지 `폼 채우기`.
- 구독: 월 ₩4,900, 횟수 제한 없음. Paddle이 결제·세금·영수증을 처리한다.
- 제품 사이트 `https://product-auto-input.onnurimun.com`: 이메일 magic-link 로그인,
  확장 연결 승인, 구독 시작/관리(Paddle 고객 포털), 개인정보·약관·환불 정책.
- 새 호스트 권한 `https://product-auto-input.onnurimun.com/*`: 계정 연결·구독 권한 확인·
  결제/포털 이동에만 사용하며 상품 데이터는 전송하지 않는다.
- manifest `homepage_url` 추가, 버전 0.1.1 → 0.2.0.
- 개인정보처리방침에 계정·결제 서버가 저장하는 최소 정보와 Paddle/SMTP 처리를 명시했다.

스토어별 갱신 필요 항목:

- Chrome/Edge/Whale/Firefox: 새 ZIP, 버전 0.2.0, homepage/support/privacy URL,
  호스트 권한 사유, 무료/구독 설명.
- 제품 사이트의 `/privacy`, `/terms`, `/refund`를 개인정보처리방침/지원 URL로 사용한다.
- Paddle Website approval 승인 완료(2026-10-20), live checkout `₩4,900` VAT 포함 금액과
  Paddle 결제창 렌더링을 확인했다. 실제 결제는 실행하지 않았다.

## 빌드와 확인

`npm run verify`로 타입 검사, Vitest 69개 테스트, 양쪽 브라우저 빌드를 확인했습니다.
`npm run build`는 `dist/`(Chrome/Edge/Whale)와 `dist-firefox/`를 생성합니다.
Firefox는 background.scripts, 고정 Gecko ID, Firefox 140 이상, 데이터 수집 none을 사용하며,
공통 shim이 promise API를 Firefox browser 네임스페이스로 연결합니다.

Firefox 0.1.0은 web-ext lint 오류 0개. 경고는 innerHTML의 정적 분석 경고(동적 값은
escapeHtml 사용)와 데스크톱 전용 패키지의 Android 최소 버전 안내입니다.
읽을 수 있는 TypeScript 소스와 빌드 파일을 AMO 버전 6599308에 제출했습니다.
Chrome/Firefox background 번들의 API 초기화도 별도로 확인했습니다.

심사용 계정 자격증명은 공유하지 않았습니다. 팝업의 예시/양식/로컬 저장은 로그인 없이
확인 가능하며, 실제 판매자 폼 검증에는 심사자의 권한 있는 판매자 계정이 필요함을 안내했습니다.
