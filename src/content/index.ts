import { getAdapter, detectMarketplace } from "../adapters/registry";
import { isLegacyElevenstForm } from "../adapters/elevenst";
import { scanFields, selectFormDocument } from "../shared/dom";
import { prefillProduct } from "../shared/engine";
import { normalizeProduct } from "../shared/product";
import type {
  PingResponse,
  PrefillResponse,
  RequestMessage,
  ScanResponse
} from "../shared/messages";

function currentAdapter() {
  return detectMarketplace(location.href);
}

/**
 * 11번가처럼 등록 폼이 같은 출처 iframe에 있는 마켓에서만 iframe 문서를 고른다.
 */
function formRoot(formInIframe: boolean): Document {
  return formInIframe ? selectFormDocument(document) : document;
}

/**
 * 선언적 content script와 팝업의 programmatic 주입이 겹칠 수 있어
 * 한 번만 리스너를 등록한다(주입 시 중복 응답 방지).
 */
const marker = "__productAutoInputLoaded" as const;
const registry = window as unknown as Record<string, boolean>;

// 셸 프레임은 폼이 교차 출처 iframe에 있으므로 리스너를 등록하지 않는다.
// ESM Plus: www.esmplus.com → item.esmplus.com
// 에이블리: my.a-bly.com → seller-admin.a-bly.com
const shellOnly =
  location.hostname === "www.esmplus.com" || location.hostname === "my.a-bly.com";

if (!shellOnly && !registry[marker]) {
  registry[marker] = true;

  chrome.runtime.onMessage.addListener(
    (
      message: RequestMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: PingResponse | ScanResponse | PrefillResponse) => void
    ) => {
      const adapter = currentAdapter();

      switch (message.type) {
        case "PING":
          sendResponse({ ok: true, adapterId: adapter?.id ?? null, href: location.href });
          return false;

        case "SCAN":
          sendResponse({
            ok: true,
            adapterId: adapter?.id ?? null,
            fields: scanFields(formRoot(adapter?.formInIframe === true)),
            ...(adapter && !adapter.verified
              ? { warning: "이 마켓의 셀렉터는 아직 실제 계정으로 검증되지 않았습니다." }
              : {})
          });
          return false;

        case "PREFILL": {
          const target = getAdapter(message.adapterId) ?? adapter;
          if (!target) {
            sendResponse({ ok: false, error: "지원하지 않는 판매자센터 페이지입니다." });
            return false;
          }
          const product = normalizeProduct(message.product);
          const root = formRoot(target.formInIframe === true);
          if (
            target.id === "elevenst" &&
            isLegacyElevenstForm(root.location?.href ?? "")
          ) {
            sendResponse({
              ok: false,
              error:
                "11번가 구버전 상품등록 화면은 지원하지 않습니다. '신규상품 등록' 화면에서 실행하세요."
            });
            return false;
          }
          const dryRun = message.dryRun === true;
          void (async () => {
            const prepared =
              !dryRun && target.prepare
                ? await target.prepare(root)
                : { actions: [] };
            const report = await prefillProduct(product, target, {
              dryRun,
              root
            });
            report.warnings.unshift(...prepared.actions);
            if (!dryRun && target.postFill) {
              const post = await target.postFill(product, root);
              report.warnings.push(...post.actions, ...post.warnings);
            }
            sendResponse({ ok: true, report });
          })().catch((error: unknown) =>
            sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : String(error)
            })
          );
          return true;
        }
      }
    }
  );
}
