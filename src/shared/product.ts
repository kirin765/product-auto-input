export const SCHEMA_VERSION = 1 as const;

export type MarketId =
  | "smartstore"
  | "coupang"
  | "gmarket"
  | "auction"
  | "elevenst"
  | "zigzag"
  | "ably";

export type ImageType = "main" | "detail" | "option";
export type ProductCondition = "new" | "refurbished" | "used";
export type TaxType = "taxable" | "taxFree";

export interface ProductImage {
  url: string;
  type: ImageType;
  alt?: string;
}

export interface OptionValue {
  name: string;
  extraPrice?: number;
  stock?: number;
  sku?: string;
  imageUrl?: string;
}

export interface OptionGroup {
  name: string;
  values: OptionValue[];
}

export interface Variant {
  sku?: string;
  options: Record<string, string>;
  price?: number;
  stock?: number;
}

export interface Shipping {
  origin?: string;
  method?: string;
  fee?: number;
  freeThreshold?: number;
  deliveryDays?: string;
  company?: string;
  returnFee?: number;
  exchangeFee?: number;
}

export interface CanonicalProduct {
  schemaVersion: typeof SCHEMA_VERSION;
  source?: {
    url?: string;
    marketplace?: string;
    productId?: string;
  };
  title: string;
  brand?: string;
  manufacturer?: string;
  supplier?: string;
  categoryPath: string[];
  categoryCodes: Partial<Record<MarketId, string>>;
  price: number;
  originalPrice?: number;
  currency: "KRW";
  stock: number;
  sku?: string;
  barcode?: string;
  condition: ProductCondition;
  taxType: TaxType;
  adultOnly: boolean;
  images: ProductImage[];
  detailHtml?: string;
  detailText?: string;
  optionGroups: OptionGroup[];
  variants: Variant[];
  shipping: Shipping;
  notice: Record<string, string>;
  asInfo?: string;
  tags: string[];
  searchKeywords: string[];
  createdAt?: string;
  updatedAt?: string;
}

type Input = Record<string, unknown>;

const CONDITION_VALUES: ProductCondition[] = ["new", "refurbished", "used"];
const TAX_VALUES: TaxType[] = ["taxable", "taxFree"];
const CONDITION_ALIASES: Record<string, ProductCondition> = {
  새상품: "new",
  신상품: "new",
  신품: "new",
  new: "new",
  리퍼: "refurbished",
  리퍼비시: "refurbished",
  refurbished: "refurbished",
  중고: "used",
  used: "used"
};
const TAX_ALIASES: Record<string, TaxType> = {
  과세: "taxable",
  taxable: "taxable",
  면세: "taxFree",
  taxfree: "taxFree",
  "tax-free": "taxFree"
};

function isRecord(value: unknown): value is Input {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toInt(value: unknown, fallback: number): number {
  const parsed = toNumber(value);
  return parsed === undefined ? fallback : Math.round(parsed);
}

function strList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => str(item)).filter((item): item is string => Boolean(item));
  }
  const single = str(value);
  if (!single) return [];
  return single
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pathList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => str(item)).filter((item): item is string => Boolean(item));
  }
  const single = str(value);
  if (!single) return [];
  return single
    .split(/>|\s\/\s|\//)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeImages(value: unknown): ProductImage[] {
  if (!Array.isArray(value)) return [];
  const images: ProductImage[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      images.push({ url: item.trim(), type: images.length === 0 ? "main" : "detail" });
      continue;
    }
    if (!isRecord(item)) continue;
    const url = str(item.url) ?? str(item.src);
    if (!url) continue;
    const type = str(item.type);
    images.push({
      url,
      type: type === "detail" || type === "option" ? type : "main",
      ...(str(item.alt) ? { alt: str(item.alt) } : {})
    });
  }
  return images;
}

function normalizeOptionGroups(value: unknown): OptionGroup[] {
  if (!Array.isArray(value)) return [];
  const groups: OptionGroup[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const name = str(item.name);
    if (!name) continue;
    const rawValues = Array.isArray(item.values) ? item.values : [];
    const values: OptionValue[] = [];
    for (const raw of rawValues) {
      if (typeof raw === "string") {
        if (raw.trim()) values.push({ name: raw.trim() });
        continue;
      }
      if (!isRecord(raw)) continue;
      const valueName = str(raw.name);
      if (!valueName) continue;
      values.push({
        name: valueName,
        ...(toNumber(raw.extraPrice) !== undefined ? { extraPrice: toNumber(raw.extraPrice) } : {}),
        ...(toNumber(raw.stock) !== undefined ? { stock: toNumber(raw.stock) } : {}),
        ...(str(raw.sku) ? { sku: str(raw.sku) } : {}),
        ...(str(raw.imageUrl) ? { imageUrl: str(raw.imageUrl) } : {})
      });
    }
    if (values.length > 0) groups.push({ name, values });
  }
  return groups;
}

function normalizeVariants(value: unknown): Variant[] {
  if (!Array.isArray(value)) return [];
  const variants: Variant[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const options: Record<string, string> = {};
    if (isRecord(item.options)) {
      for (const [key, raw] of Object.entries(item.options)) {
        const optionValue = str(raw);
        if (optionValue) options[key] = optionValue;
      }
    }
    variants.push({
      options,
      ...(str(item.sku) ? { sku: str(item.sku) } : {}),
      ...(toNumber(item.price) !== undefined ? { price: toNumber(item.price) } : {}),
      ...(toNumber(item.stock) !== undefined ? { stock: toNumber(item.stock) } : {})
    });
  }
  return variants;
}

function normalizeShipping(value: unknown): Shipping {
  const raw = isRecord(value) ? value : {};
  const shipping: Shipping = {};
  const origin = str(raw.origin) ?? str(raw.originCountry);
  const method = str(raw.method);
  const company = str(raw.company);
  const deliveryDays = str(raw.deliveryDays) ?? str(raw.delivery);
  if (origin) shipping.origin = origin;
  if (method) shipping.method = method;
  if (company) shipping.company = company;
  if (deliveryDays) shipping.deliveryDays = deliveryDays;
  const fee = toNumber(raw.fee);
  const freeThreshold = toNumber(raw.freeThreshold);
  const returnFee = toNumber(raw.returnFee);
  const exchangeFee = toNumber(raw.exchangeFee);
  if (fee !== undefined) shipping.fee = Math.max(0, fee);
  if (freeThreshold !== undefined) shipping.freeThreshold = Math.max(0, freeThreshold);
  if (returnFee !== undefined) shipping.returnFee = Math.max(0, returnFee);
  if (exchangeFee !== undefined) shipping.exchangeFee = Math.max(0, exchangeFee);
  return shipping;
}

function normalizeNotice(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const notice: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    const item = str(raw);
    if (item) notice[key] = item;
  }
  return notice;
}

function normalizeCategoryCodes(value: unknown): Partial<Record<MarketId, string>> {
  if (!isRecord(value)) return {};
  const codes: Partial<Record<MarketId, string>> = {};
  for (const [key, raw] of Object.entries(value)) {
    const code = str(raw);
    if (code) codes[key as MarketId] = code;
  }
  return codes;
}

/**
 * 입력 JSON을 표준 상품 모델로 정규화한다. 알 수 없는 필드는 버리고,
 * 숫자/불리언/배열 표기는 관대하게 받아들인다(공급사 CSV·크롤러 출력 대응).
 */
export function normalizeProduct(input: unknown): CanonicalProduct {
  const raw = isRecord(input) ? input : {};
  const source = isRecord(raw.source) ? raw.source : {};
  const conditionRaw = str(raw.condition)?.toLowerCase() ?? "";
  const taxRaw = str(raw.taxType)?.toLowerCase() ?? "";

  return {
    schemaVersion: SCHEMA_VERSION,
    title: str(raw.title) ?? str(raw.name) ?? str(raw.productName) ?? "",
    ...(str(raw.brand) ? { brand: str(raw.brand) } : {}),
    ...(str(raw.manufacturer) ? { manufacturer: str(raw.manufacturer) } : {}),
    ...(str(raw.supplier) ? { supplier: str(raw.supplier) } : {}),
    categoryPath: pathList(raw.categoryPath ?? raw.category),
    categoryCodes: normalizeCategoryCodes(raw.categoryCodes),
    price: Math.max(0, toInt(raw.price ?? raw.salePrice, 0)),
    ...(toNumber(raw.originalPrice) !== undefined
      ? { originalPrice: Math.max(0, Math.round(toNumber(raw.originalPrice) as number)) }
      : {}),
    currency: "KRW",
    stock: Math.max(0, toInt(raw.stock ?? raw.quantity, 0)),
    ...(str(raw.sku) ? { sku: str(raw.sku) } : {}),
    ...(str(raw.barcode) ? { barcode: str(raw.barcode) } : {}),
    condition: CONDITION_ALIASES[conditionRaw] ?? (CONDITION_VALUES.includes(conditionRaw as ProductCondition) ? (conditionRaw as ProductCondition) : "new"),
    taxType: TAX_ALIASES[taxRaw] ?? (TAX_VALUES.includes(taxRaw as TaxType) ? (taxRaw as TaxType) : "taxable"),
    adultOnly: raw.adultOnly === true || raw.adultOnly === "true" || raw.adultOnly === "Y",
    images: normalizeImages(raw.images),
    ...(str(raw.detailHtml) ? { detailHtml: str(raw.detailHtml) } : {}),
    ...(str(raw.detailText) ? { detailText: str(raw.detailText) } : {}),
    optionGroups: normalizeOptionGroups(raw.optionGroups ?? raw.options),
    variants: normalizeVariants(raw.variants),
    shipping: normalizeShipping(raw.shipping ?? raw.delivery),
    notice: normalizeNotice(raw.notice ?? raw.productNotice),
    ...(str(raw.asInfo) ? { asInfo: str(raw.asInfo) } : {}),
    tags: strList(raw.tags),
    searchKeywords: strList(raw.searchKeywords ?? raw.keywords),
    ...(str(raw.createdAt) ? { createdAt: str(raw.createdAt) } : {}),
    ...(str(raw.updatedAt) ? { updatedAt: str(raw.updatedAt) } : {}),
    ...(str(source.url) || str(source.marketplace) || str(source.productId)
      ? {
          source: {
            ...(str(source.url) ? { url: str(source.url) } : {}),
            ...(str(source.marketplace) ? { marketplace: str(source.marketplace) } : {}),
            ...(str(source.productId) ? { productId: str(source.productId) } : {})
          }
        }
      : {})
  };
}

export function emptyProduct(): CanonicalProduct {
  return normalizeProduct({
    title: "",
    price: 0,
    stock: 0,
    images: [],
    shipping: { origin: "대한민국" }
  });
}

export function sampleProduct(): CanonicalProduct {
  return normalizeProduct({
    title: "온누리 스테인리스 텀블러 500ml",
    brand: "온누리",
    manufacturer: "온누리공방",
    supplier: "온누리공방",
    categoryPath: ["생활/건강", "주방용품", "컵/텀블러"],
    price: 18900,
    originalPrice: 25000,
    stock: 120,
    sku: "ONN-TMB-500",
    barcode: "8801234567890",
    condition: "new",
    taxType: "taxable",
    images: [
      { url: "https://example.com/tumbler-main.jpg", type: "main" },
      { url: "https://example.com/tumbler-detail.jpg", type: "detail" }
    ],
    detailText: "이중 진공 구조로 보온·보냉이 오래가는 500ml 스테인리스 텀블러입니다.",
    optionGroups: [
      {
        name: "색상",
        values: [
          { name: "실버", stock: 60, sku: "ONN-TMB-500-SV" },
          { name: "블랙", stock: 60, sku: "ONN-TMB-500-BK" }
        ]
      }
    ],
    shipping: {
      origin: "대한민국",
      method: "택배",
      fee: 3000,
      freeThreshold: 30000,
      deliveryDays: "1~2일",
      company: "CJ대한통운"
    },
    notice: {
      품목: "텀블러",
      재질: "스테인리스",
      크기: "500ml",
      제조자: "온누리공방"
    },
    tags: ["텀블러", "보온병", "스테인리스"],
    searchKeywords: ["텀블러", "보온 텀블러"]
  });
}

export function parseProductInput(text: string): CanonicalProduct {
  const parsed: unknown = JSON.parse(text);
  const product = isRecord(parsed) && isRecord(parsed.product) ? parsed.product : parsed;
  return normalizeProduct(product);
}

export function productToJson(product: CanonicalProduct): string {
  return JSON.stringify(product, null, 2);
}
