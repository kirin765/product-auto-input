/**
 * Product account and billing endpoints. Change PRODUCT_ORIGIN together with
 * public/manifest.json host_permissions.
 */
export const PRODUCT_ORIGIN = "https://product-auto-input.onnurimun.com";

export const API = {
  linkStart: `${PRODUCT_ORIGIN}/api/extension/link/start`,
  linkRedeem: `${PRODUCT_ORIGIN}/api/extension/link/redeem`,
  linkStatus: `${PRODUCT_ORIGIN}/api/link/status`,
  entitlement: `${PRODUCT_ORIGIN}/api/entitlement`,
  checkout: `${PRODUCT_ORIGIN}/api/billing/checkout`,
  portal: `${PRODUCT_ORIGIN}/api/billing/portal`
} as const;

export const ACCOUNT_PAGE = `${PRODUCT_ORIGIN}/account`;
export const PRICING_PAGE = `${PRODUCT_ORIGIN}/pricing`;

/** chrome.storage.local keys. Keep every key prefixed with `pai_`. */
export const STORAGE_KEYS = {
  auth: "pai_auth",
  entitlement: "pai_entitlement",
  dailyUsage: "pai_daily_usage"
} as const;

/** Entitlement cache lifetime (at most 24h, never past the paid/grace deadline). */
export const ENTITLEMENT_CACHE_MS = 24 * 60 * 60 * 1000;
