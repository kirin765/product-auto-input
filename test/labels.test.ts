import { describe, expect, it } from "vitest";
import {
  bestFieldKey,
  FIELD_LABELS,
  labelScore,
  normalizeLabel
} from "../src/shared/labels";

describe("normalizeLabel", () => {
  it("공백·특수문자·괄호를 제거한다", () => {
    expect(normalizeLabel("상품명 *")).toBe("상품명");
    expect(normalizeLabel("상품명(필수)")).toBe("상품명");
    expect(normalizeLabel("판매가 [원]")).toBe("판매가");
    expect(normalizeLabel("  SKU_code ")).toBe("skucode");
  });
});

describe("labelScore", () => {
  it("정확 일치를 1로 본다", () => {
    expect(labelScore("상품명", FIELD_LABELS.title)).toBe(1);
    expect(labelScore("상품명(필수)", FIELD_LABELS.title)).toBe(1);
  });

  it("부분 일치는 낮은 점수를 준다", () => {
    const score = labelScore("상품명 입력", FIELD_LABELS.title);
    expect(score).toBeGreaterThanOrEqual(0.6);
    expect(score).toBeLessThan(1);
  });

  it("무관한 텍스트는 0이다", () => {
    expect(labelScore("사업자등록번호", FIELD_LABELS.title)).toBe(0);
  });

  it("한 글자 단위 텍스트가 다른 필드 별칭에 역방향으로 매칭되지 않는다", () => {
    expect(labelScore("×원", FIELD_LABELS.origin)).toBe(0);
    expect(labelScore("개", FIELD_LABELS.origin)).toBe(0);
  });

  it("판매자 상품코드를 공급사로 오인하지 않는다", () => {
    expect(bestFieldKey("판매자 상품코드")).toBe("sku");
    expect(labelScore("판매자 상품코드", FIELD_LABELS.supplier)).toBe(0);
  });
});

describe("bestFieldKey", () => {
  it("한국어 라벨을 필드로 분류한다", () => {
    expect(bestFieldKey("판매가격")).toBe("price");
    expect(bestFieldKey("배송비")).toBe("deliveryFee");
    expect(bestFieldKey("판매자 상품코드")).toBe("sku");
    expect(bestFieldKey("원산지")).toBe("origin");
  });
});
