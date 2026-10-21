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
  shipping: { origin: "서울" },
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

  it("숨겨진 섹션의 입력란도 채운다", async () => {
    document.body.innerHTML = `
      <label for="title">상품명</label>
      <input id="title" />
      <div style="display:none">
        <label for="price">판매가격</label>
        <input id="price" />
        <label for="detail">상세설명</label>
        <textarea id="detail"></textarea>
      </div>
    `;

    const report = await prefillProduct(product, adapter);

    expect((document.getElementById("price") as HTMLInputElement).value).toBe("12900");
    expect((document.getElementById("detail") as HTMLTextAreaElement).value).toBe("상세 설명");
    expect(report.fields.filter((field) => field.status === "filled")).toHaveLength(3);
  });

  it("같은 라벨의 입력란이 여러 개면 모두 채운다", async () => {
    document.body.innerHTML = `
      <label for="title">상품명</label>
      <input id="title" />
      <label for="price1">판매가격</label>
      <input id="price1" />
      <div style="display:none">
        <label for="price2">판매가격</label>
        <input id="price2" />
      </div>
      <label for="detail">상세설명</label>
      <textarea id="detail"></textarea>
    `;

    const report = await prefillProduct(product, adapter);

    expect((document.getElementById("price1") as HTMLInputElement).value).toBe("12900");
    expect((document.getElementById("price2") as HTMLInputElement).value).toBe("12900");
    const price = report.fields.find((field) => field.key === "price");
    expect(price?.status).toBe("filled");
    expect(price?.detail).toContain("외 1개");
  });

  it("select·textarea·radio로 렌더링된 필드도 kind와 무관하게 채운다", async () => {
    document.body.innerHTML = `
      <div class="b-box">
        <div class="b-box__header">원산지</div>
        <select id="origin">
          <option value="">선택</option>
          <option value="국내">국내</option>
          <option value="서울">서울</option>
        </select>
      </div>
      <div class="b-box">
        <div class="b-box__header">상품상세</div>
        <textarea id="detail"></textarea>
      </div>
      <div class="b-box__row">
        <div class="b-box__title"><strong>상품상태</strong></div>
        <label><input type="radio" name="condition" value="new" /> 새상품</label>
        <label><input type="radio" name="condition" value="used" /> 중고</label>
      </div>
    `;
    const flexible: MarketplaceAdapter = {
      ...adapter,
      fields: [
        { key: "origin", kind: "text" },
        { key: "detail", kind: "contenteditable" },
        { key: "condition", kind: "select" }
      ]
    };

    await prefillProduct(product, flexible);

    expect((document.getElementById("origin") as HTMLSelectElement).value).toBe("서울");
    expect((document.getElementById("detail") as HTMLTextAreaElement).value).toBe("상세 설명");
    const checked = document.querySelector<HTMLInputElement>('input[value="new"]');
    expect(checked?.checked).toBe(true);
  });

  it("유사 라벨이라도 다른 의미의 입력란은 채우지 않는다", async () => {
    document.body.innerHTML = `
      <label for="price">판매가</label>
      <input id="price" />
      <div style="display:none">
        <label for="usedPrice">구입 당시 판매가</label>
        <input id="usedPrice" />
      </div>
      <label for="stock">재고수량</label>
      <input id="stock" />
      <div style="display:none">
        <label for="minQty">최소구매수량</label>
        <input id="minQty" />
        <label for="qty">수량</label>
        <input id="qty" />
      </div>
      <label for="detail">상세설명</label>
      <textarea id="detail"></textarea>
    `;

    const withStock: MarketplaceAdapter = {
      ...adapter,
      fields: [...adapter.fields, { key: "stock", kind: "text" }]
    };

    await prefillProduct(product, withStock);

    expect((document.getElementById("price") as HTMLInputElement).value).toBe("12900");
    expect((document.getElementById("usedPrice") as HTMLInputElement).value).toBe("");
    expect((document.getElementById("stock") as HTMLInputElement).value).toBe("3");
    expect((document.getElementById("minQty") as HTMLInputElement).value).toBe("");
    expect((document.getElementById("qty") as HTMLInputElement).value).toBe("");
  });

  it("어댑터에 선언되지 않은 필드도 라벨로 채운다", async () => {
    document.body.innerHTML = `
      <label for="title">상품명</label>
      <input id="title" />
      <label for="price">판매가격</label>
      <input id="price" />
      <label for="detail">상세설명</label>
      <textarea id="detail"></textarea>
      <label for="tax">과세여부</label>
      <select id="tax">
        <option value="">선택</option>
        <option value="과세">과세</option>
        <option value="면세">면세</option>
      </select>
    `;

    const report = await prefillProduct(product, adapter);

    expect((document.getElementById("tax") as HTMLSelectElement).value).toBe("과세");
    expect(report.fields.some((field) => field.key === "taxType" && field.status === "filled")).toBe(
      true
    );
  });

  it("여러 필드가 같은 입력란을 가리키면 첫 필드만 채운다", async () => {
    document.body.innerHTML = `<input id="shared" placeholder="브랜드 및 제조사" />`;
    const shared: MarketplaceAdapter = {
      ...adapter,
      fields: [
        { key: "brand", kind: "text" },
        { key: "manufacturer", kind: "text" }
      ]
    };
    const branded = normalizeProduct({
      title: "공유 입력란 상품",
      brand: "브랜드값",
      manufacturer: "제조사값",
      price: 1000,
      stock: 1
    });

    const report = await prefillProduct(branded, shared);

    expect((document.getElementById("shared") as HTMLInputElement).value).toBe("브랜드값");
    expect(report.fields.find((field) => field.key === "manufacturer")?.status).toBe("manual");
  });

  it("상품상태가 신상품/중고상품 라디오여도 선택한다", async () => {
    document.body.innerHTML = `
      <div class="b-box__row">
        <div class="b-box__title"><strong>상품상태</strong></div>
        <label><input type="radio" name="saleType" value="NEW" /> 신상품</label>
        <label><input type="radio" name="saleType" value="OLD" /> 중고상품</label>
      </div>
    `;
    const status: MarketplaceAdapter = {
      ...adapter,
      fields: [{ key: "condition", kind: "select", labels: ["상품상태", "신상품", "중고상품"] }]
    };

    await prefillProduct(product, status);

    expect(
      (document.querySelector('input[value="NEW"]') as HTMLInputElement).checked
    ).toBe(true);
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

  it("contenteditable 셀렉터가 래퍼를 가리키면 내용을 지우지 않는다", async () => {
    document.body.innerHTML = `<div id="wrap"><span>보존할 내용</span></div>`;
    const wrapper: MarketplaceAdapter = {
      ...adapter,
      fields: [{ key: "detail", kind: "contenteditable", selectors: ["#wrap"] }]
    };

    const report = await prefillProduct(product, wrapper);

    expect(document.getElementById("wrap")?.textContent).toBe("보존할 내용");
    expect(report.fields[0].status).toBe("manual");
  });

  it("markdown 요약을 만든다", async () => {
    const report = await prefillProduct(product, adapter, { dryRun: true });
    expect(summarizeReport(report)).toContain("테스트 마켓");
    expect(summarizeReport(report)).toContain("매칭 3");
  });
});
