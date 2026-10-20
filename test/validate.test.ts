import { describe, expect, it } from "vitest";
import { normalizeProduct, sampleProduct } from "../src/shared/product";
import { validateProduct } from "../src/shared/validate";

describe("validateProduct", () => {
  it("예시 상품은 통과한다", () => {
    const result = validateProduct(sampleProduct());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("필수 항목 누락을 오류로 잡는다", () => {
    const result = validateProduct(
      normalizeProduct({ title: "", price: 0, stock: 0, images: [] })
    );
    const paths = result.errors.map((issue) => issue.path);
    expect(paths).toContain("title");
    expect(paths).toContain("price");
    expect(paths).toContain("images");
    expect(result.ok).toBe(false);
  });

  it("정가 역전과 재고 0은 경고로 잡는다", () => {
    const product = sampleProduct();
    product.originalPrice = 1000;
    product.stock = 0;
    const result = validateProduct(product);
    expect(result.ok).toBe(true);
    expect(result.warnings.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(["originalPrice", "stock"])
    );
  });

  it("상세 HTML의 script 태그를 거부한다", () => {
    const product = sampleProduct();
    product.detailHtml = "<script>alert(1)</script>";
    const result = validateProduct(product);
    expect(result.errors.some((issue) => issue.path === "detailHtml")).toBe(true);
  });

  it("중복 옵션 그룹명을 거부한다", () => {
    const product = sampleProduct();
    product.optionGroups.push({ name: "색상", values: [{ name: "레드" }] });
    const result = validateProduct(product);
    expect(result.errors.some((issue) => issue.path === "optionGroups")).toBe(true);
  });

  it("대표 이미지 타입이 없으면 오류다", () => {
    const product = sampleProduct();
    product.images = [{ url: "https://example.com/detail.jpg", type: "detail" }];
    const result = validateProduct(product);
    expect(result.errors.some((issue) => issue.path === "images")).toBe(true);
  });
});
