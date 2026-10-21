import { normalizeLabel } from "./labels";
import { normalizeProduct, type CanonicalProduct, type ProductCondition, type TaxType } from "./product";
import { toCsv } from "./csv";
import { writeXlsx } from "./xlsx";

export type TemplateColumnKind = "text" | "longText" | "integer" | "imageList" | "list";

export interface TemplateColumn {
  header: string;
  required?: boolean;
  kind?: TemplateColumnKind;
  aliases?: string[];
  help?: string;
}

/**
 * 고정 가져오기 양식. 1개 상품 = 1개 데이터 행.
 * 헤더는 내려받는 템플릿과 동일하며, 공백/대소문자/괄호 표기는 관대하게 매칭한다.
 */
export const TEMPLATE_COLUMNS: TemplateColumn[] = [
  { header: "상품명", required: true, kind: "text" },
  { header: "브랜드", kind: "text" },
  { header: "제조사", kind: "text" },
  { header: "원산지", required: true, kind: "text", aliases: ["제조국"] },
  { header: "판매가", required: true, kind: "integer" },
  { header: "정가", kind: "integer" },
  { header: "재고수량", required: true, kind: "integer", aliases: ["재고"] },
  { header: "판매자상품코드", kind: "text", aliases: ["판매자 관리코드", "SKU"] },
  { header: "바코드", kind: "text" },
  { header: "상품상태", kind: "text", aliases: ["상태"] },
  { header: "과세구분", kind: "text", aliases: ["과세여부", "부가세"] },
  { header: "카테고리", kind: "text", aliases: ["카테고리경로"] },
  { header: "대표이미지", required: true, kind: "imageList", aliases: ["대표이미지URL"] },
  { header: "상세이미지", kind: "imageList", aliases: ["상세이미지URL"] },
  { header: "상세설명", kind: "longText" },
  { header: "배송방법", kind: "text" },
  { header: "배송비", kind: "integer" },
  { header: "무료배송기준", kind: "integer" },
  { header: "배송기간", kind: "text" },
  { header: "반품배송비", kind: "integer" },
  { header: "A/S안내", kind: "longText" },
  { header: "성인상품", kind: "text" },
  { header: "검색어", kind: "list", aliases: ["태그"] },
  { header: "옵션명", kind: "text" },
  { header: "옵션값", kind: "list" }
];

const HEADER_INDEX = new Map(
  TEMPLATE_COLUMNS.flatMap((column) =>
    [column.header, ...(column.aliases ?? [])].map((header) => [
      normalizeLabel(header),
      column.header
    ])
  )
);

const PATH_TO_COLUMN: Record<string, string> = {
  title: "상품명",
  brand: "브랜드",
  manufacturer: "제조사",
  "shipping.origin": "원산지",
  price: "판매가",
  originalPrice: "정가",
  stock: "재고수량",
  sku: "판매자상품코드",
  barcode: "바코드",
  condition: "상품상태",
  taxType: "과세구분",
  "shipping.method": "배송방법",
  "shipping.fee": "배송비",
  "shipping.freeThreshold": "무료배송기준",
  "shipping.deliveryDays": "배송기간",
  "shipping.returnFee": "반품배송비",
  asInfo: "A/S안내",
  detail: "상세설명",
  images: "대표이미지",
  categoryPath: "카테고리",
  adultOnly: "성인상품",
  tags: "검색어",
  optionGroups: "옵션명"
};

export function pathToColumn(path: string): string | undefined {
  return PATH_TO_COLUMN[path];
}

export interface TemplateIssue {
  column?: string;
  message: string;
  severity: "error" | "warning";
}

export interface TemplateResult {
  product: CanonicalProduct;
  values: Record<string, string>;
  issues: TemplateIssue[];
  unknownColumns: string[];
  rowCount: number;
}

const SAMPLE_ROW: Record<string, string> = {
  상품명: "온누리 스테인리스 텀블러 500ml",
  브랜드: "온누리",
  제조사: "온누리공방",
  원산지: "대한민국",
  판매가: "18900",
  정가: "25000",
  재고수량: "120",
  판매자상품코드: "ONN-TMB-500",
  바코드: "8801234567890",
  상품상태: "새상품",
  과세구분: "과세",
  카테고리: "생활/건강 > 주방용품 > 컵/텀블러",
  대표이미지: "https://example.com/tumbler-main.jpg",
  상세이미지: "https://example.com/tumbler-detail.jpg",
  상세설명: "이중 진공 구조로 보온·보냉이 오래가는 500ml 스테인리스 텀블러입니다.",
  배송방법: "택배",
  배송비: "3000",
  무료배송기준: "30000",
  배송기간: "1~2일",
  반품배송비: "3000",
  "A/S안내": "구매 후 1년 무상 A/S",
  성인상품: "N",
  검색어: "텀블러,보온병,스테인리스",
  옵션명: "색상",
  옵션값: "실버,블랙"
};

export function templateRows(): string[][] {
  const headers = TEMPLATE_COLUMNS.map((column) => column.header);
  return [headers, headers.map((header) => SAMPLE_ROW[header] ?? "")];
}

export function templateCsv(): string {
  return `\uFEFF${toCsv(templateRows())}`;
}

export function templateXlsx(): Uint8Array {
  return writeXlsx(templateRows(), "상품");
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseInteger(
  column: string,
  value: string,
  issues: TemplateIssue[]
): number | undefined {
  if (value === "") return undefined;
  const cleaned = value.replace(/[\s,원]/g, "");
  if (!/^-?\d+$/.test(cleaned)) {
    issues.push({
      column,
      message: `${column}은(는) 숫자만 입력하세요.`,
      severity: "error"
    });
    return undefined;
  }
  return Number(cleaned);
}

function parseUrlList(
  column: string,
  value: string,
  issues: TemplateIssue[]
): string[] {
  const urls = splitList(value);
  for (const url of urls) {
    if (!/^https?:\/\//i.test(url)) {
      issues.push({
        column,
        message: `${column} URL은 http:// 또는 https://로 시작해야 합니다: ${url}`,
        severity: "error"
      });
    }
  }
  return urls;
}

function parseCondition(
  column: string,
  value: string,
  issues: TemplateIssue[]
): ProductCondition {
  const normalized = value.toLowerCase();
  if (normalized === "" || ["새상품", "신상품", "신품", "new"].includes(normalized)) {
    return "new";
  }
  if (["리퍼", "리퍼비시", "refurbished"].includes(normalized)) return "refurbished";
  if (["중고", "used"].includes(normalized)) return "used";
  issues.push({
    column,
    message: `${column}은(는) 새상품/리퍼비시/중고 중 하나로 입력하세요.`,
    severity: "error"
  });
  return "new";
}

function parseTax(
  column: string,
  value: string,
  issues: TemplateIssue[]
): TaxType {
  const normalized = value.toLowerCase();
  if (normalized === "" || ["과세", "과세상품", "taxable"].includes(normalized)) {
    return "taxable";
  }
  if (["면세", "면세상품", "taxfree", "tax-free"].includes(normalized)) return "taxFree";
  issues.push({
    column,
    message: `${column}은(는) 과세/면세 중 하나로 입력하세요.`,
    severity: "error"
  });
  return "taxable";
}

function parseAdult(value: string, issues: TemplateIssue[]): boolean {
  const normalized = value.trim().toLowerCase();
  if (["", "n", "no", "아니오", "false", "0"].includes(normalized)) return false;
  if (["y", "yes", "예", "true", "1", "성인"].includes(normalized)) return true;
  issues.push({
    column: "성인상품",
    message: "성인상품은 Y 또는 N으로 입력하세요.",
    severity: "error"
  });
  return false;
}

function buildProduct(values: Record<string, string>, issues: TemplateIssue[]): CanonicalProduct {
  const images = [
    ...parseUrlList("대표이미지", values["대표이미지"] ?? "", issues).map((url) => ({
      url,
      type: "main" as const
    })),
    ...parseUrlList("상세이미지", values["상세이미지"] ?? "", issues).map((url) => ({
      url,
      type: "detail" as const
    }))
  ];

  const optionName = (values["옵션명"] ?? "").trim();
  const optionValues = splitList(values["옵션값"] ?? "");
  if (optionName && optionValues.length === 0) {
    issues.push({
      column: "옵션값",
      message: "옵션명을 입력했다면 옵션값도 입력하세요.",
      severity: "warning"
    });
  }
  if (!optionName && optionValues.length > 0) {
    issues.push({
      column: "옵션명",
      message: "옵션값만 입력되었습니다. 옵션명을 입력하세요.",
      severity: "warning"
    });
  }

  const categoryPath = (values["카테고리"] ?? "")
    .split(">")
    .map((item) => item.trim())
    .filter(Boolean);

  const raw = {
    title: values["상품명"] ?? "",
    brand: values["브랜드"],
    manufacturer: values["제조사"],
    categoryPath,
    price: parseInteger("판매가", values["판매가"] ?? "", issues),
    originalPrice: parseInteger("정가", values["정가"] ?? "", issues),
    stock: parseInteger("재고수량", values["재고수량"] ?? "", issues),
    sku: values["판매자상품코드"],
    barcode: values["바코드"],
    condition: parseCondition("상품상태", values["상품상태"] ?? "", issues),
    taxType: parseTax("과세구분", values["과세구분"] ?? "", issues),
    adultOnly: parseAdult(values["성인상품"] ?? "", issues),
    images,
    detailText: values["상세설명"],
    optionGroups: optionName
      ? [{ name: optionName, values: optionValues.map((name) => ({ name })) }]
      : [],
    shipping: {
      origin: values["원산지"],
      method: values["배송방법"],
      fee: parseInteger("배송비", values["배송비"] ?? "", issues),
      freeThreshold: parseInteger("무료배송기준", values["무료배송기준"] ?? "", issues),
      deliveryDays: values["배송기간"],
      returnFee: parseInteger("반품배송비", values["반품배송비"] ?? "", issues)
    },
    asInfo: values["A/S안내"],
    tags: splitList(values["검색어"] ?? "")
  };

  return normalizeProduct(raw);
}

function buildResult(
  values: Record<string, string>,
  issues: TemplateIssue[],
  unknownColumns: string[],
  rowCount: number
): TemplateResult {
  for (const column of TEMPLATE_COLUMNS) {
    if (column.required && (values[column.header] ?? "").trim() === "") {
      issues.push({
        column: column.header,
        message: `${column.header} 값이 필요합니다.`,
        severity: "error"
      });
    }
  }

  return {
    product: buildProduct(values, issues),
    values,
    issues,
    unknownColumns,
    rowCount
  };
}

export function parseTemplateValues(values: Record<string, string>): TemplateResult {
  return buildResult({ ...values }, [], [], 1);
}

export function parseTemplateRows(rows: string[][]): TemplateResult {
  const nonEmpty = rows.filter((row) => row.some((cell) => cell.trim() !== ""));
  const issues: TemplateIssue[] = [];
  const unknownColumns: string[] = [];

  if (nonEmpty.length === 0) {
    issues.push({ message: "파일에 데이터가 없습니다.", severity: "error" });
    return buildResult({}, issues, unknownColumns, 0);
  }

  const headers = nonEmpty[0];
  const values: Record<string, string> = {};
  const seen = new Set<string>();

  headers.forEach((rawHeader, index) => {
    const header = HEADER_INDEX.get(normalizeLabel(rawHeader));
    if (!header) {
      if (rawHeader.trim()) unknownColumns.push(rawHeader.trim());
      return;
    }
    if (seen.has(header)) {
      issues.push({
        column: header,
        message: `헤더가 중복됩니다: ${header}`,
        severity: "warning"
      });
      return;
    }
    seen.add(header);
    values[header] = (nonEmpty[1]?.[index] ?? "").trim();
  });

  const missingHeaders = TEMPLATE_COLUMNS.filter(
    (column) => column.required && !headers.some((header) => HEADER_INDEX.get(normalizeLabel(header)) === column.header)
  ).map((column) => column.header);
  if (missingHeaders.length > 0) {
    issues.push({
      message: `템플릿에 필요한 헤더가 없습니다: ${missingHeaders.join(", ")}`,
      severity: "error"
    });
  }

  const dataRows = nonEmpty.slice(1);
  if (dataRows.length === 0) {
    issues.push({ message: "헤더 아래에 상품 데이터 행이 없습니다.", severity: "error" });
  } else if (dataRows.length > 1) {
    issues.push({
      message: `한 파일에는 상품 1개만 넣을 수 있습니다(현재 ${dataRows.length}개 행).`,
      severity: "error"
    });
  }

  if (unknownColumns.length > 0) {
    issues.push({
      message: `알 수 없는 컬럼은 무시했습니다: ${unknownColumns.join(", ")}`,
      severity: "warning"
    });
  }

  return buildResult(values, issues, unknownColumns, dataRows.length);
}
