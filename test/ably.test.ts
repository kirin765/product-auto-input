// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { ably } from "../src/adapters/ably";
import { sampleProduct } from "../src/shared/product";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("ably postFill", () => {
  it("상품 상태와 해시태그를 입력한다", async () => {
    document.body.innerHTML = `
      <label><input type="radio" name="condition" value="0" checked />신상품</label>
      <label><input type="radio" name="condition" value="1" />중고</label>
      <input placeholder="해시태그를 입력하세요" />
    `;

    const input = document.querySelector(
      'input[placeholder="해시태그를 입력하세요"]'
    ) as HTMLInputElement;
    const values: string[] = [];
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") values.push(input.value);
    });

    const product = {
      ...sampleProduct(),
      condition: "used" as const,
      tags: ["테스트 태그", "tag2"]
    };
    const result = await ably.postFill!(product, document);

    const used = document.querySelector('input[value="1"]') as HTMLInputElement;
    expect(used.checked).toBe(true);
    expect(values).toEqual(["테스트태그", "tag2"]);
    expect(result.actions).toContain("상품 상태: 중고");
    expect(result.actions).toContain("해시태그 2개 입력");
  });

  it("해시태그가 없으면 입력란을 건드리지 않는다", async () => {
    document.body.innerHTML = `
      <label><input type="radio" name="condition" value="0" checked />신상품</label>
      <input placeholder="해시태그를 입력하세요" />
    `;
    const product = { ...sampleProduct(), tags: [] };
    const result = await ably.postFill!(product, document);
    expect(result.actions).toEqual(["상품 상태: 신상품"]);
  });
});
