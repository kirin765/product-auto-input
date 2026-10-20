import type { CanonicalProduct } from "./product";

export type IssueSeverity = "error" | "warning";

export interface ValidationIssue {
  path: string;
  message: string;
  severity: IssueSeverity;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const LIMITS: Record<string, { max: number; label: string }> = {
  title: { max: 100, label: "상품명" },
  brand: { max: 50, label: "브랜드" },
  manufacturer: { max: 50, label: "제조사" },
  sku: { max: 40, label: "판매자 상품코드" }
};

/**
 * 마켓 공통 최소 요건만 검사한다. 마켓별 추가 요건(카테고리 코드, 고시정보 항목 등)은
 * 어댑터의 `requirements`에서 별도로 안내한다.
 */
export function validateProduct(product: CanonicalProduct): ValidationResult {
  const issues: ValidationIssue[] = [];
  const error = (path: string, message: string) =>
    issues.push({ path, message, severity: "error" });
  const warn = (path: string, message: string) =>
    issues.push({ path, message, severity: "warning" });

  if (!product.title) error("title", "상품명이 필요합니다.");
  if (product.title && product.title.length > 100)
    error("title", "상품명은 100자 이하여야 합니다.");
  else if (product.title.length > 50)
    warn("title", "50자 초과 상품명은 일부 마켓에서 잘릴 수 있습니다.");

  for (const [key, limit] of Object.entries(LIMITS)) {
    const value = product[key as keyof CanonicalProduct];
    if (key === "title") continue;
    if (typeof value === "string" && value.length > limit.max)
      warn(key, `${limit.label}은 ${limit.max}자 이하를 권장합니다.`);
  }

  if (!Number.isInteger(product.price) || product.price < 100)
    error("price", "판매가는 100원 이상의 정수여야 합니다.");
  if (product.originalPrice !== undefined && product.originalPrice < product.price)
    warn("originalPrice", "정가가 판매가보다 낮습니다.");
  if (product.stock < 0) error("stock", "재고는 0 이상이어야 합니다.");
  if (product.stock === 0) warn("stock", "재고가 0이면 등록 후 품절로 노출됩니다.");

  if (product.images.length === 0)
    error("images", "대표 이미지가 최소 1장 필요합니다.");
  if (product.images.length > 0 && !product.images.some((image) => image.type === "main"))
    error("images", "type이 main인 대표 이미지가 필요합니다.");
  if (product.images.some((image) => !/^https?:\/\//.test(image.url)))
    warn("images", "http(s) URL이 아닌 이미지는 자동 업로드할 수 없습니다.");

  if (product.categoryPath.length === 0)
    warn("categoryPath", "카테고리 경로가 없으면 마켓에서 직접 선택해야 합니다.");

  if (!product.detailHtml && !product.detailText)
    warn("detail", "상세 설명이 비어 있습니다.");
  if (product.detailHtml && /<script\b/i.test(product.detailHtml))
    error("detailHtml", "상세 HTML에 <script> 태그를 넣을 수 없습니다.");

  const groupNames = new Set<string>();
  for (const group of product.optionGroups) {
    if (groupNames.has(group.name))
      error("optionGroups", `옵션 그룹명이 중복됩니다: ${group.name}`);
    groupNames.add(group.name);
    if (group.values.length === 0)
      warn("optionGroups", `옵션 그룹 "${group.name}"에 값이 없습니다.`);
  }

  for (const variant of product.variants) {
    for (const group of product.optionGroups) {
      if (!variant.options[group.name])
        warn("variants", `옵션 조합에 "${group.name}" 값이 없습니다.`);
    }
    if (variant.price !== undefined && variant.price < 0)
      error("variants", "옵션 추가금은 0 이상이어야 합니다.");
  }

  if (product.shipping.fee !== undefined && product.shipping.fee < 0)
    error("shipping.fee", "배송비는 0 이상이어야 합니다.");
  if (
    product.shipping.freeThreshold !== undefined &&
    product.shipping.fee !== undefined &&
    product.shipping.freeThreshold > 0 &&
    product.shipping.freeThreshold < product.shipping.fee
  )
    warn("shipping.freeThreshold", "무료배송 기준금액이 배송비보다 낮습니다.");

  if (!product.shipping.origin)
    warn("shipping.origin", "원산지가 없으면 마켓에서 직접 입력해야 합니다.");
  if (Object.keys(product.notice).length === 0)
    warn("notice", "상품 고시정보가 비어 있습니다.");

  if (product.adultOnly)
    warn("adultOnly", "성인 상품은 마켓별 추가 인증이 필요합니다.");

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    errors: issues.filter((issue) => issue.severity === "error"),
    warnings: issues.filter((issue) => issue.severity === "warning")
  };
}
