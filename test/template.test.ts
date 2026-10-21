import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/shared/csv";
import {
  parseTemplateRows,
  parseTemplateValues,
  pathToColumn,
  templateCsv,
  templateRows,
  TEMPLATE_COLUMNS
} from "../src/shared/template";

describe("parseCsv", () => {
  it("따옴표, 쉼표, 줄바꿈, BOM을 처리한다", () => {
    const rows = parseCsv('\uFEFF상품명,상세설명\r\n"텀블러, 500ml","첫 줄\n둘째 줄"\r\n');
    expect(rows).toEqual([
      ["상품명", "상세설명"],
      ["텀블러, 500ml", "첫 줄\n둘째 줄"]
    ]);
  });
});

describe("fixed template", () => {
  it("템플릿 CSV를 표준 상품으로 읽는다", () => {
    const result = parseTemplateRows(parseCsv(templateCsv()));

    expect(result.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(result.product.title).toBe("온누리 스테인리스 텀블러 500ml");
    expect(result.product.price).toBe(18900);
    expect(result.product.stock).toBe(120);
    expect(result.product.categoryPath).toEqual(["생활/건강", "주방용품", "컵/텀블러"]);
    expect(result.product.images).toEqual([
      { url: "https://example.com/tumbler-main.jpg", type: "main" },
      { url: "https://example.com/tumbler-detail.jpg", type: "detail" }
    ]);
    expect(result.product.optionGroups).toEqual([
      { name: "색상", values: [{ name: "실버" }, { name: "블랙" }] }
    ]);
    expect(result.product.tags).toEqual(["텀블러", "보온병", "스테인리스"]);
    expect(result.product.shipping).toMatchObject({
      origin: "대한민국",
      method: "택배",
      fee: 3000,
      freeThreshold: 30000,
      returnFee: 3000
    });
  });

  it("필수 컬럼이 비면 오류를 보고한다", () => {
    const values = Object.fromEntries(TEMPLATE_COLUMNS.map((column) => [column.header, ""]));
    const result = parseTemplateValues(values);
    const messages = result.issues.map((issue) => issue.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        "상품명 값이 필요합니다.",
        "원산지 값이 필요합니다.",
        "판매가 값이 필요합니다.",
        "재고수량 값이 필요합니다.",
        "대표이미지 값이 필요합니다."
      ])
    );
  });

  it("숫자 컬럼의 잘못된 값을 오류로 잡는다", () => {
    const values: Record<string, string> = {
      상품명: "상품",
      원산지: "대한민국",
      판매가: "만원",
      재고수량: "10",
      대표이미지: "https://example.com/a.jpg"
    };
    const result = parseTemplateValues(values);
    expect(
      result.issues.some(
        (issue) => issue.column === "판매가" && issue.message.includes("숫자만")
      )
    ).toBe(true);
  });

  it("이미지 URL 형식을 검사한다", () => {
    const values: Record<string, string> = {
      상품명: "상품",
      원산지: "대한민국",
      판매가: "1000",
      재고수량: "1",
      대표이미지: "C:\\images\\a.jpg"
    };
    const result = parseTemplateValues(values);
    expect(
      result.issues.some(
        (issue) => issue.column === "대표이미지" && issue.severity === "error"
      )
    ).toBe(true);
  });

  it("2개 이상의 데이터 행을 거부한다", () => {
    const rows = templateRows();
    rows.push(rows[1]);
    const result = parseTemplateRows(rows);
    expect(result.issues.some((issue) => issue.message.includes("상품 1개만"))).toBe(true);
  });

  it("알 수 없는 컬럼은 경고만 하고 무시한다", () => {
    const rows = templateRows();
    rows[0].push("알 수 없는 컬럼");
    rows[1].push("값");
    const result = parseTemplateRows(rows);
    expect(result.unknownColumns).toEqual(["알 수 없는 컬럼"]);
    expect(result.issues.some((issue) => issue.message.includes("알 수 없는 컬럼"))).toBe(true);
    expect(result.product.title).toBe("온누리 스테인리스 텀블러 500ml");
  });

  it("정규화된 별칭 헤더를 허용한다", () => {
    const rows = [
      ["상품명", "제조국", "판매가", "재고", "대표이미지"],
      ["상품", "대한민국", "1000", "5", "https://example.com/a.jpg"]
    ];
    const result = parseTemplateRows(rows);
    expect(result.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(result.product.shipping.origin).toBe("대한민국");
  });

  it("검증 경로를 템플릿 컬럼으로 매핑한다", () => {
    expect(pathToColumn("title")).toBe("상품명");
    expect(pathToColumn("shipping.origin")).toBe("원산지");
    expect(pathToColumn("images")).toBe("대표이미지");
    expect(pathToColumn("unknown.path")).toBeUndefined();
  });
});
