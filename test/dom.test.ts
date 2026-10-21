// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  expandSections,
  findControl,
  isSearchControl,
  findControls,
  labelTexts,
  scanFields,
  sameOriginDocuments,
  selectFormDocument,
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

  it("ESM Plus 섹션 제목(.box__filter-head)을 라벨로 사용한다", () => {
    document.body.innerHTML = `
      <div class="box__filter-item">
        <div class="box__filter-head"><span class="text">판매가</span></div>
        <div class="box__filter-content"><input id="p" /></div>
      </div>
    `;
    const input = document.getElementById("p") as HTMLInputElement;
    expect(labelTexts(input)).toContain("판매가");
  });

  it("섹션 제목(.b-box__title)을 라벨로 사용한다", () => {
    document.body.innerHTML = `
      <div class="b-box__row">
        <div class="b-box__title">
          <div class="c-title"><strong class="c-title__text">판매가</strong></div>
        </div>
        <div class="b-box__cont"><div class="c-form__row"><input id="p" /></div></div>
      </div>
    `;
    const input = document.getElementById("p") as HTMLInputElement;
    expect(labelTexts(input).join(" ")).toContain("판매가");
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

  it("파일 필드는 숨겨진 업로드 input도 찾는다", () => {
    document.body.innerHTML = `
      <input type="file" id="upload" style="display: none" />
      <input type="file" id="visible-upload" />
    `;
    const located = findControl(document, {
      key: "mainImages",
      kind: "file",
      selectors: ["#upload"]
    });
    expect(located?.element.id).toBe("upload");
  });

  it("숨겨진 input도 보이는 입력란이 없으면 찾는다", () => {
    document.body.innerHTML = `
      <input id="hidden-title" style="display: none" />
    `;
    const located = findControl(document, {
      key: "title",
      kind: "text",
      selectors: ["#hidden-title"]
    });
    expect(located?.element.id).toBe("hidden-title");
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

  it("보이는 입력란을 숨겨진 입력란보다 우선한다", () => {
    document.body.innerHTML = `
      <label for="hidden">상품명</label>
      <input id="hidden" style="display:none" />
      <label for="visible">상품명</label>
      <input id="visible" />
    `;
    expect(findControl(document, titleSpec)?.element.id).toBe("visible");
  });

  it("보이는 입력란이 없으면 숨겨진 입력란도 찾는다", () => {
    document.body.innerHTML = `
      <div style="display:none">
        <label for="hidden">상품명</label>
        <input id="hidden" />
      </div>
    `;
    expect(findControl(document, titleSpec)?.element.id).toBe("hidden");
  });

  it("같은 필드의 입력란이 여러 개면 모두 반환한다", () => {
    document.body.innerHTML = `
      <label for="price1">판매가</label>
      <input id="price1" />
      <div style="display:none">
        <label for="price2">판매가</label>
        <input id="price2" />
      </div>
    `;
    const located = findControls(document, { key: "price", kind: "text" });
    expect(located.map((item) => item.element.id).sort()).toEqual(["price1", "price2"]);
  });

  it("조상이 display:none이면 숨겨진 입력란으로 본다", () => {
    document.body.innerHTML = `
      <div style="display:none">
        <label for="hidden">상품명</label>
        <input id="hidden" />
      </div>
      <label for="visible">상품명</label>
      <input id="visible" />
    `;
    expect(findControl(document, titleSpec)?.element.id).toBe("visible");
  });

  it("필드 종류와 다른 컨트롤은 매칭하지 않는다", () => {
    document.body.innerHTML = `
      <label>상품명 <input id="radio" type="radio" /></label>
      <label>상품명 <input id="checkbox" type="checkbox" /></label>
      <label>상품명 <select id="select"><option>A</option></select></label>
      <label>상품명 <input id="text" type="text" /></label>
    `;
    expect(findControl(document, titleSpec)?.element.id).toBe("text");
  });

  it("섹션 제목과 숨은 탭을 구분해 판매가 입력란을 찾는다", () => {
    document.body.innerHTML = `
      <div class="b-box__row">
        <div class="b-box__title"><strong class="c-title__text">판매가</strong></div>
        <div class="b-box__cont"><input id="salePrice" type="text" /></div>
      </div>
      <div class="b-box-sub" style="display:none">
        <div class="b-box-sub__row"><input id="usedPrice" type="text" aria-label="구입 당시 판매가" /></div>
      </div>
    `;
    const located = findControl(document, { key: "price", kind: "text" });
    expect(located?.element.id).toBe("salePrice");
  });

  it("라벨이 없으면 찾지 못한다", () => {
    document.body.innerHTML = `<input id="mystery" />`;
    expect(findControl(document, titleSpec)).toBeUndefined();
  });
});


describe("isSearchControl", () => {
  it("헤더·도움말 사이드바의 검색 입력란을 제외한다", () => {
    document.body.innerHTML = `
      <header><input id="header-search" placeholder="검색어를 입력해주세요." /></header>
      <aside id="help-center"><input id="help-search" /></aside>
      <main><input id="title" /></main>
    `;
    expect(isSearchControl(document.getElementById("header-search")!)).toBe(true);
    expect(isSearchControl(document.getElementById("help-search")!)).toBe(true);
    expect(isSearchControl(document.getElementById("title")!)).toBe(false);
  });

  it("검색 placeholder가 있는 입력란을 제외한다", () => {
    document.body.innerHTML = `
      <input id="search" placeholder="상품명, 브랜드, 쿠팡 상품ID, 상품 키워드, URL로 검색" />
      <input id="title" placeholder="상품명을 입력해주세요." />
    `;
    expect(isSearchControl(document.getElementById("search")!)).toBe(true);
    expect(isSearchControl(document.getElementById("title")!)).toBe(false);
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


describe("expandSections", () => {
  it("접힌 섹션을 펼쳐 입력란이 늘어나면 유지한다", async () => {
    document.body.innerHTML = `
      <div class="box__panel is-fold">
        <div class="box__panel-head">
          <span>상품 주요정보</span>
          <button class="button--open" type="button">Open</button>
        </div>
        <div class="content" style="display:none"><input id="origin" /></div>
      </div>
    `;
    const content = document.querySelector(".content") as HTMLElement;
    document.querySelector("button")?.addEventListener("click", () => {
      content.style.display = content.style.display === "none" ? "" : "none";
    });

    const actions = await expandSections(document, {
      selectors: ["button.button--open"],
      include: /상품 주요정보/
    });

    expect(content.style.display).not.toBe("none");
    expect(actions).toHaveLength(1);
  });
});

describe("sameOriginDocuments", () => {
  it("같은 출처 iframe 문서를 함께 수집한다", () => {
    document.body.innerHTML = `<iframe id="frame"></iframe>`;
    const frame = document.getElementById("frame") as HTMLIFrameElement;
    frame.contentDocument!.body.innerHTML = `<input id="inFrame" />`;

    const docs = sameOriginDocuments(document);

    expect(docs).toHaveLength(2);
    expect(docs[1].getElementById("inFrame")).toBeTruthy();
  });
});

describe("selectFormDocument", () => {
  it("컨트롤이 더 많은 같은 출처 iframe 문서를 고른다", () => {
    document.body.innerHTML = `<input id="top" /><iframe id="frame"></iframe>`;
    const frame = document.getElementById("frame") as HTMLIFrameElement;
    frame.contentDocument!.body.innerHTML = `<input id="a" /><input id="b" /><input id="c" />`;

    expect(selectFormDocument(document)).toBe(frame.contentDocument);
  });

  it("숨겨진 iframe의 입력란이 적으면 보이는 상위 문서를 유지한다", () => {
    document.body.innerHTML = `<input id="top" /><iframe id="frame" style="display:none"></iframe>`;
    const frame = document.getElementById("frame") as HTMLIFrameElement;
    frame.contentDocument!.body.innerHTML = `<input id="a" /><input id="b" />`;

    expect(selectFormDocument(document)).toBe(document);
  });

  it("숨겨진 iframe이라도 폼 입력란이 많으면 그 문서를 고른다", () => {
    document.body.innerHTML = `<input id="top" /><iframe id="frame" style="display:none"></iframe>`;
    const frame = document.getElementById("frame") as HTMLIFrameElement;
    frame.contentDocument!.body.innerHTML = Array.from(
      { length: 20 },
      (_, index) => `<input id="f${index}" />`
    ).join("");

    expect(selectFormDocument(document)).toBe(frame.contentDocument);
  });

  it("상위 문서에 입력란이 없으면 숨겨진 iframe의 폼을 고른다", () => {
    document.body.innerHTML = `<iframe id="frame" style="display:none"></iframe>`;
    const frame = document.getElementById("frame") as HTMLIFrameElement;
    frame.contentDocument!.body.innerHTML = `<input id="a" /><input id="b" />`;

    expect(selectFormDocument(document)).toBe(frame.contentDocument);
  });
});
