import type { FieldSpec } from "./types";
import type { FieldKey } from "../shared/labels";

const BASE_FIELDS: FieldSpec[] = [
  { key: "title", kind: "text", required: true },
  { key: "brand", kind: "text" },
  { key: "manufacturer", kind: "text" },
  { key: "supplier", kind: "text" },
  { key: "origin", kind: "text", required: true },
  { key: "price", kind: "text", required: true },
  { key: "originalPrice", kind: "text" },
  { key: "stock", kind: "text", required: true },
  { key: "sku", kind: "text" },
  { key: "barcode", kind: "text" },
  { key: "condition", kind: "select" },
  { key: "category", kind: "manual", required: true, note: "카테고리 선택기는 마켓별 UI가 달라 직접 선택해야 합니다." },
  { key: "tags", kind: "text" },
  { key: "detail", kind: "textarea", note: "리치 에디터를 쓰는 마켓은 본문만 입력되므로 서식을 확인하세요." },
  { key: "mainImages", kind: "file", required: true },
  { key: "detailImages", kind: "file" },
  { key: "deliveryFee", kind: "text" },
  { key: "deliveryMethod", kind: "select" },
  { key: "deliveryDays", kind: "text" },
  { key: "returnFee", kind: "text" },
  { key: "asInfo", kind: "text" },
  { key: "adultOnly", kind: "checkbox" },
  { key: "optionNames", kind: "manual", note: "옵션 빌더는 마켓별 커스텀 단계가 필요합니다." },
  { key: "optionValues", kind: "manual", note: "옵션별 가격·재고는 직접 입력하세요." }
];

export function commonFields(
  overrides: Partial<Record<FieldKey, Partial<FieldSpec>>> = {}
): FieldSpec[] {
  return BASE_FIELDS.map((field) => {
    const patch = overrides[field.key];
    return patch ? { ...field, ...patch } : field;
  });
}
