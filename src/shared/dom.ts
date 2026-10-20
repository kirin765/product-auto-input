import { FIELD_LABELS, labelScore, normalizeLabel, type FieldKey } from "./labels";
import type { FieldSpec } from "../adapters/types";
import type { ScanField } from "./messages";

export const CONTROL_SELECTOR = [
  "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset])",
  "textarea",
  "select",
  '[contenteditable="true"]',
  '[contenteditable=""]'
].join(",");

export function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return true;
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  const view = element.ownerDocument.defaultView;
  const style = view?.getComputedStyle(element);
  if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  return true;
}

export function controlKind(element: Element): ScanField["kind"] {
  if (element instanceof HTMLTextAreaElement) return "textarea";
  if (element instanceof HTMLSelectElement) return "select";
  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox") return "checkbox";
    if (element.type === "radio") return "radio";
    if (element.type === "file") return "file";
    if (element.type === "password") return "password";
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

  push(element.id?.replace(/[_-]+/g, " "));
  push(element.getAttribute("name")?.replace(/[_-]+/g, " "));
  return texts;
}

export interface LocatedControl {
  element: Element;
  score: number;
  label: string;
}

export function findControl(
  root: Document | HTMLElement,
  spec: FieldSpec
): LocatedControl | undefined {
  for (const selector of spec.selectors ?? []) {
    const found = root.querySelector(selector);
    if (found && isVisible(found)) {
      return { element: found, score: 1, label: labelTexts(found)[0] ?? spec.key };
    }
  }

  const aliases = spec.labels ?? FIELD_LABELS[spec.key];
  const controls = Array.from(root.querySelectorAll(CONTROL_SELECTOR)).filter(isVisible);
  let best: LocatedControl | undefined;

  for (const element of controls) {
    if (spec.kind === "file" && !(element instanceof HTMLInputElement && element.type === "file")) {
      continue;
    }
    if (spec.kind === "radio" && !(element instanceof HTMLInputElement && element.type === "radio")) {
      continue;
    }
    if (spec.kind === "checkbox" && !(element instanceof HTMLInputElement && element.type === "checkbox")) {
      continue;
    }
    if (spec.kind === "select" && !(element instanceof HTMLSelectElement)) continue;
    if (spec.kind === "textarea" && !(element instanceof HTMLTextAreaElement)) continue;

    let score = 0;
    let label = "";
    for (const text of labelTexts(element)) {
      const candidate = labelScore(text, aliases);
      if (candidate > score) {
        score = candidate;
        label = text.slice(0, 60);
      }
    }
    if (score >= 0.6 && (!best || score > best.score)) {
      best = { element, score, label };
    }
  }
  return best;
}

export function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
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
  ).filter(isVisible);

  const ranked = candidates
    .map((element) => {
      const texts = [element.textContent, element.getAttribute("value"), element.getAttribute("aria-label")]
        .filter((item): item is string => Boolean(item))
        .map(normalizeLabel);
      const exact = texts.some((text) => text === target);
      const partial = texts.some((text) => text.includes(target));
      return { element, score: exact ? 1 : partial ? 0.7 : 0 };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.element;
}

export function selectChoice(
  root: Document | HTMLElement,
  spec: FieldSpec,
  value: string | boolean
): boolean {
  const located = findControl(root, spec);
  if (value === true) {
    const checkbox =
      located?.element instanceof HTMLInputElement && located.element.type === "checkbox"
        ? located.element
        : undefined;
    if (!checkbox) return false;
    setCheckbox(checkbox, true);
    return true;
  }
  if (value === false) return true;

  if (located?.element instanceof HTMLSelectElement) {
    return setSelectValue(located.element, value);
  }

  const target = findByText(root, value);
  if (!target) return false;
  if (target instanceof HTMLInputElement) {
    if (!target.checked) target.click();
  } else if (target instanceof HTMLLabelElement) {
    target.click();
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
    const transfer = new DataTransfer();
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
