import { describe, expect, it } from "vitest";
import { MARKETPLACES, detectMarketplace, getAdapter } from "../src/adapters/registry";
import { matchesUrl } from "../src/adapters/types";

describe("marketplace registry", () => {
  it("7개 판매자센터를 등록한다", () => {
    expect(MARKETPLACES.map((adapter) => adapter.id).sort()).toEqual([
      "ably",
      "auction",
      "coupang",
      "elevenst",
      "gmarket",
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
    ["https://etrade.gmarket.co.kr/goods/register", "gmarket"],
    ["https://etrade.auction.co.kr/goods/register", "auction"],
    ["https://soffice.11st.co.kr/", "elevenst"],
    ["https://partner.zigzag.kr/", "zigzag"],
    ["https://seller.a-bly.com/", "ably"]
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
