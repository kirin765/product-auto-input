import type {
  FillOptions,
  FillReport,
  FieldResult,
  MarketplaceAdapter
} from "../adapters/types";
import type { CanonicalProduct } from "./product";
import { FIELD_LABELS } from "./labels";
import { formatValue, getFieldValue } from "./fields";
import {
  findControl,
  selectChoice,
  setContentEditable,
  setNativeValue,
  setSelectValue,
  uploadFromUrls
} from "./dom";

function joinValue(value: string | string[] | boolean): string | boolean {
  return Array.isArray(value) ? value.join(",") : value;
}

/**
 * 상품 데이터를 현재 페이지의 등록 폼에 채운다.
 * 어떤 경우에도 저장/제출 버튼을 누르지 않는다 — 마지막 확인과 제출은 판매자 몫이다.
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

    const empty =
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (empty) {
      fields.push({
        key: spec.key,
        label,
        status: "skipped",
        detail: spec.required ? "값 없음 (필수)" : "값 없음"
      });
      if (spec.required) warnings.push(`필수 항목 "${label}" 값이 비어 있습니다.`);
      continue;
    }

    const located = findControl(root, spec);
    if (!located) {
      fields.push({
        key: spec.key,
        label,
        status: "not-found",
        detail: "현재 페이지에서 입력란을 찾지 못했습니다."
      });
      if (spec.required) warnings.push(`필수 항목 "${label}" 입력란을 찾지 못했습니다.`);
      continue;
    }

    if (dryRun) {
      fields.push({
        key: spec.key,
        label,
        status: "matched",
        detail: located.label
      });
      continue;
    }

    try {
      if (spec.kind === "file" && located.element instanceof HTMLInputElement) {
        const urls = Array.isArray(value) ? value : [String(value)];
        const { uploaded, failed } = await uploadFromUrls(located.element, urls);
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

      if (spec.kind === "select" || spec.kind === "radio" || spec.kind === "checkbox") {
        const ok = selectChoice(root, spec, joinValue(value));
        fields.push({
          key: spec.key,
          label,
          status: ok ? "filled" : "error",
          detail: ok ? located.label : "해당 값을 선택할 수 없습니다."
        });
        if (!ok) warnings.push(`"${label}" 값을 직접 선택하세요.`);
        continue;
      }

      const text = String(joinValue(value));
      const formatted = formatValue(text, spec.format ?? "plain");
      const element = located.element;

      if (element instanceof HTMLSelectElement) {
        const ok = setSelectValue(element, text);
        fields.push({
          key: spec.key,
          label,
          status: ok ? "filled" : "error",
          detail: ok ? located.label : "일치하는 선택 항목이 없습니다."
        });
      } else if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement
      ) {
        setNativeValue(element, formatted);
        fields.push({ key: spec.key, label, status: "filled", detail: located.label });
      } else if (element instanceof HTMLElement) {
        setContentEditable(element, text);
        fields.push({ key: spec.key, label, status: "filled", detail: "contenteditable" });
      } else {
        fields.push({ key: spec.key, label, status: "manual" });
      }
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
