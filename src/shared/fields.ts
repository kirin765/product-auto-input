import type { CanonicalProduct } from "./product";
import type { FieldKey } from "./labels";

export type ValueFormat = "plain" | "comma" | "won";

export type FieldValue = string | string[] | boolean | undefined;

const CONDITION_TEXT = {
  new: "새상품",
  refurbished: "리퍼비시",
  used: "중고"
} as const;

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getFieldValue(
  product: CanonicalProduct,
  key: FieldKey
): FieldValue {
  switch (key) {
    case "title":
      return product.title;
    case "brand":
      return product.brand;
    case "manufacturer":
      return product.manufacturer;
    case "supplier":
      return product.supplier;
    case "origin":
      return product.shipping.origin;
    case "price":
      return String(product.price);
    case "originalPrice":
      return product.originalPrice === undefined ? undefined : String(product.originalPrice);
    case "stock":
      return String(product.stock);
    case "sku":
      return product.sku;
    case "barcode":
      return product.barcode;
    case "condition":
      return CONDITION_TEXT[product.condition];
    case "taxType":
      return product.taxType === "taxFree" ? "면세" : "과세";
    case "category":
      return product.categoryPath.length > 0 ? product.categoryPath.join(" > ") : undefined;
    case "tags":
      return product.tags.length > 0 ? product.tags.join(",") : undefined;
    case "detail":
      return product.detailText ?? (product.detailHtml ? stripHtml(product.detailHtml) : undefined);
    case "asInfo":
      return product.asInfo;
    case "deliveryFee":
      return product.shipping.fee === undefined ? undefined : String(product.shipping.fee);
    case "deliveryMethod":
      return product.shipping.method;
    case "deliveryDays":
      return product.shipping.deliveryDays;
    case "returnFee":
      return product.shipping.returnFee === undefined ? undefined : String(product.shipping.returnFee);
    case "adultOnly":
      return product.adultOnly;
    case "mainImages":
      return product.images.filter((image) => image.type === "main").map((image) => image.url);
    case "detailImages":
      return product.images.filter((image) => image.type === "detail").map((image) => image.url);
    case "optionNames":
      return product.optionGroups.length > 0
        ? product.optionGroups.map((group) => group.name).join(",")
        : undefined;
    case "optionValues":
      return product.optionGroups.length > 0
        ? product.optionGroups.map((group) => group.values.map((value) => value.name).join(",")).join("|")
        : undefined;
  }
}

export function formatValue(value: string, format: ValueFormat): string {
  if (format === "plain") return value;
  const numeric = Number(value.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numeric)) return value;
  if (format === "comma") return numeric.toLocaleString("ko-KR");
  return `${numeric.toLocaleString("ko-KR")}원`;
}
