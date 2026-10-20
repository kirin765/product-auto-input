import type { FieldKey } from "../shared/labels";
import type { ValueFormat } from "../shared/fields";
import type { MarketId } from "../shared/product";

export type FieldKind =
  | "text"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "file"
  | "contenteditable"
  | "manual";

export interface FieldSpec {
  key: FieldKey;
  kind: FieldKind;
  /** 라벨 별칭. 비우면 FIELD_LABELS[key]를 사용한다. */
  labels?: string[];
  /** 실제 DOM이 확인된 경우에만 넣는다. 라벨 매칭보다 우선한다. */
  selectors?: string[];
  format?: ValueFormat;
  required?: boolean;
  note?: string;
}

export interface MarketplaceAdapter {
  id: MarketId;
  name: string;
  shortName: string;
  sellerCenter: string;
  createUrl: string;
  hosts: string[];
  urlPatterns: RegExp[];
  /** 실제 판매자 계정으로 DOM을 확인했는지. false면 셀렉터는 추정값이다. */
  verified: boolean;
  fields: FieldSpec[];
  requirements: string[];
  notes: string[];
}

export type FillStatus =
  | "filled"
  | "matched"
  | "not-found"
  | "manual"
  | "skipped"
  | "error";

export interface FieldResult {
  key: FieldKey;
  label: string;
  status: FillStatus;
  detail?: string;
}

export interface FillReport {
  adapterId: MarketId;
  adapterName: string;
  url: string;
  startedAt: string;
  dryRun: boolean;
  submitted: false;
  fields: FieldResult[];
  warnings: string[];
}

export interface FillOptions {
  dryRun?: boolean;
  root?: Document | HTMLElement;
}

export function matchesUrl(adapter: MarketplaceAdapter, url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!adapter.hosts.includes(parsed.hostname)) return false;
    const route = `${parsed.pathname}${parsed.hash}`;
    return adapter.urlPatterns.some((pattern) => pattern.test(route));
  } catch {
    return false;
  }
}
