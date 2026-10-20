// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prefillProduct, summarizeReport } from "../src/shared/engine";
import { normalizeProduct } from "../src/shared/product";
import type { MarketplaceAdapter } from "../src/adapters/types";

const adapter: MarketplaceAdapter = {
  id: "smartstore",
  name: "테스트 마켓",
  shortName: "테스트",
  sellerCenter: "https://example.com/",
  createUrl: "https://example.com/",
  hosts: ["sell.smartstore.naver.com"],
  urlPatterns: [/.*/],
  verified: false,
  fields: [
    { key: "title", kind: "text", required: true },
    { key: "price", kind: "text", required: true },
    { key: "detail", kind: "textarea" }
  ],
  requirements: [],
  notes: []
};

const product = normalizeProduct({
  title: "테스트 상품",
  price: 12900,
  stock: 3,
  detailText: "상세 설명",
  images: []
});

beforeEach(() => {
  document.body.innerHTML = `
    <form>
      <label for="title">상품명</label>
      <input id="title" />
      <label for="price">판매가격</label>
      <input id="price" />
      <label for="detail">상세설명</label>
      <textarea id="detail"></textarea>
      <button type="submit" id="submit">등록</button>
    </form>
  `;
});

describe("prefillProduct", () => {
  it("텍스트 필드를 채우고 제출 버튼은 누르지 않는다", async () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    const submit = document.getElementById("submit") as HTMLButtonElement;
    submit.addEventListener("click", onSubmit);

    const report = await prefillProduct(product, adapter);

    expect((document.getElementById("title") as HTMLInputElement).value).toBe("테스트 상품");
    expect((document.getElementById("price") as HTMLInputElement).value).toBe("12900");
    expect((document.getElementById("detail") as HTMLTextAreaElement).value).toBe("상세 설명");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(report.submitted).toBe(false);
    expect(report.fields.filter((field) => field.status === "filled")).toHaveLength(3);
    expect(report.warnings[0]).toContain("검증되지 않았습니다");
  });

  it("dryRun은 값은 바꾸지 않고 매칭만 보고한다", async () => {
    const report = await prefillProduct(product, adapter, { dryRun: true });
    expect((document.getElementById("title") as HTMLInputElement).value).toBe("");
    expect(report.fields.every((field) => field.status === "matched")).toBe(true);
    expect(report.dryRun).toBe(true);
  });

  it("입력란을 못 찾으면 not-found로 보고한다", async () => {
    document.body.innerHTML = `<label for="other">다른 항목</label><input id="other" />`;
    const report = await prefillProduct(product, adapter);
    expect(report.fields.every((field) => field.status === "not-found")).toBe(true);
    expect(report.warnings.some((warning) => warning.includes("찾지 못했습니다"))).toBe(true);
  });

  it("값이 없는 필드는 skipped로 남긴다", async () => {
    const partial = normalizeProduct({ title: "상품", price: 1000, stock: 0 });
    const report = await prefillProduct(partial, adapter);
    const detail = report.fields.find((field) => field.key === "detail");
    expect(detail?.status).toBe("skipped");
  });

  it("markdown 요약을 만든다", async () => {
    const report = await prefillProduct(product, adapter, { dryRun: true });
    expect(summarizeReport(report)).toContain("테스트 마켓");
    expect(summarizeReport(report)).toContain("매칭 3");
  });
});
