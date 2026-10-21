import type { FieldKey } from "../shared/labels";
import type { ValueFormat } from "../shared/fields";
import type { CanonicalProduct, MarketId } from "../shared/product";

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

export interface PrepareResult {
  actions: string[];
}

export type PrepareFn = (root: Document) => Promise<PrepareResult>;

export interface PostFillResult {
  actions: string[];
  warnings: string[];
}

export type PostFillFn = (
  product: CanonicalProduct,
  root: Document
) => Promise<PostFillResult>;

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
  /** 등록 폼이 같은 출처 iframe 안에 있는 경우 true (11번가 등). */
  formInIframe?: boolean;
  /** 단계별로 입력해야 하는 마켓의 진행 순서. */
  steps?: string[];
  /** 폼 채우기 전에 안내 모달·진입 화면을 처리하는 커스텀 단계. */
  prepare?: PrepareFn;
  /** 기본 필드 입력 후 옵션 행·가격표를 채우는 커스텀 단계. */
  postFill?: PostFillFn;
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
