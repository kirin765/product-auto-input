import { MARKETPLACES, detectMarketplace, getAdapter } from "../adapters/registry";
import type { FillReport } from "../adapters/types";
import type {
  PingResponse,
  PrefillResponse,
  RequestMessage,
  ScanResponse
} from "../shared/messages";
import {
  parseProductInput,
  productToJson,
  sampleProduct,
  type CanonicalProduct
} from "../shared/product";
import { validateProduct, type ValidationIssue } from "../shared/validate";
import type { MarketId } from "../shared/product";

const DRAFT_KEY = "draft:product";

const el = {
  market: document.getElementById("market") as HTMLSelectElement,
  detected: document.getElementById("detected") as HTMLParagraphElement,
  json: document.getElementById("json") as HTMLTextAreaElement,
  issues: document.getElementById("issues") as HTMLDivElement,
  prefill: document.getElementById("prefill") as HTMLButtonElement,
  scan: document.getElementById("scan") as HTMLButtonElement,
  open: document.getElementById("open") as HTMLButtonElement,
  sample: document.getElementById("sample") as HTMLButtonElement,
  load: document.getElementById("load") as HTMLButtonElement,
  download: document.getElementById("download") as HTMLButtonElement,
  status: document.getElementById("status") as HTMLSpanElement,
  report: document.getElementById("report") as HTMLDivElement,
  version: document.getElementById("version") as HTMLSpanElement
};

let product: CanonicalProduct = sampleProduct();
let busy = false;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setStatus(text: string): void {
  el.status.textContent = text;
}

function setBusy(value: boolean): void {
  busy = value;
  el.prefill.disabled = value;
  el.scan.disabled = value;
}

function selectedAdapter() {
  return getAdapter(el.market.value as MarketId);
}

function renderMarkets(selected?: MarketId): void {
  el.market.innerHTML = MARKETPLACES.map(
    (adapter) =>
      `<option value="${adapter.id}">${escapeHtml(adapter.name)}</option>`
  ).join("");
  if (selected) el.market.value = selected;
  renderDetected();
}

function renderDetected(): void {
  const adapter = selectedAdapter();
  if (!adapter) return;
  const verified = adapter.verified ? "셀렉터 검증됨" : "셀렉터 미검증";
  el.detected.textContent = `${adapter.sellerCenter} · ${verified}`;
  el.detected.title = [...adapter.requirements, ...adapter.notes].join("\n");
}

function renderIssues(): void {
  const result = validateProduct(product);
  const issues: ValidationIssue[] = [...result.errors, ...result.warnings];
  if (issues.length === 0) {
    el.issues.className = "issues ok";
    el.issues.textContent = "필수 항목이 모두 채워졌습니다.";
    return;
  }
  el.issues.className = result.errors.length > 0 ? "issues error" : "issues warn";
  el.issues.innerHTML = `<strong>${
    result.errors.length > 0 ? `오류 ${result.errors.length}건` : `확인 ${result.warnings.length}건`
  }</strong><ul>${issues
    .slice(0, 6)
    .map((issue) => `<li>${escapeHtml(issue.message)}</li>`)
    .join("")}</ul>`;
}

function loadFromTextarea(): boolean {
  try {
    product = parseProductInput(el.json.value);
  } catch (error) {
    el.issues.className = "issues error";
    el.issues.textContent = `JSON을 읽을 수 없습니다: ${
      error instanceof Error ? error.message : String(error)
    }`;
    return false;
  }
  renderIssues();
  void saveDraft();
  return true;
}

async function saveDraft(): Promise<void> {
  await chrome.storage.local.set({ [DRAFT_KEY]: el.json.value });
}

async function restoreDraft(): Promise<void> {
  const stored = await chrome.storage.local.get(DRAFT_KEY);
  const raw = stored[DRAFT_KEY];
  if (typeof raw === "string" && raw.trim()) {
    el.json.value = raw;
    try {
      product = parseProductInput(raw);
    } catch {
      product = sampleProduct();
    }
  } else {
    el.json.value = productToJson(product);
  }
  renderIssues();
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToTab<T>(tabId: number, message: RequestMessage): Promise<T> {
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as T;
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    return (await chrome.tabs.sendMessage(tabId, message)) as T;
  }
}

const STATUS_TEXT: Record<string, string> = {
  filled: "입력",
  matched: "매칭",
  "not-found": "못 찾음",
  manual: "수동",
  skipped: "건너뜀",
  error: "오류"
};

function renderReport(report: FillReport): void {
  const count = (status: string) =>
    report.fields.filter((field) => field.status === status).length;
  const meta = [
    `입력 ${count("filled")}`,
    report.dryRun ? `매칭 ${count("matched")}` : "",
    count("manual") ? `수동 ${count("manual")}` : "",
    count("not-found") + count("error") ? `실패 ${count("not-found") + count("error")}` : ""
  ]
    .filter(Boolean)
    .join(" · ");

  el.report.innerHTML = `
    <div class="report-head">
      <div>${escapeHtml(report.adapterName)}</div>
      <span>${escapeHtml(meta)}</span>
    </div>
    <ul>
      ${report.fields
        .map(
          (field) => `<li>
            <span class="name">${escapeHtml(field.label)}${
              field.detail ? `<span class="detail">${escapeHtml(field.detail)}</span>` : ""
            }</span>
            <span class="badge ${field.status}">${STATUS_TEXT[field.status] ?? field.status}</span>
          </li>`
        )
        .join("")}
    </ul>
    ${
      report.warnings.length > 0
        ? `<ul class="warnings">${report.warnings
            .map((warning) => `<li>${escapeHtml(warning)}</li>`)
            .join("")}</ul>`
        : ""
    }`;
}

async function runPrefill(): Promise<void> {
  if (busy || !loadFromTextarea()) return;
  const adapter = selectedAdapter();
  const tab = await activeTab();
  if (!tab?.id) {
    setStatus("활성 탭을 찾지 못했습니다.");
    return;
  }

  setBusy(true);
  setStatus("폼을 채우는 중…");
  el.report.innerHTML = "";
  try {
    const response = await sendToTab<PrefillResponse>(tab.id, {
      type: "PREFILL",
      adapterId: adapter?.id ?? "smartstore",
      product
    });
    if (!response.ok || !response.report) {
      setStatus(response.error ?? "자동 입력에 실패했습니다.");
      return;
    }
    renderReport(response.report);
    setStatus("확인 후 직접 저장·제출하세요.");
  } catch (error) {
    setStatus(
      `이 페이지에서는 실행할 수 없습니다. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    setBusy(false);
  }
}

function renderScan(response: ScanResponse): void {
  if (response.fields.length === 0) {
    el.report.innerHTML = `<div class="report-head"><div>폼 스캔</div><span>입력란 없음</span></div>
      <ul class="warnings"><li>현재 화면에서 입력란을 찾지 못했습니다. 상품 등록 화면인지 확인하세요.</li></ul>`;
    return;
  }
  el.report.innerHTML = `
    <div class="report-head">
      <div>폼 스캔</div>
      <span>${response.fields.length}개 입력란</span>
    </div>
    <ul>
      ${response.fields
        .map(
          (field) => `<li>
            <span class="name">${escapeHtml(field.label || "(라벨 없음)")}${
              field.name ? `<span class="detail">name=${escapeHtml(field.name)}</span>` : ""
            }</span>
            <span class="badge ${field.key ? "matched" : "manual"}">${
              field.key ? escapeHtml(field.key) : escapeHtml(field.kind)
            }</span>
          </li>`
        )
        .join("")}
    </ul>
    ${response.warning ? `<ul class="warnings"><li>${escapeHtml(response.warning)}</li></ul>` : ""}`;
}

async function runScan(): Promise<void> {
  if (busy) return;
  const tab = await activeTab();
  if (!tab?.id) {
    setStatus("활성 탭을 찾지 못했습니다.");
    return;
  }
  setBusy(true);
  setStatus("폼을 스캔하는 중…");
  try {
    const response = await sendToTab<ScanResponse>(tab.id, { type: "SCAN" });
    if (!response.ok) {
      setStatus("스캔에 실패했습니다.");
      return;
    }
    renderScan(response);
    setStatus("스캔 완료.");
  } catch (error) {
    setStatus(
      `이 페이지에서는 스캔할 수 없습니다. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    setBusy(false);
  }
}

async function openCreatePage(): Promise<void> {
  const adapter = selectedAdapter();
  if (!adapter) return;
  await chrome.tabs.create({ url: adapter.createUrl });
}

async function downloadJson(): Promise<void> {
  if (!loadFromTextarea()) return;
  const blob = new Blob([productToJson(product)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "product.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function init(): Promise<void> {
  el.version.textContent = `v${chrome.runtime.getManifest().version}`;
  await restoreDraft();

  const tab = await activeTab();
  const detected = tab?.url ? detectMarketplace(tab.url) : undefined;
  renderMarkets(detected?.id);
  if (detected && tab?.id) {
    try {
      const pong = await sendToTab<PingResponse>(tab.id, { type: "PING" });
      el.detected.textContent = `${detected.sellerCenter} · ${
        detected.verified ? "셀렉터 검증됨" : "셀렉터 미검증"
      }${pong.adapterId ? "" : " · 페이지 새로고침 필요"}`;
    } catch {
      el.detected.textContent = `${detected.sellerCenter} · 페이지 새로고침 필요`;
    }
  }

  el.market.addEventListener("change", async () => {
    renderDetected();
    await chrome.storage.local.set({ "draft:market": el.market.value });
  });
  el.json.addEventListener("input", () => {
    void saveDraft();
  });
  el.load.addEventListener("click", loadFromTextarea);
  el.sample.addEventListener("click", () => {
    product = sampleProduct();
    el.json.value = productToJson(product);
    renderIssues();
    void saveDraft();
  });
  el.prefill.addEventListener("click", () => void runPrefill());
  el.scan.addEventListener("click", () => void runScan());
  el.open.addEventListener("click", () => void openCreatePage());
  el.download.addEventListener("click", () => void downloadJson());

  const savedMarket = await chrome.storage.local.get("draft:market");
  const market = savedMarket["draft:market"];
  if (typeof market === "string" && getAdapter(market as MarketId) && !detected) {
    el.market.value = market;
    renderDetected();
  }
}

void init();
