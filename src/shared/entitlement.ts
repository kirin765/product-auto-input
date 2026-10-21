import {
  entitlementOfflineValid,
  parseEntitlementToken,
  type EntitlementResponse
} from "../../shared/schema";
import { ENTITLEMENT_CACHE_MS } from "./config";

export type CachedEntitlement = {
  entitlement: EntitlementResponse;
  token: string | null;
  fetchedAt: number;
};

/** Refresh when the cache is older than 24h or the offline token expired. */
export function shouldRefresh(cache: CachedEntitlement | null, now = Date.now()): boolean {
  if (!cache) return true;
  if (now - cache.fetchedAt > ENTITLEMENT_CACHE_MS) return true;
  const token = parseEntitlementToken(cache.token);
  if (!token) return true;
  return Date.parse(token.localUntil) <= now;
}

/**
 * Offline access decision. Paid access is honored from the bounded entitlement
 * token until expiry; after expiry new fills pause while local drafts remain.
 */
export function localPaidAccess(
  cache: CachedEntitlement | null,
  now = Date.now()
): { active: boolean; plan: "free" | "paid"; reason: string } {
  if (!cache) return { active: false, plan: "free", reason: "no_cache" };
  const token = parseEntitlementToken(cache.token);
  if (entitlementOfflineValid(token, now)) {
    return { active: true, plan: "paid", reason: "offline_token" };
  }
  const expires = Date.parse(cache.entitlement.localUntil);
  if (cache.entitlement.active && Number.isFinite(expires) && expires > now) {
    return { active: true, plan: "paid", reason: "cache" };
  }
  return { active: false, plan: "free", reason: "expired" };
}

export function applyServerEntitlement(
  entitlement: EntitlementResponse,
  token: string | null,
  now = Date.now()
): CachedEntitlement {
  return { entitlement, token, fetchedAt: now };
}
