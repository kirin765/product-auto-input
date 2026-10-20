import { getAdapter, detectMarketplace } from "../adapters/registry";
import { scanFields } from "../shared/dom";
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
 * 선언적 content script와 팝업의 programmatic 주입이 겹칠 수 있어
 * 한 번만 리스너를 등록한다(주입 시 중복 응답 방지).
 */
const marker = "__productAutoInputLoaded" as const;
const registry = window as unknown as Record<string, boolean>;

if (!registry[marker]) {
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
            fields: scanFields(document),
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
          void prefillProduct(product, target, { dryRun: message.dryRun === true })
            .then((report) => sendResponse({ ok: true, report }))
            .catch((error: unknown) =>
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
