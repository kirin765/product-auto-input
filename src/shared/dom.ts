import { FIELD_LABELS, labelScore, normalizeLabel, type FieldKey } from "./labels";
import type { FieldSpec } from "../adapters/types";
import type { ScanField } from "./messages";

export const CONTROL_SELECTOR = [
  "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset])",
  "textarea",
  "select",
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[contenteditable="plaintext-only"]'
].join(",");

const TEXT_INPUT_TYPES = new Set([
  "text",
  "tel",
  "number",
  "email",
  "search",
  "url",
  "date",
  "datetime-local",
  "month",
  "week",
  "time"
]);

export function isVisible(element: Element): boolean {
  if ((element as HTMLElement).hidden || element.getAttribute("aria-hidden") === "true") {
    return false;
  }

  const check = (
    element as Element & { checkVisibility?: (options?: object) => boolean }
  ).checkVisibility;
  if (typeof check === "function") {
    // 조상이 visibility:hidden이어도 자손이 visible이면 보이는 것으로 판정한다.
    return check.call(element, { checkVisibilityCSS: true, checkOpacity: false });
  }

  // jsdom 등 checkVisibility가 없는 환경용 폴백.
  const view = element.ownerDocument?.defaultView;
  let node: Element | null = element;
  while (node) {
    if (
      (node as HTMLElement).hidden ||
      node.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }
    const style = view?.getComputedStyle(node);
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    node = node.parentElement;
  }
  return true;
}

/**
 * 페이지 본문과 같은 출처인 iframe 문서를 안쪽부터 수집한다.
 * 11번가처럼 등록 폼 전체가 iframe 안에 렌더링되는 마켓에서 사용한다.
 */
export function sameOriginDocuments(root: Document): Document[] {
  const documents: Document[] = [];
  const visit = (doc: Document, depth: number): void => {
    if (depth > 3 || documents.includes(doc)) return;
    documents.push(doc);
    for (const frame of Array.from(doc.querySelectorAll("iframe"))) {
      try {
        const child = frame.contentDocument;
        if (child) visit(child, depth + 1);
      } catch {
        // 교차 출처 iframe은 건너뛴다.
      }
    }
  };
  visit(root, 0);
  return documents;
}

function frameIsVisible(doc: Document): boolean {
  let frame = doc.defaultView?.frameElement;
  while (frame) {
    if (!isVisible(frame)) return false;
    frame = frame.ownerDocument.defaultView?.frameElement;
  }
  return true;
}

function controlCounts(doc: Document): { visible: number; total: number } {
  const frameVisible = frameIsVisible(doc);
  let visible = 0;
  let total = 0;
  for (const element of Array.from(doc.querySelectorAll(CONTROL_SELECTOR))) {
    total++;
    if (frameVisible && isVisible(element)) visible++;
  }
  return { visible, total };
}

/**
 * 등록 폼이 같은 출처 iframe에 있는 마켓에서 실제 폼 문서를 고른다.
 * 보이는 컨트롤을 우선하되, 숨겨진 iframe이라도 폼 크기의 입력란 묶음을
 * 가지고 있으면 후보로 인정한다(접힌/숨겨진 폼도 입력 대상).
 */
export function selectFormDocument(root: Document): Document {
  const score = (doc: Document): number => {
    const counts = controlCounts(doc);
    return counts.visible + (counts.total - counts.visible) * 0.1;
  };

  let best = root;
  let bestScore = score(root);
  for (const doc of sameOriginDocuments(root)) {
    if (doc === root) continue;
    const candidate = score(doc);
    if (candidate > bestScore) {
      best = doc;
      bestScore = candidate;
    }
  }
  return best;
}


export interface ExpandOptions {
  selectors: string[];
  include?: RegExp;
  exclude?: RegExp;
  waitMs?: number;
  settleMs?: number;
}

function sectionTitle(element: Element): string {
  const previous = element.previousElementSibling?.textContent;
  const panel = element.closest(".box__panel, .form-section, section, fieldset");
  const heading = panel?.querySelector(
    ".box__panel-head, .title-line, h2, h3, h4, .box__title"
  );
  return (previous ?? heading?.textContent ?? element.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * 접힌 섹션을 펼친다. ESM Plus의 `.is-fold`처럼 명시적인 접힘 표시가 있으면
 * 그것을 기준으로 하고, 없으면 섹션 안에 보이는 입력란이 없는 경우에만 클릭한다.
 * 이미 열린 섹션을 닫거나 저장/제출 버튼을 누르지 않는다.
 */
export async function expandSections(
  root: Document | HTMLElement,
  options: ExpandOptions
): Promise<string[]> {
  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const actions: string[] = [];
  for (const selector of options.selectors) {
    for (const element of Array.from(root.querySelectorAll(selector))) {
      if (!isVisible(element)) continue;
      const title = sectionTitle(element);
      if (options.include && !options.include.test(title)) continue;
      if (options.exclude && options.exclude.test(title)) continue;

      const container = element.closest(".box__panel, .form-section, section, fieldset");
      const explicitlyCollapsed = container?.classList.contains("is-fold") === true;
      if (!explicitlyCollapsed && container) {
        const hasVisibleControl = Array.from(
          container.querySelectorAll(CONTROL_SELECTOR)
        ).some(isVisible);
        if (hasVisibleControl) continue;
      }

      try {
        (element as HTMLElement).click();
      } catch {
        continue;
      }
      actions.push(`섹션 펼침: ${title || "이름 없음"}`);
      await wait(options.waitMs ?? 200);
    }
  }
  await wait(options.settleMs ?? 400);
  return actions;
}

export function controlKind(element: Element): ScanField["kind"] {
  const tag = element.tagName;
  if (tag === "TEXTAREA") return "textarea";
  if (tag === "SELECT") return "select";
  if (tag === "INPUT") {
    const type = (element as HTMLInputElement).type;
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    if (type === "file") return "file";
    if (type === "password") return "password";
    return "text";
  }
  return "contenteditable";
}

export function labelTexts(element: Element): string[] {
  const texts: string[] = [];
  const push = (value: string | null | undefined) => {
    const text = value?.trim();
    if (text && !texts.includes(text)) texts.push(text);
  };

  push(element.getAttribute("aria-label"));
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      push(element.ownerDocument.getElementById(id)?.textContent);
    }
  }
  push(element.getAttribute("placeholder"));
  push(element.getAttribute("title"));

  const labelable = element as HTMLInputElement;
  if (labelable.labels) {
    for (const label of labelable.labels) push(label.textContent);
  }
  const wrappingLabel = element.closest("label");
  if (wrappingLabel) push(wrappingLabel.textContent);

  const row = element.closest("tr, li, dl, fieldset, .row, .form-group, .field");
  if (row && (row.textContent?.length ?? 0) <= 80) push(row.textContent);

  // 11번가 등 .b-box__row 구조에서는 입력란과 라벨이 형제가 아니라
  // 상위 섹션 제목(.b-box__title)에 라벨이 있다.
  const section = element.closest(".b-box__row");
  const sectionTitle = section?.querySelector(":scope > .b-box__title");
  push(sectionTitle?.textContent);

  // ESM Plus(item.esmplus.com)는 .box__filter-item 헤더에 필드 라벨이 있다.
  const filterItem = element.closest(".box__filter-item");
  const filterTitle = filterItem?.querySelector(":scope > .box__filter-head .text");
  push(filterTitle?.textContent);

  // id/name은 사람이 읽는 라벨이 아니므로 섹션 헤더 사용 여부 판단에서 제외한다.
  const hasMeaningfulLabel = texts.some(isMeaningfulLabel);
  push(element.id?.replace(/[_-]+/g, " "));
  push(element.getAttribute("name")?.replace(/[_-]+/g, " "));

  // 바깥 섹션 헤더("상품명")는 그 안의 여러 입력란(상품명·홍보문구)에 모두 걸리므로
  // 입력란 자체에 쓸 만한 라벨이 없을 때만 보조 라벨로 사용한다.
  if (!hasMeaningfulLabel) {
    let box = element.parentElement?.closest(".b-box, .b-box-sub") ?? null;
    while (box) {
      const header = box.querySelector(
        ":scope > .b-box__header, :scope > .b-box-sub__header, :scope > .b-box__title, :scope > .b-box-sub__title"
      );
      const text = header?.textContent?.trim();
      if (text) {
        push(text);
        break;
      }
      box = box.parentElement?.closest(".b-box, .b-box-sub") ?? null;
    }
  }

  return texts;
}

function isMeaningfulLabel(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .replace(/필수입력|필수|도움말|상품등록|입력|선택|접기|html/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
  return normalized.length >= 2;
}

export interface LocatedControl {
  element: Element;
  score: number;
  label: string;
}

export function isEditableElement(element: Element): boolean {
  const value = element.getAttribute("contenteditable");
  return value === "true" || value === "" || value === "plaintext-only";
}

/**
 * 어댑터의 `kind`는 "이 필드에 어떤 UI가 쓰일 것 같다"는 힌트다.
 * 실제 마켓은 같은 필드를 어떤 곳은 input, 어떤 곳은 select/radio로 렌더링하므로
 * 값 입력이 가능한 컨트롤은 종류를 넘나들어 매칭한다.
 */
export function matchesKind(kind: FieldSpec["kind"], element: Element): boolean {
  const tag = element.tagName;
  const inputType = tag === "INPUT" ? (element as HTMLInputElement).type : "";
  const textInput = tag === "INPUT" && TEXT_INPUT_TYPES.has(inputType);
  const valueControl =
    textInput || tag === "TEXTAREA" || tag === "SELECT" || isEditableElement(element);

  switch (kind) {
    case "text":
    case "textarea":
    case "contenteditable":
      return valueControl;
    case "select":
    case "radio":
      return tag === "SELECT" || (tag === "INPUT" && inputType === "radio");
    case "checkbox":
      return tag === "INPUT" && inputType === "checkbox";
    case "file":
      return tag === "INPUT" && inputType === "file";
    case "manual":
      return false;
  }
}

/**
 * 검색 필드에 상품명을 덮어쓰면 목록이 필터링되므로 자동 입력에서 제외한다.
 */
export function isSearchControl(element: Element): boolean {
  if (element.tagName === "INPUT" && (element as HTMLInputElement).type === "search") {
    return true;
  }
  const placeholder = element.getAttribute("placeholder") ?? "";
  if (/검색/.test(placeholder)) return true;
  return Boolean(
    element.closest(
      '[role="search"], .filter-box, form[action*="search" i], header, nav, aside, ' +
        '[id*="help-center" i], [class*="help-center" i]'
    )
  );
}

/**
 * 필드에 해당하는 입력란을 모두 찾는다.
 * 접힌 섹션이나 비활성 탭 안의 입력란도 값은 넣을 수 있으므로 포함하되,
 * 보이는 입력란을 항상 앞에 둔다.
 */
export function findControls(
  root: Document | HTMLElement,
  spec: FieldSpec
): LocatedControl[] {
  const visibility = new Map<Element, boolean>();
  const visible = (element: Element): boolean => {
    const cached = visibility.get(element);
    if (cached !== undefined) return cached;
    const value = isVisible(element);
    visibility.set(element, value);
    return value;
  };
  const sortVisibleFirst = (a: LocatedControl, b: LocatedControl): number =>
    Number(visible(b.element)) - Number(visible(a.element));

  const selectors = spec.selectors ?? [];
  if (selectors.length > 0) {
    const seen = new Set<Element>();
    const located: LocatedControl[] = [];
    for (const selector of selectors) {
      for (const found of Array.from(root.querySelectorAll(selector))) {
        if (seen.has(found)) continue;
        seen.add(found);
        located.push({
          element: found,
          score: 1,
          label: labelTexts(found)[0] ?? spec.key
        });
      }
    }
    if (located.length > 0) return located.sort(sortVisibleFirst);
  }

  const aliases = spec.labels ?? FIELD_LABELS[spec.key];
  const located: LocatedControl[] = [];

  for (const element of Array.from(root.querySelectorAll(CONTROL_SELECTOR))) {
    if (!matchesKind(spec.kind, element)) continue;
    if (isSearchControl(element)) continue;

    let score = 0;
    let label = "";
    for (const text of labelTexts(element)) {
      const candidate = labelScore(text, aliases);
      if (candidate > score) {
        score = candidate;
        label = text.slice(0, 60);
      }
    }
    if (score >= 0.6) {
      located.push({ element, score, label });
    }
  }

  return located.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return sortVisibleFirst(a, b);
  });
}

export function findControl(
  root: Document | HTMLElement,
  spec: FieldSpec
): LocatedControl | undefined {
  return findControls(root, spec)[0];
}

export function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  const view = element.ownerDocument.defaultView;
  const prototype =
    element.tagName === "TEXTAREA"
      ? view?.HTMLTextAreaElement?.prototype
      : view?.HTMLInputElement?.prototype;
  const setter = prototype && Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function setSelectValue(select: HTMLSelectElement, value: string): boolean {
  const target = normalizeLabel(value);
  const option = Array.from(select.options).find((candidate) => {
    const optionValue = normalizeLabel(candidate.value);
    const optionText = normalizeLabel(candidate.text);
    return (
      optionValue === target ||
      optionText === target ||
      optionText.includes(target) ||
      target.includes(optionText)
    );
  });
  if (!option) return false;
  select.value = option.value;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export function setContentEditable(element: HTMLElement, value: string): void {
  element.focus();
  element.textContent = value;
  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.blur();
}

export function setCheckbox(element: HTMLInputElement, checked: boolean): void {
  if (element.checked === checked) return;
  element.click();
}

export function findByText(
  root: Document | HTMLElement,
  value: string
): HTMLElement | undefined {
  const target = normalizeLabel(value);
  if (!target) return undefined;
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(
      'input[type=radio], input[type=checkbox], option, button, [role=radio], [role=option], label, li'
    )
  );

  const ranked = candidates
    .map((element) => {
      const texts = [element.textContent, element.getAttribute("value"), element.getAttribute("aria-label")]
        .filter((item): item is string => Boolean(item))
        .map(normalizeLabel);
      const exact = texts.some((text) => text === target);
      const partial = texts.some((text) => text.includes(target));
      // 숨겨진 탭의 선택지도 사용하지만, 보이는 선택지를 우선한다.
      const score = (exact ? 1 : partial ? 0.7 : 0) - (isVisible(element) ? 0 : 0.35);
      return { element, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.element;
}

const CHOICE_SYNONYMS: Record<string, string[]> = {
  새상품: ["새상품", "신상품", "신품"],
  신상품: ["신상품", "새상품"],
  중고: ["중고", "중고상품"],
  중고상품: ["중고상품", "중고"],
  리퍼비시: ["리퍼비시", "리퍼"],
  리퍼: ["리퍼", "리퍼비시"]
};

function choiceCandidates(value: string): string[] {
  return CHOICE_SYNONYMS[value] ?? [value];
}

export function selectChoice(
  root: Document | HTMLElement,
  spec: FieldSpec,
  value: string | boolean
): boolean {
  const located = findControl(root, spec);
  if (value === true) {
    const el = located?.element as HTMLInputElement | undefined;
    const checkbox =
      el?.tagName === "INPUT" && el.type === "checkbox" ? el : undefined;
    if (!checkbox) return false;
    setCheckbox(checkbox, true);
    return true;
  }
  if (value === false) return true;

  if (located?.element.tagName === "SELECT") {
    for (const candidate of choiceCandidates(value)) {
      if (setSelectValue(located.element as HTMLSelectElement, candidate)) return true;
    }
    return false;
  }

  let target: HTMLElement | undefined;
  for (const candidate of choiceCandidates(value)) {
    target = findByText(root, candidate);
    if (target) break;
  }
  if (!target) return false;
  if (target.tagName === "INPUT") {
    const input = target as HTMLInputElement;
    if (!input.checked) input.click();
  } else {
    target.click();
  }
  return true;
}

export async function uploadFromUrls(
  input: HTMLInputElement,
  urls: string[]
): Promise<{ uploaded: string[]; failed: string[] }> {
  const uploaded: string[] = [];
  const failed: string[] = [];
  const files: File[] = [];

  for (const url of urls) {
    try {
      const response = await fetch(url, { credentials: "omit", mode: "cors" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const extension = blob.type.split("/")[1]?.split("+")[0] || "jpg";
      const name = `product-${files.length + 1}.${extension}`;
      files.push(new File([blob], name, { type: blob.type || "image/jpeg" }));
      uploaded.push(url);
    } catch {
      failed.push(url);
    }
  }

  if (files.length > 0) {
    const view = input.ownerDocument.defaultView;
    const DataTransferCtor = view?.DataTransfer ?? DataTransfer;
    const transfer = new DataTransferCtor();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return { uploaded, failed };
}

export function scanFields(root: Document | HTMLElement, limit = 80): ScanField[] {
  const fields: ScanField[] = [];
  for (const element of Array.from(root.querySelectorAll(CONTROL_SELECTOR))) {
    if (!isVisible(element)) continue;
    const texts = labelTexts(element);
    const label = texts[0] ?? "";
    let key: FieldKey | undefined;
    let best = 0.6;
    for (const text of texts) {
      for (const [candidateKey, aliases] of Object.entries(FIELD_LABELS) as [FieldKey, string[]][]) {
        const score = labelScore(text, aliases);
        if (score > best) {
          best = score;
          key = candidateKey;
        }
      }
    }
    fields.push({
      label,
      ...(key ? { key } : {}),
      kind: controlKind(element),
      ...(element.getAttribute("name") ? { name: element.getAttribute("name") as string } : {}),
      ...(element.id ? { id: element.id } : {}),
      required:
        element.hasAttribute("required") ||
        element.getAttribute("aria-required") === "true" ||
        /[*＊]/.test(label)
    });
    if (fields.length >= limit) break;
  }
  return fields;
}
