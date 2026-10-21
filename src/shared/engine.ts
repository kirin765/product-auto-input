import type {
  FillOptions,
  FillReport,
  FieldResult,
  MarketplaceAdapter
} from "../adapters/types";
import type { CanonicalProduct } from "./product";
import { FIELD_LABELS, bestFieldKey, normalizeLabel, type FieldKey } from "./labels";
import { formatValue, getFieldValue, type FieldValue } from "./fields";
import {
  CONTROL_SELECTOR,
  controlKind,
  findControls,
  isEditableElement,
  isSearchControl,
  labelTexts,
  selectChoice,
  setContentEditable,
  setNativeValue,
  setSelectValue,
  uploadFromUrls
} from "./dom";

function joinValue(value: FieldValue): string | boolean {
  if (Array.isArray(value)) return value.join(",");
  return value === undefined ? "" : value;
}

function isEmpty(value: FieldValue): boolean {
  return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

function detailFor(located: { label: string }[], count: number): string {
  const first = located[0]?.label ?? "";
  return count > 1 ? `${first} 외 ${count - 1}개` : first;
}

function inferFieldKey(element: Element): FieldKey | undefined {
  for (const text of labelTexts(element)) {
    const key = bestFieldKey(text);
    if (key) return key;
  }
  return undefined;
}

const LABEL_NOISE = /필수입력|필수|도움말|상품등록|입력|선택|하세요|해주세요|접기/g;

/**
 * 같은 필드의 중복 입력란인지 비교하기 위해 라벨에서 안내 문구를 제거한다.
 * "재고수량필수입력재고수량 도움말"과 "재고수량"을 같은 라벨로 본다.
 */
function canonicalLabel(text: string): string {
  let value = normalizeLabel(text).replace(LABEL_NOISE, "");
  const half = value.length / 2;
  if (Number.isInteger(half) && half > 0 && value.slice(0, half) === value.slice(half)) {
    value = value.slice(0, half);
  }
  return value;
}

/**
 * 상품 데이터를 현재 페이지의 등록 폼에 채운다.
 * 어떤 경우에도 저장/제출 버튼을 누르지 않는다 — 마지막 확인과 제출은 판매자 몫이다.
 *
 * 접힌 섹션·비활성 탭처럼 화면에 보이지 않는 입력란도 값은 넣을 수 있으므로
 * 함께 채운다. 단, 보이는 입력란을 우선한다.
 */
export async function prefillProduct(
  product: CanonicalProduct,
  adapter: MarketplaceAdapter,
  options: FillOptions = {}
): Promise<FillReport> {
  const root = options.root ?? document;
  const dryRun = options.dryRun ?? false;
  const fields: FieldResult[] = [];
  const warnings: string[] = [];
  const usedElements = new Set<Element>();

  if (!adapter.verified) {
    warnings.push(
      `${adapter.name} 셀렉터는 아직 실제 판매자 계정으로 검증되지 않았습니다. 자동 입력 후 모든 값을 직접 확인하세요.`
    );
  }

  for (const spec of adapter.fields) {
    const aliases = spec.labels ?? FIELD_LABELS[spec.key];
    const label = aliases[0] ?? spec.key;
    const value = getFieldValue(product, spec.key);

    if (spec.kind === "manual") {
      fields.push({
        key: spec.key,
        label,
        status: "manual",
        ...(spec.note ? { detail: spec.note } : {})
      });
      continue;
    }

    if (isEmpty(value)) {
      fields.push({
        key: spec.key,
        label,
        status: "skipped",
        detail: spec.required ? "값 없음 (필수)" : "값 없음"
      });
      if (spec.required) warnings.push(`필수 항목 "${label}" 값이 비어 있습니다.`);
      continue;
    }

    const allLocated = findControls(root, spec);
    const locatedAll = allLocated.filter((item) => !usedElements.has(item.element));
    if (locatedAll.length === 0) {
      if (allLocated.length > 0) {
        fields.push({
          key: spec.key,
          label,
          status: "manual",
          detail: "이미 다른 항목에서 사용한 입력란입니다."
        });
      } else {
        fields.push({
          key: spec.key,
          label,
          status: "not-found",
          detail: "현재 페이지에서 입력란을 찾지 못했습니다."
        });
        if (spec.required) warnings.push(`필수 항목 "${label}" 입력란을 찾지 못했습니다.`);
      }
      continue;
    }

    if (dryRun) {
      fields.push({
        key: spec.key,
        label,
        status: "matched",
        detail: detailFor(locatedAll, locatedAll.length)
      });
      continue;
    }

    try {
      if (spec.kind === "file" && locatedAll[0].element.tagName === "INPUT") {
        const urls = Array.isArray(value) ? value : [String(value)];
        const input = locatedAll[0].element as HTMLInputElement;
        usedElements.add(input);
        const { uploaded, failed } = await uploadFromUrls(input, urls);
        if (uploaded.length === 0) {
          fields.push({
            key: spec.key,
            label,
            status: "error",
            detail: `이미지를 가져오지 못했습니다 (CORS 또는 URL 확인 필요): ${failed.join(", ")}`
          });
          warnings.push(`"${label}" 이미지를 직접 업로드해야 합니다.`);
        } else {
          fields.push({
            key: spec.key,
            label,
            status: "filled",
            detail: `${uploaded.length}장 업로드${failed.length > 0 ? `, ${failed.length}장 실패` : ""}`
          });
          if (failed.length > 0) warnings.push(`"${label}" ${failed.length}장은 직접 업로드하세요.`);
        }
        continue;
      }

      if (spec.kind === "radio" || spec.kind === "checkbox") {
        const ok = selectChoice(root, spec, joinValue(value));
        if (ok) for (const item of locatedAll) usedElements.add(item.element);
        fields.push({
          key: spec.key,
          label,
          status: ok ? "filled" : "error",
          detail: ok ? locatedAll[0].label : "해당 값을 선택할 수 없습니다."
        });
        if (!ok) warnings.push(`"${label}" 값을 직접 선택하세요.`);
        continue;
      }

      const text = String(joinValue(value));
      const formatted = formatValue(text, spec.format ?? "plain");
      const textTargets = locatedAll.filter((item) => {
        const kind = controlKind(item.element);
        return kind === "text" || kind === "textarea" || isEditableElement(item.element);
      });
      const selectTargets = locatedAll.filter((item) => item.element.tagName === "SELECT");
      const choiceTargets = locatedAll.filter((item) => {
        const kind = controlKind(item.element);
        return kind === "radio" || kind === "checkbox";
      });
      let filledCount = 0;

      // 같은 라벨의 중복 입력란(사이트별·탭별)은 함께 채우되,
      // "추가상품명", "구입 당시 판매가"처럼 다른 의미의 입력란은 건드리지 않는다.
      const reference = textTargets[0] ? canonicalLabel(textTargets[0].label) : "";
      for (const located of textTargets) {
        if (reference && canonicalLabel(located.label) !== reference) continue;
        const element = located.element;
        if (isEditableElement(element)) {
          setContentEditable(element as HTMLElement, text);
        } else {
          setNativeValue(element as HTMLInputElement | HTMLTextAreaElement, formatted);
        }
        usedElements.add(element);
        filledCount++;
      }

      // select는 단계형(원산지 국내 → 지역)일 수 있으므로 같은 라벨의 후보를
      // 순서대로 시도해 값이 맞는 첫 항목만 선택한다.
      const selectReference = canonicalLabel(
        textTargets[0]?.label ?? selectTargets[0]?.label ?? ""
      );
      for (const located of selectTargets) {
        if (selectReference && canonicalLabel(located.label) !== selectReference) continue;
        if (setSelectValue(located.element as HTMLSelectElement, text)) {
          usedElements.add(located.element);
          filledCount++;
          break;
        }
      }

      if (filledCount === 0 && choiceTargets[0]) {
        const kind = controlKind(choiceTargets[0].element) === "checkbox" ? "checkbox" : "radio";
        if (selectChoice(root, { ...spec, kind }, joinValue(value))) {
          for (const item of choiceTargets) usedElements.add(item.element);
          filledCount++;
        }
      }

      fields.push({
        key: spec.key,
        label,
        status: filledCount > 0 ? "filled" : "manual",
        ...(filledCount > 0 ? { detail: detailFor(locatedAll, filledCount) } : {})
      });
    } catch (error) {
      fields.push({
        key: spec.key,
        label,
        status: "error",
        detail: error instanceof Error ? error.message : String(error)
      });
      warnings.push(`"${label}" 자동 입력 중 오류가 발생했습니다.`);
    }
  }

  if (!dryRun) {
    fillUndeclaredFields(product, adapter, root, fields, usedElements);
  }

  return {
    adapterId: adapter.id,
    adapterName: adapter.name,
    url: root instanceof Document ? root.location?.href ?? "" : "",
    startedAt: new Date().toISOString(),
    dryRun,
    submitted: false,
    fields,
    warnings
  };
}

/**
 * 어댑터가 선언하지 않은 필드라도 페이지에 라벨이 같은 입력란이 있으면 채운다.
 * (예: 과세여부 라디오, 마켓이 추가한 배송/원산지 입력란)
 */
function fillUndeclaredFields(
  product: CanonicalProduct,
  adapter: MarketplaceAdapter,
  root: Document | HTMLElement,
  fields: FieldResult[],
  usedElements: Set<Element>
): void {
  const declared = new Set(adapter.fields.map((spec) => spec.key));
  const handledChoice = new Set<FieldKey>();
  const extras = new Map<FieldKey, { label: string; count: number }>();

  const record = (key: FieldKey, element: Element): void => {
    const entry = extras.get(key);
    if (entry) {
      entry.count++;
      return;
    }
    extras.set(key, {
      label: labelTexts(element)[0] ?? FIELD_LABELS[key][0] ?? key,
      count: 1
    });
  };

  for (const element of Array.from(root.querySelectorAll(CONTROL_SELECTOR))) {
    if (usedElements.has(element)) continue;
    const kind = controlKind(element);
    if (kind === "file" || kind === "password") continue;
    if (kind !== "contenteditable" && isSearchControl(element)) continue;

    const key = inferFieldKey(element);
    if (!key || declared.has(key)) continue;

    const value = getFieldValue(product, key);
    if (isEmpty(value) || value === false) continue;

    try {
      if (kind === "radio" || kind === "checkbox") {
        if (handledChoice.has(key)) continue;
        if (selectChoice(root, { key, kind }, joinValue(value))) {
          handledChoice.add(key);
          usedElements.add(element);
          record(key, element);
        }
        continue;
      }

      const text = String(joinValue(value));
      if (kind === "select" && element.tagName === "SELECT") {
        if (setSelectValue(element as HTMLSelectElement, text)) {
          usedElements.add(element);
          record(key, element);
        }
      } else if (kind === "text" || kind === "textarea") {
        setNativeValue(element as HTMLInputElement | HTMLTextAreaElement, text);
        usedElements.add(element);
        record(key, element);
      } else if (kind === "contenteditable") {
        setContentEditable(element as HTMLElement, text);
        usedElements.add(element);
        record(key, element);
      }
    } catch {
      // 선언되지 않은 필드는 실패해도 보고서에 오류를 남기지 않는다.
    }
  }

  for (const [key, extra] of extras) {
    fields.push({
      key,
      label: extra.label,
      status: "filled",
      detail: extra.count > 1 ? `추가 입력란 ${extra.count}개` : "추가 입력란"
    });
  }
}

export function summarizeReport(report: FillReport): string {
  const filled = report.fields.filter((field) => field.status === "filled").length;
  const matched = report.fields.filter((field) => field.status === "matched").length;
  const manual = report.fields.filter((field) => field.status === "manual").length;
  const missing = report.fields.filter(
    (field) => field.status === "not-found" || field.status === "error"
  ).length;
  return `${report.adapterName}: 입력 ${filled}${report.dryRun ? ` / 매칭 ${matched}` : ""}${
    manual ? ` / 수동 ${manual}` : ""
  }${missing ? ` / 실패 ${missing}` : ""}`;
}
