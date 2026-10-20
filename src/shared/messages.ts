import type { FieldKey } from "./labels";
import type { FillReport } from "../adapters/types";
import type { MarketId } from "./product";

export interface ScanField {
  label: string;
  key?: FieldKey;
  kind: "text" | "textarea" | "select" | "radio" | "checkbox" | "file" | "contenteditable" | "password";
  name?: string;
  id?: string;
  required: boolean;
}

export type RequestMessage =
  | { type: "PING" }
  | { type: "SCAN"; adapterId?: MarketId }
  | {
      type: "PREFILL";
      adapterId: MarketId;
      product: unknown;
      dryRun?: boolean;
    };

export interface PingResponse {
  ok: true;
  adapterId: MarketId | null;
  href: string;
}

export interface ScanResponse {
  ok: true;
  adapterId: MarketId | null;
  fields: ScanField[];
  warning?: string;
}

export interface PrefillResponse {
  ok: boolean;
  report?: FillReport;
  error?: string;
}

export type ResponseMessage = PingResponse | ScanResponse | PrefillResponse;
