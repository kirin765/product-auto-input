import { describe, expect, it } from "vitest";
import {
  emptyProduct,
  normalizeProduct,
  parseProductInput,
  sampleProduct,
  toNumber
} from "../src/shared/product";

describe("normalizeProduct", () => {
  it("문자열 가격·재고·카테고리를 정규화한다", () => {
    const product = normalizeProduct({
      title: "  테스트 상품 ",
      price: "12,900원",
      originalPrice: "15,000",
      stock: "7개",
      category: "패션 > 남성 > 상의",
      tags: "여름, 반팔 | 쿨링",
      images: ["https://example.com/a.jpg", "https://example.com/b.jpg"]
    });

    expect(product.title).toBe("테스트 상품");
    expect(product.price).toBe(12900);
    expect(product.originalPrice).toBe(15000);
    expect(product.stock).toBe(7);
    expect(product.categoryPath).toEqual(["패션", "남성", "상의"]);
    expect(product.tags).toEqual(["여름", "반팔", "쿨링"]);
    expect(product.images[0]).toEqual({ url: "https://example.com/a.jpg", type: "main" });
    expect(product.images[1]).toEqual({ url: "https://example.com/b.jpg", type: "detail" });
  });

  it("옵션 그룹과 변형을 정규화한다", () => {
    const product = normalizeProduct({
      optionGroups: [
        {
          name: "색상",
          values: [{ name: "블랙", extraPrice: "1,000", stock: "3" }, "화이트"]
        }
      ],
      variants: [{ options: { 색상: "블랙" }, sku: "A-1", stock: "2" }]
    });

    expect(product.optionGroups[0].values).toHaveLength(2);
    expect(product.optionGroups[0].values[0]).toMatchObject({
      name: "블랙",
      extraPrice: 1000,
      stock: 3
    });
    expect(product.variants[0]).toMatchObject({ sku: "A-1", stock: 2 });
  });

  it("상태·과세 표기를 한국어 별칭에서 정규화한다", () => {
    expect(normalizeProduct({ condition: "리퍼비시" }).condition).toBe("refurbished");
    expect(normalizeProduct({ condition: "중고" }).condition).toBe("used");
    expect(normalizeProduct({ condition: "NEW" }).condition).toBe("new");
    expect(normalizeProduct({ taxType: "면세" }).taxType).toBe("taxFree");
    expect(normalizeProduct({ taxType: "과세" }).taxType).toBe("taxable");
  });

  it("알 수 없는 필드는 버리고 기본값을 채운다", () => {
    const product = normalizeProduct({ title: "상품", unknown: "x", price: -5, stock: -1 });
    expect(product.price).toBe(0);
    expect(product.stock).toBe(0);
    expect(product.currency).toBe("KRW");
    expect("unknown" in product).toBe(false);
  });

  it("중첩 product 래퍼를 벗겨낸다", () => {
    const product = parseProductInput(JSON.stringify({ product: { title: "감싼 상품", price: 1000 } }));
    expect(product.title).toBe("감싼 상품");
  });

  it("빈 상품과 예시 상품을 만든다", () => {
    expect(emptyProduct().title).toBe("");
    expect(sampleProduct().images.length).toBeGreaterThan(0);
    expect(sampleProduct().categoryPath.length).toBeGreaterThan(0);
  });
});

describe("toNumber", () => {
  it("통화 표기를 숫자로 바꾼다", () => {
    expect(toNumber("₩12,900")).toBe(12900);
    expect(toNumber("1.5")).toBe(1.5);
    expect(toNumber("없음")).toBeUndefined();
  });
});
