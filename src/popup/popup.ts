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
import { parseCsv } from "../shared/csv";
import { readXlsxRows } from "../shared/xlsx";
import {
  TEMPLATE_COLUMNS,
  parseTemplateRows,
  parseTemplateValues,
  pathToColumn,
  templateCsv,
  templateXlsx,
  type TemplateIssue,
  type TemplateResult
} from "../shared/template";
import type { MarketId } from "../shared/product";
import {
  disconnect,
  getAccount,
  getCachedEntitlement,
  redeemLink,
  refreshEntitlement,
  startCheckout,
  startLink,
  startPortal,
  type AccountState
} from "../shared/account";
import { ACCOUNT_PAGE, PRICING_PAGE } from "../shared/config";
import { localPaidAccess, shouldRefresh, type CachedEntitlement } from "../shared/entitlement";
import {
  canFill,
  loadDailyUsage,
  recordFill,
  remainingFills,
  type DailyFillUsage
} from "../shared/usage";
import { FREE_DAILY_FILLS } from "../../shared/schema";

const DRAFT_KEY = "draft:product";

const el = {
  market: document.getElementById("market") as HTMLSelectElement,
  detected: document.getElementById("detected") as HTMLParagraphElement,
  steps: document.getElementById("steps") as HTMLDivElement,
  json: document.getElementById("json") as HTMLTextAreaElement,
  issues: document.getElementById("issues") as HTMLDivElement,
  prefill: document.getElementById("prefill") as HTMLButtonElement,
  scan: document.getElementById("scan") as HTMLButtonElement,
  open: document.getElementById("open") as HTMLButtonElement,
  sample: document.getElementById("sample") as HTMLButtonElement,
  load: document.getElementById("load") as HTMLButtonElement,
  download: document.getElementById("download") as HTMLButtonElement,
  file: document.getElementById("file") as HTMLInputElement,
  fileName: document.getElementById("file-name") as HTMLSpanElement,
  templateCsv: document.getElementById("template-csv") as HTMLButtonElement,
  templateXlsx: document.getElementById("template-xlsx") as HTMLButtonElement,
  fixes: document.getElementById("fixes") as HTMLDivElement,
  status: document.getElementById("status") as HTMLSpanElement,
  report: document.getElementById("report") as HTMLDivElement,
  version: document.getElementById("version") as HTMLSpanElement,
  acctStatus: document.getElementById("acct-status") as HTMLSpanElement,
  acctBadge: document.getElementById("acct-badge") as HTMLSpanElement,
  acctUsage: document.getElementById("acct-usage") as HTMLParagraphElement,
  acctHint: document.getElementById("acct-hint") as HTMLParagraphElement,
  connect: document.getElementById("btn-connect") as HTMLButtonElement,
  confirm: document.getElementById("btn-confirm") as HTMLButtonElement,
  upgrade: document.getElementById("btn-upgrade") as HTMLButtonElement,
  manage: document.getElementById("btn-manage") as HTMLButtonElement,
  acctDisconnect: document.getElementById("btn-disconnect") as HTMLButtonElement,
  paywall: document.getElementById("paywall") as HTMLElement,
  paywallText: document.getElementById("paywall-text") as HTMLParagraphElement,
  paywallUpgrade: document.getElementById("paywall-upgrade") as HTMLButtonElement
};

let product: CanonicalProduct = sampleProduct();
let busy = false;
let hasBlockingErrors = false;
let fileError: string | null = null;
let template: TemplateResult | undefined;
let templateMetaIssues: TemplateIssue[] = [];
let account: AccountState | null = null;
let entitlementCache: CachedEntitlement | null = null;
let dailyUsage: DailyFillUsage | null = null;
let accountBusy = false;

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
  el.prefill.disabled = value || hasBlockingErrors;
  el.scan.disabled = value;
}

function openTab(url: string): void {
  void chrome.tabs.create({ url });
}

function isPaid(): boolean {
  return localPaidAccess(entitlementCache).active;
}

function toggleButton(button: HTMLButtonElement, visible: boolean): void {
  button.classList.toggle("hidden", !visible);
}

function updateAccountUI(): void {
  const state = account;
  if (!state) return;
  const paid = isPaid();
  const freeLimitReached = !paid && dailyUsage != null && !canFill(dailyUsage, "free");
  const remaining = dailyUsage ? remainingFills(dailyUsage, paid ? "paid" : "free") : null;

  el.acctBadge.classList.remove("hidden", "free", "paid");
  el.acctBadge.classList.add(paid ? "paid" : "free");
  el.acctBadge.textContent = paid ? "이용 중" : "무료";

  if (state.connected) {
    el.acctStatus.textContent = state.email ?? "계정 연결됨";
    el.acctUsage.textContent = paid
      ? "구독 이용 중 · 폼 채우기 횟수 제한 없음"
      : dailyUsage
        ? `오늘 무료 ${dailyUsage.count}/${FREE_DAILY_FILLS}회 사용 · ${remaining}회 남음`
        : "";
    el.acctHint.textContent = paid
      ? "구독이 확인되었습니다. 폼 채우기를 횟수 제한 없이 사용할 수 있습니다."
      : `무료는 하루 ${FREE_DAILY_FILLS}회까지 폼을 채울 수 있습니다.`;
  } else if (state.pending) {
    el.acctStatus.textContent = "연결 승인 대기 중";
    el.acctUsage.textContent = dailyUsage
      ? `오늘 무료 ${dailyUsage.count}/${FREE_DAILY_FILLS}회 사용 · ${remaining}회 남음`
      : "";
    el.acctHint.textContent =
      "제품 사이트에서 로그인 후 연결을 승인하고, 여기서 ‘승인 확인’을 눌러 주세요.";
  } else {
    el.acctStatus.textContent = "제품 계정 미연결";
    el.acctUsage.textContent = dailyUsage
      ? `오늘 무료 ${dailyUsage.count}/${FREE_DAILY_FILLS}회 사용 · ${remaining}회 남음`
      : "";
    el.acctHint.textContent = "계정 연결 없이도 무료 한도까지 사용할 수 있습니다. 구독에는 계정 연결이 필요합니다.";
  }

  toggleButton(el.connect, !state.connected && !state.pending);
  toggleButton(el.confirm, state.pending);
  toggleButton(el.upgrade, state.connected && !paid);
  toggleButton(el.manage, state.connected && paid);
  toggleButton(el.acctDisconnect, state.connected || state.pending);

  el.paywall.classList.toggle("hidden", !freeLimitReached);
  if (freeLimitReached) {
    el.paywallText.textContent = `오늘 무료 ${FREE_DAILY_FILLS}회를 모두 사용했습니다. 구독하면 횟수 제한 없이 폼을 채울 수 있습니다.`;
  }
}

async function refreshAccount(): Promise<void> {
  account = await getAccount();
  if (account.connected && shouldRefresh(entitlementCache)) {
    entitlementCache = (await refreshEntitlement()) ?? entitlementCache;
  } else if (!account.connected) {
    entitlementCache = await getCachedEntitlement();
  }
  if (dailyUsage == null) dailyUsage = await loadDailyUsage();
  updateAccountUI();
}

async function connectAccount(): Promise<void> {
  if (accountBusy) return;
  accountBusy = true;
  try {
    const { verificationUrl } = await startLink();
    openTab(verificationUrl);
    account = await getAccount();
    updateAccountUI();
    setStatus("브라우저에서 계정 연결을 승인한 뒤 ‘승인 확인’을 누르세요.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "계정 연결을 시작하지 못했습니다.");
  } finally {
    accountBusy = false;
  }
}

async function confirmAccount(): Promise<void> {
  if (accountBusy) return;
  accountBusy = true;
  try {
    await redeemLink();
    await refreshAccount();
    setStatus("계정이 연결되었습니다.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "계정 연결을 확인하지 못했습니다.");
  } finally {
    accountBusy = false;
  }
}

async function upgradePlan(): Promise<void> {
  if (accountBusy) return;
  if (!account?.connected) {
    await connectAccount();
    return;
  }
  accountBusy = true;
  try {
    const url = await startCheckout();
    openTab(url ?? PRICING_PAGE);
  } catch {
    openTab(PRICING_PAGE);
  } finally {
    accountBusy = false;
  }
}

async function manageSubscription(): Promise<void> {
  if (accountBusy) return;
  accountBusy = true;
  try {
    const url = await startPortal();
    openTab(url ?? ACCOUNT_PAGE);
  } catch {
    openTab(ACCOUNT_PAGE);
  } finally {
    accountBusy = false;
  }
}

async function disconnectAccount(): Promise<void> {
  if (accountBusy) return;
  accountBusy = true;
  try {
    await disconnect();
    entitlementCache = null;
    account = await getAccount();
    updateAccountUI();
    setStatus("계정 연결을 해제했습니다.");
  } finally {
    accountBusy = false;
  }
}

function clearTemplate(): void {
  template = undefined;
  templateMetaIssues = [];
  fileError = null;
  el.fileName.textContent = "";
  el.fixes.innerHTML = "";
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
  const steps = adapter.steps ? ` · ${adapter.steps.length}단계` : "";
  el.detected.textContent = `${adapter.sellerCenter} · ${verified}${steps}`;
  el.detected.title = [
    ...adapter.requirements,
    ...(adapter.steps ? ["단계:", ...adapter.steps] : []),
    ...adapter.notes
  ].join("\n");
  el.steps.innerHTML = adapter.steps
    ? `<strong>진행 단계</strong><ol>${adapter.steps
        .map((step) => `<li>${escapeHtml(step.replace(/^\d+\.\s*/, ""))}</li>`)
        .join("")}</ol>`
    : "";
}

function renderIssues(): void {
  if (fileError) {
    hasBlockingErrors = true;
    el.prefill.disabled = true;
    el.fixes.innerHTML = "";
    el.issues.className = "issues error";
    el.issues.textContent = fileError;
    return;
  }

  const result = validateProduct(product);
  const templateIssues = template ? [...templateMetaIssues, ...template.issues] : [];
  const templateErrors = templateIssues.filter((issue) => issue.severity === "error");
  const templateWarnings = templateIssues.filter((issue) => issue.severity === "warning");
  const errors = [...templateErrors, ...result.errors];
  const warnings = [...templateWarnings, ...result.warnings];
  hasBlockingErrors = errors.length > 0;
  el.prefill.disabled = busy || hasBlockingErrors;

  const messages = [...errors, ...warnings]
    .map((issue) =>
      "column" in issue && issue.column
        ? `[${issue.column}] ${issue.message}`
        : issue.message
    )
    .filter((message, index, all) => all.indexOf(message) === index);

  if (messages.length === 0) {
    el.issues.className = "issues ok";
    el.issues.textContent = "필수 항목이 모두 채워졌습니다.";
    el.fixes.innerHTML = "";
    return;
  }
  el.issues.className = errors.length > 0 ? "issues error" : "issues warn";
  el.issues.innerHTML = `<strong>${
    errors.length > 0 ? `오류 ${errors.length}건` : `확인 ${warnings.length}건`
  }</strong><ul>${messages
    .slice(0, 8)
    .map((message) => `<li>${escapeHtml(message)}</li>`)
    .join("")}</ul>`;

  renderFixes(result.errors, templateErrors);
}

function renderFixes(errors: ValidationIssue[], templateErrors: TemplateIssue[]): void {
  if (!template) {
    el.fixes.innerHTML = "";
    return;
  }
  const columns = new Set<string>();
  for (const issue of templateErrors) {
    if (issue.column) columns.add(issue.column);
  }
  for (const issue of errors) {
    const column = pathToColumn(issue.path);
    if (column) columns.add(column);
  }

  const fields = [...columns]
    .map((header) => {
      const column = TEMPLATE_COLUMNS.find((item) => item.header === header);
      if (!column) return "";
      const value = template?.values[header] ?? "";
      const control =
        column.kind === "longText" || column.kind === "imageList"
          ? `<textarea data-column="${escapeHtml(header)}" rows="2">${escapeHtml(value)}</textarea>`
          : `<input data-column="${escapeHtml(header)}" value="${escapeHtml(value)}" />`;
      return `<div class="fix-row"><label>${escapeHtml(header)}</label>${control}</div>`;
    })
    .join("");

  el.fixes.innerHTML = fields
    ? `<p class="fixes-title">오류 수정 (1개 상품)</p>${fields}`
    : "";

  for (const control of Array.from(
    el.fixes.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")
  )) {
    control.addEventListener("change", () => {
      if (!template) return;
      const column = control.getAttribute("data-column");
      if (!column) return;
      template.values[column] = control.value;
      const next = parseTemplateValues(template.values);
      template = {
        ...next,
        unknownColumns: template.unknownColumns,
        rowCount: template.rowCount
      };
      product = next.product;
      el.json.value = productToJson(product);
      renderIssues();
      void saveDraft();
    });
  }
}

function applyTemplate(result: TemplateResult, fileName: string): void {
  template = result;
  templateMetaIssues = result.issues.filter((issue) => !issue.column);
  fileError = null;
  product = result.product;
  el.json.value = productToJson(product);
  el.fileName.textContent = fileName;
  renderIssues();
  void saveDraft();
  setStatus(
    hasBlockingErrors
      ? "가져왔습니다. 표시된 오류를 수정하세요."
      : "가져오기 완료. 폼 채우기를 실행하세요."
  );
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function loadFromTextarea(): boolean {
  clearTemplate();
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
    // iframe 안의 content script가 아직 준비되지 않았을 수 있어 한 번 더 시도한다.
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      return (await chrome.tabs.sendMessage(tabId, message)) as T;
    } catch {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      return (await chrome.tabs.sendMessage(tabId, message)) as T;
    }
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
  if (hasBlockingErrors) {
    setStatus("오류를 먼저 수정하세요.");
    return;
  }

  await refreshAccount();
  const paid = isPaid();
  dailyUsage = await loadDailyUsage();
  if (!paid && !canFill(dailyUsage, "free")) {
    updateAccountUI();
    setStatus("오늘 무료 이용 횟수를 모두 사용했습니다.");
    return;
  }

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
    const filled = response.report.fields.some((field) => field.status === "filled");
    if (!paid && filled) {
      dailyUsage = await recordFill();
      updateAccountUI();
    }
    setStatus(
      filled ? "확인 후 직접 저장·제출하세요." : "입력된 필드가 없습니다. 등록 화면과 마켓을 확인하세요."
    );
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
  void refreshAccount();

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
  el.load.addEventListener("click", () => {
    if (loadFromTextarea()) setStatus("JSON을 불러왔습니다.");
  });
  el.sample.addEventListener("click", () => {
    clearTemplate();
    product = sampleProduct();
    el.json.value = productToJson(product);
    renderIssues();
    void saveDraft();
  });

  el.templateCsv.addEventListener("click", () => {
    download(
      new Blob([templateCsv()], { type: "text/csv;charset=utf-8" }),
      "상품등록_템플릿.csv"
    );
  });

  el.templateXlsx.addEventListener("click", () => {
    download(
      new Blob([templateXlsx() as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }),
      "상품등록_템플릿.xlsx"
    );
  });

  el.file.addEventListener("change", async () => {
    const file = el.file.files?.[0];
    if (!file) return;
    try {
      const lower = file.name.toLowerCase();
      let rows: string[][];
      if (lower.endsWith(".csv")) {
        rows = parseCsv(await file.text());
      } else if (lower.endsWith(".xlsx")) {
        rows = await readXlsxRows(await file.arrayBuffer());
      } else {
        throw new Error("CSV 또는 XLSX 파일만 지원합니다.");
      }
      applyTemplate(parseTemplateRows(rows), file.name);
    } catch (error) {
      clearTemplate();
      fileError = `파일을 읽을 수 없습니다: ${
        error instanceof Error ? error.message : String(error)
      }`;
      renderIssues();
      setStatus("가져오기 실패");
    } finally {
      el.file.value = "";
    }
  });
  el.prefill.addEventListener("click", () => void runPrefill());
  el.scan.addEventListener("click", () => void runScan());
  el.open.addEventListener("click", () => void openCreatePage());
  el.download.addEventListener("click", () => void downloadJson());
  el.connect.addEventListener("click", () => void connectAccount());
  el.confirm.addEventListener("click", () => void confirmAccount());
  el.upgrade.addEventListener("click", () => void upgradePlan());
  el.paywallUpgrade.addEventListener("click", () => void upgradePlan());
  el.manage.addEventListener("click", () => void manageSubscription());
  el.acctDisconnect.addEventListener("click", () => void disconnectAccount());

  const savedMarket = await chrome.storage.local.get("draft:market");
  const market = savedMarket["draft:market"];
  if (typeof market === "string" && getAdapter(market as MarketId) && !detected) {
    el.market.value = market;
    renderDetected();
  }
}

void init();
