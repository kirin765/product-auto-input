# 상품 등록 도우미 — Product Auto Input 개인정보처리방침

시행일: 2026-10-20

## 기능과 처리하는 정보

상품 등록 도우미는 사용자가 입력하거나 CSV/XLSX/JSON에서 가져온 상품명, 가격, 재고, SKU, 배송, 옵션, 이미지 URL, 상품 설명을 판매자센터의 상품 등록 폼에 입력합니다. 현재 탭의 주소로 지원 판매자센터를 감지하고, 해당 페이지의 입력란 라벨과 구조를 기기에서 분석합니다. 확장 프로그램은 상품 저장·제출·게시·결제 버튼을 누르지 않습니다.

구독을 사용하는 경우 제품 계정(이메일 magic-link 로그인)과 Paddle 결제/구독 권한을 제품 서버에서 처리합니다. **상품 데이터와 판매자센터 페이지 내용은 제품 서버로 전송되지 않습니다.**

## 로컬 저장과 삭제

상품 초안, 선택 마켓, 스키마 버전은 브라우저의 확장 전용 로컬 저장소(chrome.storage.local / browser.storage.local)에 저장됩니다. 상품 데이터는 클라우드로 동기화되지 않으며, 분석·광고·원격 로그에 사용하지 않습니다. 브라우저에서 확장 프로그램의 로컬 데이터를 지우거나 확장을 제거하면 해당 데이터가 삭제됩니다. 사용자가 내보낸 파일은 사용자가 직접 삭제해야 합니다.

제품 서버는 다음 계정·결제 정보만 저장합니다: 제품 계정 이메일, 로그인 세션, 철회 가능한 확장 연결 토큰, Paddle 고객/구독/결제 기간/환불(조정) 매핑. 상품명·가격·이미지 URL·상세 설명·CSV/XLSX/JSON 초안은 저장하지 않습니다. 계정 삭제를 원하면 support@onnurimun.com으로 문의하세요.

## 네트워크와 제3자

사용자가 폼 채우기를 실행하면 해당 판매자센터 페이지에 상품 정보가 입력됩니다. 페이지 자체의 처리·임시저장·전송에는 각 마켓의 개인정보처리방침이 적용됩니다. 사용자가 제공한 이미지 URL은 이미지 업로드를 위해 브라우저에서 요청할 수 있습니다. 이 요청은 credentials: omit으로 실행되며, 이미지 호스트는 통상적인 IP 주소·요청 메타데이터를 받을 수 있습니다. 개발자는 상품 정보와 이미지 파일을 수신하거나 보관하지 않습니다.

확장은 계정 연결·구독 권한 확인을 위해 `https://product-auto-input.onnurimun.com`에만 요청합니다. 전송 내용은 연결 토큰과 권한 응답이며 상품 데이터는 포함되지 않습니다. 제품 사이트는 magic-link 로그인 메일 발송을 위해 SMTP 메일 서비스를 사용하며, 결제는 Paddle.com Market Ltd.가 처리합니다. Paddle의 결제 정보 처리에는 Paddle의 개인정보처리방침이 적용됩니다.

확장은 비밀번호·쿠키·인증 토큰을 수집하지 않으며, 판매자 본인의 기존 로그인 세션에서만 동작합니다. 개인정보를 판매하거나 광고, 신용 평가, 대출, 사용자 추적에 이용하지 않습니다. 데이터를 사람에게 전달하거나 검토를 위해 전송하지 않습니다.

## 권한

- storage: 상품 초안과 선택 마켓의 로컬 저장.
- activeTab: 사용자가 실행한 현재 탭의 마켓 감지와 폼 작업.
- scripting: 필요한 경우 현재 지원 판매자센터에 동봉된 폼 입력 코드를 실행.
- 지원 판매자센터 호스트 권한: 스마트스토어, 쿠팡 Wing, ESM Plus, 11번가, 지그재그, 에이블리 페이지의 입력란 탐색과 폼 입력.
- `product-auto-input.onnurimun.com` 호스트 권한: 제품 계정 연결, 구독 권한 확인, Paddle 결제/고객 포털 이동. 상품 데이터는 전송하지 않습니다.

외부 코드를 다운로드하거나 실행하지 않습니다. Chrome Web Store 사용자 데이터 정책의 Limited Use 요건을 준수하며, 데이터 사용은 사용자가 요청한 상품 폼 입력 기능으로 제한됩니다.

## 문의 및 변경

문의: https://github.com/kirin765/product-auto-input/issues · support@onnurimun.com

기능이나 처리 방식이 바뀌면 이 문서와 시행일을 갱신합니다.

## English summary

Product Auto Input processes user-provided product data locally to prefill supported Korean marketplace seller forms. Drafts and the selected marketplace are stored in extension-local browser storage. A separate product server handles only account email, login sessions, revocable extension-link tokens, and Paddle customer/subscription/refund mappings; product data and seller-page content are never sent to it. No analytics, advertising, remote logging, credential collection, or remote code is used. Form data is inserted into the seller page at the user's request; the marketplace's own processing is governed by its policy. User-provided image URLs may be fetched without credentials to upload images; image hosts may receive IP addresses and normal request metadata. The developer does not receive product data. The extension does not click save, submit, publish, or payment buttons. Remove the extension or clear its local data to delete stored drafts; exported files must be deleted separately. Contact: support@onnurimun.com or https://github.com/kirin765/product-auto-input/issues. This extension complies with the Chrome Web Store User Data Policy, including its Limited Use requirements.
