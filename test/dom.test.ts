// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findControl,
  labelTexts,
  scanFields,
  selectChoice,
  setNativeValue,
  setSelectValue
} from "../src/shared/dom";
import type { FieldSpec } from "../src/adapters/types";

const titleSpec: FieldSpec = { key: "title", kind: "text" };

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("labelTexts", () => {
  it("label[for], placeholder, aria-label을 모은다", () => {
    document.body.innerHTML = `
      <label for="p">상품명</label>
      <input id="p" placeholder="상품명을 입력하세요" aria-label="상품명" />
    `;
    const input = document.getElementById("p") as HTMLInputElement;
    expect(labelTexts(input)).toEqual(
      expect.arrayContaining(["상품명", "상품명을 입력하세요"])
    );
  });
});

describe("findControl", () => {
  it("label[for]로 입력란을 찾는다", () => {
    document.body.innerHTML = `
      <label for="title">상품명</label>
      <input id="title" />
    `;
    const located = findControl(document, titleSpec);
    expect(located?.element.id).toBe("title");
  });

  it("래핑 label로 입력란을 찾는다", () => {
    document.body.innerHTML = `<label>상품명 <input id="wrapped" /></label>`;
    expect(findControl(document, titleSpec)?.element.id).toBe("wrapped");
  });

  it("명시 셀렉터를 라벨보다 우선한다", () => {
    document.body.innerHTML = `
      <input id="first" aria-label="상품명" />
      <input id="second" aria-label="상품명" />
    `;
    const located = findControl(document, {
      key: "title",
      kind: "text",
      selectors: ["#second"]
    });
    expect(located?.element.id).toBe("second");
  });

  it("숨겨진 입력란은 건너뛴다", () => {
    document.body.innerHTML = `
      <label for="hidden">상품명</label>
      <input id="hidden" style="display:none" />
      <label for="visible">상품명</label>
      <input id="visible" />
    `;
    expect(findControl(document, titleSpec)?.element.id).toBe("visible");
  });

  it("라벨이 없으면 찾지 못한다", () => {
    document.body.innerHTML = `<input id="mystery" />`;
    expect(findControl(document, titleSpec)).toBeUndefined();
  });
});

describe("setNativeValue", () => {
  it("값을 넣고 input/change 이벤트를 발생시킨다", () => {
    document.body.innerHTML = `<input id="price" />`;
    const input = document.getElementById("price") as HTMLInputElement;
    const onInput = vi.fn();
    const onChange = vi.fn();
    input.addEventListener("input", onInput);
    input.addEventListener("change", onChange);

    setNativeValue(input, "12900");

    expect(input.value).toBe("12900");
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("setSelectValue", () => {
  it("옵션 텍스트로 선택한다", () => {
    document.body.innerHTML = `
      <select id="condition">
        <option value="">선택</option>
        <option value="new">새상품</option>
        <option value="used">중고</option>
      </select>
    `;
    const select = document.getElementById("condition") as HTMLSelectElement;
    expect(setSelectValue(select, "중고")).toBe(true);
    expect(select.value).toBe("used");
  });

  it("일치하는 옵션이 없으면 false", () => {
    document.body.innerHTML = `<select><option value="a">A</option></select>`;
    expect(setSelectValue(document.querySelector("select") as HTMLSelectElement, "없음")).toBe(false);
  });
});

describe("selectChoice", () => {
  it("라디오 라벨 텍스트로 선택한다", () => {
    document.body.innerHTML = `
      <label><input type="radio" name="tax" value="taxable" /> 과세</label>
      <label><input type="radio" name="tax" value="taxFree" /> 면세</label>
    `;
    const ok = selectChoice(document, { key: "taxType", kind: "radio" }, "면세");
    expect(ok).toBe(true);
    const checked = document.querySelector<HTMLInputElement>('input[value="taxFree"]');
    expect(checked?.checked).toBe(true);
  });
});

describe("scanFields", () => {
  it("입력란 종류와 추론된 키를 반환한다", () => {
    document.body.innerHTML = `
      <label for="title">상품명</label><input id="title" name="productName" required />
      <label for="desc">상세설명</label><textarea id="desc"></textarea>
      <label for="ct">카테고리</label><select id="ct"><option>A</option></select>
    `;
    const fields = scanFields(document);
    expect(fields).toHaveLength(3);
    expect(fields[0]).toMatchObject({ key: "title", kind: "text", required: true });
    expect(fields[1]).toMatchObject({ key: "detail", kind: "textarea" });
    expect(fields[2]).toMatchObject({ kind: "select" });
  });
});
