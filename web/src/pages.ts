import { FREE_DAILY_FILLS } from "../../shared/schema";

const CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1f2933; background: #f7f8fa; line-height: 1.6; }
header { background: #2f6bff; color: #fff; padding: 16px 24px; }
header a { color: #fff; text-decoration: none; font-weight: 700; font-size: 18px; }
nav { margin-top: 8px; display: flex; gap: 16px; flex-wrap: wrap; font-size: 14px; }
nav a { color: #e8efff; font-weight: 400; }
main { max-width: 720px; margin: 32px auto; padding: 0 20px 64px; }
.card { background: #fff; border: 1px solid #e4e7eb; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
h1 { font-size: 24px; margin: 0 0 12px; }
h2 { font-size: 18px; margin: 24px 0 8px; }
label { display: block; font-weight: 600; margin-bottom: 6px; }
input[type=email] { width: 100%; padding: 10px 12px; border: 1px solid #cbd2d9; border-radius: 8px; font-size: 15px; }
button { background: #2f6bff; color: #fff; border: 0; border-radius: 8px; padding: 10px 18px; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 12px; }
button.secondary { background: #fff; color: #1f2933; border: 1px solid #cbd2d9; }
a.button { display: inline-block; background: #2f6bff; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 700; margin-top: 12px; }
a.button.secondary { background: #fff; color: #1f2933; border: 1px solid #cbd2d9; }
.muted { color: #616e7c; font-size: 14px; }
.badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 13px; font-weight: 700; }
.badge.paid { background: #d3f9d8; color: #2b8a3e; }
.badge.free { background: #e9ecef; color: #495057; }
.notice { background: #fff4e6; border: 1px solid #ffd8a8; border-radius: 8px; padding: 12px 16px; font-size: 14px; }
.price { font-size: 32px; font-weight: 800; }
footer { text-align: center; color: #9aa5b1; font-size: 13px; padding: 24px; }
ul { padding-left: 20px; }
a:focus-visible, button:focus-visible { outline: 3px solid #2459dd; outline-offset: 3px; }
code { background: #f2f3f5; padding: 1px 4px; border-radius: 4px; }
`;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PRODUCT_NAME = "상품 등록 도우미";

export function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} · ${PRODUCT_NAME}</title>
<style>${CSS}</style>
</head>
<body>
<header>
  <a href="/">${PRODUCT_NAME}</a>
  <nav>
    <a href="/guide">사용 방법</a>
    <a href="/pricing">요금</a>
    <a href="/account">내 계정</a>
    <a href="/refund">환불 정책</a>
    <a href="/privacy">개인정보</a>
    <a href="/terms">이용약관</a>
  </nav>
</header>
<main>${body}</main>
<footer>© 2026 ${PRODUCT_NAME} · product-auto-input.onnurimun.com · 문의: support@onnurimun.com</footer>
</body>
</html>`;
}

export function homePage(): string {
  return layout(
    "홈",
    `<div class="card">
      <h1>마켓별 상품 등록 폼을 한 번에 채우세요</h1>
      <p>상품 정보를 CSV·XLSX·JSON으로 한 번만 정리하면, 스마트스토어·쿠팡·ESM Plus·11번가 등 판매자센터의 상품 등록 폼에 맞춰 입력합니다.</p>
      <p class="muted">입력은 사용자의 브라우저에서만 실행되며, 상품 데이터는 서버로 전송되지 않습니다. 저장·제출은 직접 합니다.</p>
      <p class="notice"><strong>무료로 하루 ${FREE_DAILY_FILLS}회</strong> 폼을 채울 수 있습니다. 구독하면 횟수 제한 없이 사용할 수 있습니다.</p>
      <a class="button" href="/pricing">요금 보기</a>
      <a class="button secondary" href="/guide">사용 방법</a>
    </div>
    <div class="card">
      <h2>제품 계정</h2>
      <p class="muted">제품 계정은 마켓 로그인과 별개입니다. 구독 확인과 확장 프로그램 연결에만 사용됩니다.</p>
      <a class="button secondary" href="/login">로그인</a>
      <a class="button secondary" href="/account">내 계정</a>
    </div>`
  );
}

export function guidePage(): string {
  return layout(
    "사용 방법",
    `<article class="card">
      <h1>사용 방법</h1>
      <ol>
        <li>팝업에서 <strong>CSV/XLSX 가져오기</strong> 또는 상품 JSON을 입력합니다.</li>
        <li>오류·경고를 확인하고 필요한 값을 수정합니다.</li>
        <li>판매자센터의 <strong>상품 등록 화면</strong>을 엽니다.</li>
        <li>마켓을 선택하고 <strong>폼 채우기</strong>를 누릅니다.</li>
        <li>입력된 값과 옵션·카테고리를 확인한 뒤 <strong>직접 저장·제출</strong>합니다.</li>
      </ol>
      <p class="muted">여러 단계로 나뉜 마켓은 각 단계에서 폼 채우기를 다시 실행하세요. 저장·제출·결제 버튼은 자동으로 누르지 않습니다.</p>
      <h2>무료와 구독</h2>
      <p>무료는 하루 ${FREE_DAILY_FILLS}회까지 폼을 채울 수 있습니다. 구독은 월 ₩4,900이며 횟수 제한 없이 사용할 수 있습니다.</p>
      <p class="muted">CAPTCHA·본인인증은 사용자가 직접 처리해야 합니다. 판매자 계정 로그인은 브라우저 세션을 그대로 사용합니다.</p>
      <a class="button secondary" href="/pricing">요금 보기</a>
    </article>`
  );
}

export function loginPage(opts: { error?: string | null; next?: string | null; sent?: boolean } = {}): string {
  const nextValue = escapeHtml(opts.next ?? "/account");
  const errorBlock = opts.error ? `<p class="notice">${escapeHtml(opts.error)}</p>` : "";
  const sentBlock = opts.sent
    ? `<p class="notice">입력한 이메일로 로그인 링크를 보냈습니다. 메일함을 확인해 주세요.</p>`
    : "";
  return layout(
    "로그인",
    `<div class="card">
      <h1>로그인</h1>
      <p class="muted">이메일 주소로 일회용 로그인 링크를 보내드립니다. 비밀번호는 사용하지 않습니다.</p>
      ${errorBlock}
      ${sentBlock}
      <form method="post" action="/api/auth/magic-link">
        <input type="hidden" name="next" value="${nextValue}" />
        <label for="email">이메일</label>
        <input id="email" name="email" type="email" required placeholder="you@example.com" />
        <button type="submit">로그인 링크 받기</button>
      </form>
    </div>`
  );
}

export function extensionConnectPage(opts: {
  requestId: string;
  email?: string | null;
  error?: string | null;
  alreadyApproved?: boolean;
}): string {
  const errorBlock = opts.error ? `<p class="notice">${escapeHtml(opts.error)}</p>` : "";
  const approvedBlock = opts.alreadyApproved
    ? `<p class="notice">이미 승인되었습니다. 확장 프로그램으로 돌아가 연결을 완료하세요.</p>`
    : `<button id="approve">확장 프로그램 연결 승인</button>
       <p class="muted" id="status"></p>
       <script>
         const button = document.getElementById('approve');
         const status = document.getElementById('status');
         button.addEventListener('click', async () => {
           button.disabled = true;
           status.textContent = '승인 중...';
           try {
             const res = await fetch('/api/extension/link/approve', {
               method: 'POST',
               headers: { 'content-type': 'application/json' },
               body: JSON.stringify({ requestId: ${JSON.stringify(opts.requestId)} })
             });
             if (res.ok) {
               status.textContent = '승인되었습니다. 확장 프로그램으로 돌아가 주세요.';
             } else {
               const data = await res.json().catch(() => ({}));
               status.textContent = '승인 실패: ' + (data?.error?.message || res.status);
               button.disabled = false;
             }
           } catch (e) {
             status.textContent = '네트워크 오류가 발생했습니다.';
             button.disabled = false;
           }
         });
       </script>`;
  return layout(
    "확장 프로그램 연결",
    `<div class="card">
      <h1>확장 프로그램 연결 승인</h1>
      ${errorBlock}
      <p>로그인 계정: <strong>${escapeHtml(opts.email ?? "")}</strong></p>
      <p class="muted">아래 버튼을 누르면 이 브라우저의 확장 프로그램이 제품 계정에 연결됩니다. 요청 ID: <code>${escapeHtml(opts.requestId)}</code></p>
      ${approvedBlock}
    </div>`
  );
}

export function accountPage(opts: {
  email: string;
  active: boolean;
  status: string;
  paidUntil: string | null;
  graceUntil: string | null;
  revoked: boolean;
  revokeReason: string | null;
  cancelAtPeriodEnd: boolean;
  portalAvailable: boolean;
  checkoutSuccess?: boolean;
  paddleClientToken?: string;
  paddleEnv?: "sandbox" | "live";
}): string {
  const badge = opts.active
    ? `<span class="badge paid">구독 이용 중</span>`
    : `<span class="badge free">무료</span>`;
  const successBlock = opts.checkoutSuccess
    ? `<p class="notice">결제 확인 중입니다. 웹훅으로 결제가 확인되면 이용 권한이 활성화됩니다.</p>`
    : "";
  const revokeBlock = opts.revoked
    ? `<p class="notice">환불/지불거절로 이 구독의 이용 권한이 회수되었습니다${opts.revokeReason ? ` (사유: ${escapeHtml(opts.revokeReason)})` : ""}. 다시 이용하려면 새로 결제해 주세요.</p>`
    : "";
  const cancelBlock = opts.cancelAtPeriodEnd
    ? `<p class="muted">다음 결제가 해지 예약되었습니다. 현재 결제 기간이 끝날 때까지 이용할 수 있습니다.</p>`
    : "";
  const graceBlock = opts.graceUntil
    ? `<p class="muted">결제 실패로 유예 기간이 적용 중입니다. 유예 종료: ${escapeHtml(opts.graceUntil)}</p>`
    : "";

  return layout(
    "내 계정",
    `<div class="card">
      ${opts.paddleClientToken ? `<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
      <script>
        ${opts.paddleEnv === "sandbox" ? "Paddle.Environment.set('sandbox');" : ""}
        Paddle.Initialize({
          token: ${JSON.stringify(opts.paddleClientToken).replace(/</g, "\\u003c")},
          eventCallback: function (event) {
            if (event.name === 'checkout.completed') {
              setTimeout(function () { window.location.href = '/account?checkout=success'; }, 1200);
            }
          },
          checkout: { settings: { successUrl: window.location.origin + '/account?checkout=success' } }
        });
      </script>` : ""}
      <h1>내 계정</h1>
      ${successBlock}
      ${revokeBlock}
      <p>${badge} <span class="muted">계정: ${escapeHtml(opts.email)}</span></p>
      <p class="muted">구독 상태: ${escapeHtml(opts.status)}${opts.paidUntil ? ` · 결제 기간 만료: ${escapeHtml(opts.paidUntil)}` : ""}</p>
      ${graceBlock}
      ${cancelBlock}
      <button id="portal" class="secondary" ${opts.portalAvailable ? "" : "disabled"}>결제 관리 / 구독 해지</button>
      <p class="muted" id="portal-status"></p>
      <script>
        const portal = document.getElementById('portal');
        const portalStatus = document.getElementById('portal-status');
        portal.addEventListener('click', async () => {
          portal.disabled = true;
          portalStatus.textContent = '이동 중...';
          try {
            const res = await fetch('/api/billing/portal', { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.url) { window.location.href = data.url; return; }
            portalStatus.textContent = '실패: ' + (data?.error?.message || res.status);
          } catch (e) {
            portalStatus.textContent = '네트워크 오류가 발생했습니다.';
          }
          portal.disabled = false;
        });
      </script>
    </div>
    <div class="card">
      <h2>구독 해지 안내</h2>
      <p class="muted">구독 해지는 언제든지 가능하며, 해지 시 다음 결제부터 청구되지 않습니다. 이미 결제된 현재 기간은 만료일까지 이용할 수 있습니다. 환불은 <a href="/refund">환불 정책</a>을 따릅니다.</p>
      <a class="button" href="/pricing">요금제 보기</a>
    </div>`
  );
}

export function pricingPage(): string {
  return layout(
    "요금",
    `<div class="card">
      <h1>요금제</h1>
      <p class="price">₩4,900 <span class="muted" style="font-size:16px">/ 월</span></p>
      <p>매월 자동 결제, 언제든 다음 결제 해지</p>
      <ul>
        <li>폼 채우기 횟수 제한 없음</li>
        <li>모든 지원 마켓과 모든 입력 방식(CSV·XLSX·JSON)</li>
        <li>세금 포함 총액 ₩4,900</li>
      </ul>
      <p class="muted">무료: 하루 ${FREE_DAILY_FILLS}회까지 폼 채우기</p>
      <button id="checkout">구독 시작</button>
      <p class="muted" id="checkout-status"></p>
      <script>
        const checkout = document.getElementById('checkout');
        const status = document.getElementById('checkout-status');
        checkout.addEventListener('click', async () => {
          checkout.disabled = true;
          status.textContent = '결제 페이지로 이동 중...';
          try {
            const res = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
            const data = await res.json();
            if (res.status === 401) { window.location.href = '/login?next=/pricing'; return; }
            if (res.ok && data.url) { window.location.href = data.url; return; }
            status.textContent = '실패: ' + (data?.error?.message || res.status);
          } catch (e) {
            status.textContent = '네트워크 오류가 발생했습니다.';
          }
          checkout.disabled = false;
        });
      </script>
    </div>
    <div class="card">
      <h2>결제 안내</h2>
      <ul>
        <li>결제는 <strong>Paddle.com Market Ltd.</strong>가 Merchant of Record로 처리하며, 영수증·세금 계산을 담당합니다.</li>
        <li>구독은 매월 자동 갱신되며, 계정 페이지에서 언제든 해지할 수 있습니다.</li>
        <li>해지 후에도 현재 결제 기간이 끝날 때까지 이용할 수 있습니다.</li>
      </ul>
    </div>`
  );
}

export function privacyPage(): string {
  return layout(
    "개인정보 처리방침",
    `<div class="card">
      <h1>개인정보 처리방침</h1>
      <p><strong>상품 데이터는 백엔드로 전송되지 않습니다.</strong> 상품명·가격·이미지 URL·상세 설명·CSV/XLSX/JSON 초안은 사용자의 컴퓨터(브라우저)에만 저장되며 제품 서버로 전송되지 않습니다. 폼 입력은 사용자가 연 판매자센터 페이지에서만 이뤄집니다.</p>
      <h2>서버가 저장하는 정보</h2>
      <ul>
        <li>제품 계정 이메일과 로그인 세션</li>
        <li>확장 프로그램 연결 토큰(철회 가능)</li>
        <li>Paddle 고객/구독/결제 기간/환불(조정) 매핑</li>
      </ul>
      <h2>서버가 저장하지 않는 정보</h2>
      <ul>
        <li>입력한 상품 데이터와 생성한 초안 파일</li>
        <li>판매자센터 로그인 쿠키 또는 자격 증명</li>
      </ul>
      <p class="muted">문의: support@onnurimun.com</p>
    </div>`
  );
}

export function termsPage(): string {
  return layout(
    "이용약관",
    `<div class="card">
      <h1>이용약관</h1>
      <p>본 제품은 사용자가 직접 확인·제출하는 조건으로 판매자센터 상품 등록 폼 입력을 보조하는 도구입니다.</p>
      <ul>
        <li>저장·제출·게시·결제 버튼을 자동으로 누르지 않습니다.</li>
        <li>CAPTCHA·본인인증 우회를 지원하지 않습니다.</li>
        <li>판매자 계정 로그인은 사용자의 브라우저 세션을 그대로 사용하며, 자격 증명을 수집하지 않습니다.</li>
        <li>구독 결제는 제품 기능만 부여하며, 마켓의 판매 권한이나 정책 위반에 대한 면책을 부여하지 않습니다.</li>
        <li>각 마켓의 이용약관과 판매자 정책을 직접 확인해야 합니다.</li>
      </ul>
      <p class="muted">문의: support@onnurimun.com</p>
    </div>`
  );
}

export function refundPage(): string {
  return layout(
    "환불 정책",
    `<div class="card">
      <h1>환불 정책</h1>
      <p>결제는 Paddle을 통해 처리됩니다. 환불은 다음 원칙을 따릅니다.</p>
      <h2>전액 환불 (현재 결제 기간)</h2>
      <p>현재 이용 기간을 완전히 커버하는 확정된 전액 환불 또는 지불거절(chargeback)은 해당 기간의 이용 권한을 회수하고, 향후 갱신을 중지하기 위해 영향을 받은 구독을 해지합니다. 회수는 되돌릴 수 없으며, 재이용은 새 결제가 필요합니다.</p>
      <h2>부분 환불</h2>
      <p>부분 환불은 이용 권한을 자동으로 회수하지 않습니다.</p>
      <h2>과거 기간 환불</h2>
      <p>이미 지난 결제 기간에 대한 환불은 현재 결제 기간의 이용 권한을 회수하지 않습니다.</p>
      <h2>승인 대기/거절된 환불</h2>
      <p>승인 대기 중이거나 거절된 환불은 이용 권한에 영향을 주지 않습니다.</p>
      <h2>지불거절 철회(반전)</h2>
      <p>환불/지불거절이 철회(반전)되면 회수 상태를 다시 평가하여 해제할 수 있습니다.</p>
      <p class="muted">문의: support@onnurimun.com</p>
    </div>`
  );
}

export function notFoundPage(): string {
  return layout("페이지 없음", `<div class="card"><h1>페이지를 찾을 수 없습니다</h1><a class="button" href="/">홈으로</a></div>`);
}

export function errorPage(message: string): string {
  return layout("오류", `<div class="card"><h1>오류</h1><p class="notice">${escapeHtml(message)}</p></div>`);
}
