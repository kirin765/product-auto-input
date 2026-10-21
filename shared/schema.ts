/**
 * Versioned contracts shared by the extension and the product backend.
 *
 * This module must stay dependency-free (plain TypeScript) so it can be bundled
 * into the MV3 extension and imported by the Node backend without a build-order
 * dependency.
 */

export const SCHEMA_VERSION = 1 as const;
export const APP_VERSION = "0.1.0";

// ---------------------------------------------------------------------------
// Free / paid limits
// ---------------------------------------------------------------------------

/** Free accounts may fill forms this many times per local calendar day. */
export const FREE_DAILY_FILLS = 5;

export type PlanId = "free" | "paid";

/** Paid accounts are not capped locally. */
export function fillLimitForPlan(plan: PlanId): number {
  return plan === "paid" ? Number.POSITIVE_INFINITY : FREE_DAILY_FILLS;
}

// ---------------------------------------------------------------------------
// Backend API (extension <-> product server)
// ---------------------------------------------------------------------------

export type LinkStartRequest = { challenge: string; installId: string };
export type LinkStartResponse = { requestId: string; verificationUrl: string; expiresAt: string };

export type LinkRedeemRequest = {
  requestId: string;
  challenge: string;
  verifier: string;
  installId: string;
};
export type LinkRedeemResponse = {
  token: string;
  expiresAt: string;
  accountEmail: string | null;
};

export type EntitlementResponse = {
  active: boolean;
  plan: PlanId;
  status: string;
  /** End of the currently paid period (ISO) or null for free. */
  paidUntil: string | null;
  /** End of the recovery grace window (ISO) or null. */
  graceUntil: string | null;
  revoked: boolean;
  revokeReason: string | null;
  /** Opaque, offline-honorable token; the extension trusts it until expiry. */
  localUntil: string;
  checkedAt: string;
};

export type CheckoutRequest = { priceId?: string };
export type CheckoutResponse = { url: string; transactionId: string | null };

export type PortalResponse = { url: string };

export type ApiError = { error: { code: string; message: string } };

// ---------------------------------------------------------------------------
// Pure entitlement evaluation (shared by server and tests)
// ---------------------------------------------------------------------------

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "completed"
  | "paid"
  | "canceled"
  | "paused"
  | "inactive";

const ACTIVE_STATUSES = new Set<SubscriptionStatus>(["trialing", "active", "completed", "paid"]);

export function isActiveSubscriptionStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(String(status).trim().toLowerCase() as SubscriptionStatus);
}

export type AccessInput = {
  now: number;
  status: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  /** Milliseconds of grace after the paid period ends on a failed renewal. */
  graceMs: number;
  /** True when a confirmed full refund / chargeback revoked the current period. */
  revoked: boolean;
};

export type AccessDecision = {
  active: boolean;
  plan: PlanId;
  /** true when new work must pause but existing local output remains available. */
  grace: boolean;
  reason: string;
};

/**
 * Derive access from the paid period, subscription status, grace deadline and
 * persisted revocations together. A revocation always wins over a replayed
 * active status.
 */
export function evaluateAccess(input: AccessInput): AccessDecision {
  if (input.revoked) {
    return { active: false, plan: "free", grace: false, reason: "revoked" };
  }
  const status = String(input.status).trim().toLowerCase();
  if (status === "past_due") {
    const deadline = (input.currentPeriodEnd ?? 0) + input.graceMs;
    if (input.currentPeriodEnd != null && input.now <= deadline) {
      return { active: true, plan: "paid", grace: true, reason: "past_due_grace" };
    }
    return { active: false, plan: "free", grace: false, reason: "past_due_expired" };
  }
  if (isActiveSubscriptionStatus(status)) {
    if (input.currentPeriodEnd != null && input.now > input.currentPeriodEnd + input.graceMs) {
      return { active: false, plan: "free", grace: false, reason: "period_expired" };
    }
    return { active: true, plan: "paid", grace: false, reason: status };
  }
  return { active: false, plan: "free", grace: false, reason: status || "inactive" };
}

// ---------------------------------------------------------------------------
// Bounded offline entitlement token
// ---------------------------------------------------------------------------

export type SignedEntitlement = {
  active: boolean;
  plan: PlanId;
  localUntil: string;
  accountEmail: string | null;
  issuedAt: string;
};

/**
 * The extension cannot verify the HMAC (no shared secret in a distributed
 * client) so it treats the token as an opaque voucher and only checks that the
 * embedded expiry has not passed.
 */
export function parseEntitlementToken(token: string | null): SignedEntitlement | null {
  if (!token) return null;
  try {
    const json = JSON.parse(atob(token));
    if (!json || typeof json !== "object") return null;
    const localUntil = String((json as SignedEntitlement).localUntil ?? "");
    if (!localUntil || Number.isNaN(Date.parse(localUntil))) return null;
    return {
      active: Boolean((json as SignedEntitlement).active),
      plan: (json as SignedEntitlement).plan === "paid" ? "paid" : "free",
      localUntil,
      accountEmail: (json as SignedEntitlement).accountEmail ?? null,
      issuedAt: String((json as SignedEntitlement).issuedAt ?? "")
    };
  } catch {
    return null;
  }
}

/** Honor a stored token only while it has not expired (offline path). */
export function entitlementOfflineValid(
  token: SignedEntitlement | null,
  now = Date.now()
): boolean {
  if (!token) return false;
  return token.active && Date.parse(token.localUntil) > now;
}
