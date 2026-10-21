// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readXlsxRows, writeXlsx } from "../src/shared/xlsx";

describe("xlsx", () => {
  it("작성한 워크시트를 다시 읽는다", async () => {
    const rows = [
      ["상품명", "상세설명", "판매가"],
      ["온누리 텀블러", "첫 줄\n둘째 줄 & <tag>", "18900"]
    ];
    const bytes = writeXlsx(rows, "상품");

    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    await expect(readXlsxRows(bytes)).resolves.toEqual(rows);
  });

  it("빈 셀을 유지한다", async () => {
    const rows = [
      ["A", "B", "C"],
      ["1", "", "3"]
    ];
    await expect(readXlsxRows(writeXlsx(rows))).resolves.toEqual(rows);
  });
});
