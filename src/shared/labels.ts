export type FieldKey =
  | "title"
  | "brand"
  | "manufacturer"
  | "supplier"
  | "origin"
  | "price"
  | "originalPrice"
  | "stock"
  | "sku"
  | "barcode"
  | "condition"
  | "taxType"
  | "category"
  | "tags"
  | "detail"
  | "asInfo"
  | "deliveryFee"
  | "deliveryMethod"
  | "deliveryDays"
  | "returnFee"
  | "adultOnly"
  | "mainImages"
  | "detailImages"
  | "optionNames"
  | "optionValues";

/**
 * 판매자센터마다 라벨 문구가 조금씩 다르므로 넉넉하게 별칭을 둔다.
 * 실제 셀렉터가 확인되면 어댑터의 `selectors`가 우선 적용된다.
 */
export const FIELD_LABELS: Record<FieldKey, string[]> = {
  title: ["상품명", "상품이름", "상품제목", "노출상품명", "판매상품명"],
  brand: ["브랜드", "브랜드명"],
  manufacturer: ["제조사", "제조업체", "제조원", "제조자"],
  supplier: ["공급사", "공급업체", "입점사"],
  origin: ["원산지", "제조국", "원산지국가"],
  price: ["판매가", "판매가격", "판매가격원", "상품가격"],
  originalPrice: ["정가", "정상가", "소비자가격", "시중가"],
  stock: ["재고수량", "재고", "수량", "재고량"],
  sku: ["판매자상품코드", "판매자관리코드", "판매자코드", "자체상품코드", "상품코드", "판매상품코드", "sku"],
  barcode: ["바코드", "상품바코드", "eancode"],
  condition: ["상품상태", "상태", "상품등급"],
  taxType: ["과세여부", "부가세", "과세구분", "세금구분"],
  category: ["카테고리", "상품카테고리", "분류", "카테고리선택"],
  tags: ["검색어", "태그", "키워드", "검색키워드"],
  detail: ["상품상세설명", "상세설명", "상세정보", "상품설명", "상품상세"],
  asInfo: ["as정보", "a/s정보", "에이에스정보", "as안내", "as특이사항", "소비자상담"],
  deliveryFee: ["배송비", "기본배송비", "택배비"],
  deliveryMethod: ["배송방법", "배송유형", "배송형태"],
  deliveryDays: ["배송기간", "배송일", "출고일", "배송소요일"],
  returnFee: ["반품배송비", "반품비", "왕복배송비"],
  adultOnly: ["성인상품", "성인인증", "19세미만"],
  mainImages: ["대표이미지", "상품이미지", "메인이미지", "썸네일"],
  detailImages: ["상세이미지", "추가이미지", "상세페이지이미지"],
  optionNames: ["옵션명", "옵션그룹", "옵션항목"],
  optionValues: ["옵션값", "옵션가격", "옵션재고"]
};

export function normalizeLabel(text: string): string {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

/**
 * 후보 텍스트가 별칭 중 하나와 얼마나 잘 맞는지 0~1로 반환한다.
 * 정확히 일치 > 별칭으로 시작 > 별칭을 포함 순으로 점수를 준다.
 */
export function labelScore(candidate: string, aliases: readonly string[]): number {
  const normalized = normalizeLabel(candidate);
  if (!normalized) return 0;
  let best = 0;
  for (const alias of aliases) {
    const target = normalizeLabel(alias);
    if (!target) continue;
    if (normalized === target) return 1;
    // 짧은 단위 텍스트("원", "개")가 "원산지" 같은 별칭에 역방향으로 붙지 않도록
    // 별칭이 후보를 포함하는 경우는 후보가 두 글자 이상일 때만 인정한다.
    const reverse = normalized.length >= 2;
    if (normalized.startsWith(target) || (reverse && target.startsWith(normalized))) {
      best = Math.max(best, 0.85);
    } else if (
      normalized.includes(target) ||
      (reverse && target.includes(normalized))
    ) {
      best = Math.max(best, 0.65);
    }
  }
  return best;
}

export function bestFieldKey(text: string, threshold = 0.6): FieldKey | undefined {
  let bestKey: FieldKey | undefined;
  let bestScore = threshold;
  for (const [key, aliases] of Object.entries(FIELD_LABELS) as [FieldKey, string[]][]) {
    const score = labelScore(text, aliases);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  return bestKey;
}
