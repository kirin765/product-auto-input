import { describe, expect, it } from "vitest";
import { MARKETPLACES, detectMarketplace, getAdapter } from "../src/adapters/registry";
import { matchesUrl } from "../src/adapters/types";
import { labelScore } from "../src/shared/labels";

describe("marketplace registry", () => {
  it("6개 판매자센터를 등록한다", () => {
    expect(MARKETPLACES.map((adapter) => adapter.id).sort()).toEqual([
      "ably",
      "coupang",
      "elevenst",
      "esmplus",
      "smartstore",
      "zigzag"
    ]);
  });

  it("id가 중복되지 않고 https 등록 URL을 가진다", () => {
    const ids = new Set(MARKETPLACES.map((adapter) => adapter.id));
    expect(ids.size).toBe(MARKETPLACES.length);
    for (const adapter of MARKETPLACES) {
      expect(adapter.createUrl.startsWith("https://")).toBe(true);
      expect(adapter.hosts.length).toBeGreaterThan(0);
      expect(adapter.fields.length).toBeGreaterThan(0);
    }
  });

  it("쿠팡은 단계와 검증된 첫 단계 셀렉터를 가진다", () => {
    const coupang = getAdapter("coupang");
    const title = coupang?.fields.find((field) => field.key === "title");
    const manufacturer = coupang?.fields.find((field) => field.key === "manufacturer");

    expect(coupang?.steps?.length).toBeGreaterThan(0);
    expect(title?.selectors).toContain('input[placeholder="상품명을 입력해주세요."]');
    expect(manufacturer?.labels).toEqual(["제조자"]);
    expect(
      labelScore("제조사를 알 수 없는 경우 브랜드명을 입력해주세요.", manufacturer?.labels ?? [])
    ).toBe(0);
    expect(labelScore("제조자(수입자)", manufacturer?.labels ?? [])).toBeGreaterThanOrEqual(0.6);
  });

  it("에이블리는 실제 확인된 등록 폼 셀렉터를 가진다", () => {
    const ably = getAdapter("ably");
    const field = (key: string) => ably?.fields.find((spec) => spec.key === key);

    expect(ably?.verified).toBe(true);
    expect(ably?.hosts).toEqual(["my.a-bly.com", "seller-admin.a-bly.com"]);
    expect(field("title")?.selectors).toContain("#name");
    expect(field("price")?.selectors).toContain("#prices_0_consumer");
    expect(field("sku")?.selectors).toContain("#custom_code");
    expect(field("mainImages")?.selectors).toContain('input[type="file"][accept*="gif"]');
    expect(field("detailImages")?.selectors).toContain('input[type="file"][multiple]');
    expect(field("detail")?.selectors).toContain('div.fr-element[contenteditable="true"]');
  });

  it("마켓별 필드 키가 중복되지 않는다", () => {
    for (const adapter of MARKETPLACES) {
      const keys = adapter.fields.map((field) => field.key);
      expect(new Set(keys).size, adapter.id).toBe(keys.length);
    }
  });
});

describe("detectMarketplace", () => {
  it.each([
    ["https://sell.smartstore.naver.com/#/products/create", "smartstore"],
    ["https://wing.coupang.com/tenants/sfl-portal/products/create", "coupang"],
    ["https://www.esmplus.com/Home/v2/goods-register", "esmplus"],
    ["https://item.esmplus.com/goods/new", "esmplus"],
    ["https://soffice.11st.co.kr/", "elevenst"],
    ["https://partner.zigzag.kr/", "zigzag"],
    ["https://my.a-bly.com/goods/v2/register", "ably"],
    ["https://seller-admin.a-bly.com/goods/register", "ably"]
  ])("%s -> %s", (url, id) => {
    expect(detectMarketplace(url)?.id).toBe(id);
  });

  it("지원하지 않는 사이트는 undefined", () => {
    expect(detectMarketplace("https://example.com/")).toBeUndefined();
    expect(detectMarketplace("not a url")).toBeUndefined();
  });

  it("host가 다르면 매칭하지 않는다", () => {
    const coupang = getAdapter("coupang");
    expect(coupang && matchesUrl(coupang, "https://sell.smartstore.naver.com/")).toBe(false);
  });
});

describe("11번가 구버전 화면 감지", () => {
  it("ProductReg.tmall은 구버전으로 본다", async () => {
    const { isLegacyElevenstForm } = await import("../src/adapters/elevenst");
    expect(
      isLegacyElevenstForm(
        "https://soffice.11st.co.kr/product/ProductReg.tmall?method=regForm&urlType=SO"
      )
    ).toBe(true);
    expect(
      isLegacyElevenstForm("https://soffice.11st.co.kr/pages/product-reg/index.html")
    ).toBe(false);
  });
});
