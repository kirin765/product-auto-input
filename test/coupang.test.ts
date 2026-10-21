// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { fillCoupangRows, prepareCoupang } from "../src/adapters/coupang";
import { normalizeProduct } from "../src/shared/product";

const noWait = async () => {};

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("prepareCoupang", () => {
  it("안전 가이드 다운로드·동의 후 등록 화면으로 이동한다", async () => {
    document.body.innerHTML = `
      <button id="download" class="origin-labeling-guide__download">원산지 표시제도 안내</button>
      <label for="ack"><input id="ack" type="checkbox" /> 네, 모든 내용을 확인했습니다.</label>
      <button id="continue" disabled>상품등록 계속하기</button>
      <button id="submit">상품등록</button>
    `;
    const download = document.getElementById("download") as HTMLButtonElement;
    const checkbox = document.getElementById("ack") as HTMLInputElement;
    const continueButton = document.getElementById("continue") as HTMLButtonElement;
    const submit = document.getElementById("submit") as HTMLButtonElement;
    let downloads = 0;
    let continued = 0;
    let submitted = 0;
    download.addEventListener("click", () => downloads++);
    continueButton.addEventListener("click", () => continued++);
    submit.addEventListener("click", () => submitted++);
    checkbox.addEventListener("change", () => {
      continueButton.disabled = !checkbox.checked;
    });

    const result = await prepareCoupang(document, { wait: noWait });

    expect(downloads).toBe(1);
    expect(checkbox.checked).toBe(true);
    expect(continued).toBe(1);
    expect(submitted).toBe(0);
    expect(result.actions).toContain("안전 가이드 동의");
    expect(result.actions).toContain("상품등록 화면으로 이동");
  });

  it("검색 모드에서 신규 상품 등록으로 이동한다", async () => {
    document.body.innerHTML = `<button id="entry">신규 상품 등록하기</button>`;
    const entry = document.getElementById("entry") as HTMLButtonElement;
    let clicked = 0;
    entry.addEventListener("click", () => {
      clicked++;
      document.body.insertAdjacentHTML(
        "beforeend",
        '<button class="new-listing-category-field__manual">직접 선택</button>'
      );
    });

    const result = await prepareCoupang(document, { wait: noWait });

    expect(clicked).toBe(1);
    expect(result.actions).toContain("신규 상품 등록으로 이동");
  });

  it("새 등록 홈에서 직접 입력 모드로 폼에 진입한다", async () => {
    document.body.innerHTML = `
      <button class="new-listing-home__mode is-active">검색</button>
      <button class="new-listing-home__mode" id="direct">직접 입력</button>
      <button class="new-listing-home__submit" id="go">검색</button>
    `;
    const direct = document.getElementById("direct") as HTMLButtonElement;
    const go = document.getElementById("go") as HTMLButtonElement;
    let modes = 0;
    let submits = 0;
    direct.addEventListener("click", () => modes++);
    go.addEventListener("click", () => {
      submits++;
      document.body.insertAdjacentHTML(
        "beforeend",
        '<input placeholder="상품명을 입력해주세요." />'
      );
    });

    const result = await prepareCoupang(document, { wait: noWait });

    expect(modes).toBe(1);
    expect(submits).toBe(1);
    expect(result.actions).toContain("직접 입력 등록 방식 선택");
    expect(result.actions).toContain("상품 등록 폼으로 이동");
  });

  it("이미 등록 폼이면 아무 것도 누르지 않는다", async () => {
    document.body.innerHTML = `
      <button class="new-listing-category-field__manual">직접 선택</button>
      <button id="entry">신규 상품 등록하기</button>
    `;
    const entry = document.getElementById("entry") as HTMLButtonElement;
    let clicked = 0;
    entry.addEventListener("click", () => clicked++);

    const result = await prepareCoupang(document, { wait: noWait });

    expect(clicked).toBe(0);
    expect(result.actions).toEqual([]);
  });
});

describe("fillCoupangRows", () => {
  const product = normalizeProduct({
    title: "테스트 상품",
    price: 18900,
    originalPrice: 25000,
    stock: 120,
    sku: "ONN-TMB",
    optionGroups: [
      {
        name: "색상",
        values: [{ name: "실버", stock: 60, sku: "ONN-TMB-SV" }]
      }
    ]
  });

  it("옵션 행의 재고·판매자코드와 가격 표를 채운다", async () => {
    document.body.innerHTML = `
      <table class="easy-add-table">
        <tbody>
          <tr>
            <td><span class="option-name__text">실버, 500L, 1개</span></td>
            <td><input type="number" class="unit-input__field" value="0" /></td>
            <td><input type="text" class="cell-input" /></td>
          </tr>
        </tbody>
      </table>
      <table class="easy-price-table"><tbody><tr><td>header</td></tr></tbody></table>
      <table class="easy-price-table">
        <tbody>
          <tr>
            <td><input type="text" class="unit-input__field" /></td>
            <td><input type="text" class="unit-input__field" /></td>
            <td><input type="number" class="unit-input__field" placeholder="최저가" /></td>
          </tr>
        </tbody>
      </table>
    `;

    const result = await fillCoupangRows(product, document);

    expect(
      (document.querySelector("input.unit-input__field") as HTMLInputElement).value
    ).toBe("60");
    expect((document.querySelector("input.cell-input") as HTMLInputElement).value).toBe(
      "ONN-TMB-SV"
    );
    const priceInputs = document.querySelectorAll<HTMLInputElement>(
      "table.easy-price-table input.unit-input__field"
    );
    expect(priceInputs[priceInputs.length - 3].value).toBe("18900");
    expect(priceInputs[priceInputs.length - 2].value).toBe("25000");
    expect(result.actions).toContain("옵션 재고·판매자코드 입력");
    expect(result.actions).toContain("판매가·정상가 입력");
  });

  it("옵션/가격 행이 없으면 경고를 남긴다", async () => {
    const result = await fillCoupangRows(product, document);
    expect(result.warnings).toContain("쿠팡 옵션을 먼저 추가한 뒤 다시 실행하세요.");
    expect(result.warnings).toContain("가격 탭에 옵션 행이 없습니다. 옵션을 먼저 추가하세요.");
  });
});
