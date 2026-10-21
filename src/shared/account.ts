import type { EntitlementResponse } from "../../shared/schema";
import { API, STORAGE_KEYS } from "./config";
import { applyServerEntitlement, type CachedEntitlement } from "./entitlement";

/** chrome.storage.local account/link state. */
export type StoredAuth = {
  token: string | null;
  tokenExpiresAt: string | null;
  email: string | null;
  installId: string;
  requestId: string | null;
  verifier: string | null;
};

export type AccountState = {
  connected: boolean;
  pending: boolean;
  email: string | null;
  tokenExpiresAt: string | null;
};

function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base64url(arr);
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loadAuth(): Promise<StoredAuth> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.auth);
  const stored = (data[STORAGE_KEYS.auth] as Partial<StoredAuth>) ?? {};
  return {
    token: stored.token ?? null,
    tokenExpiresAt: stored.tokenExpiresAt ?? null,
    email: stored.email ?? null,
    installId: stored.installId ?? randomToken(16),
    requestId: stored.requestId ?? null,
    verifier: stored.verifier ?? null
  };
}

async function saveAuth(auth: StoredAuth): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.auth]: auth });
}

export async function getAccount(): Promise<AccountState> {
  const auth = await loadAuth();
  await saveAuth(auth);
  const connected = Boolean(auth.token) && (!auth.tokenExpiresAt || Date.parse(auth.tokenExpiresAt) > Date.now());
  return {
    connected,
    pending: !connected && Boolean(auth.requestId && auth.verifier),
    email: auth.email,
    tokenExpiresAt: auth.tokenExpiresAt
  };
}

/**
 * Begin the account-link flow. Only SHA-256(verifier) is sent at start; the raw
 * verifier is sent once at redeem. The user approves on the product website.
 */
export async function startLink(): Promise<{ verificationUrl: string; requestId: string }> {
  const auth = await loadAuth();
  const verifier = randomToken(32);
  const challenge = await sha256Hex(verifier);

  const res = await fetch(API.linkStart, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challenge, installId: auth.installId })
  });
  if (!res.ok) throw new Error("계정 연결을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  const data = (await res.json()) as { requestId: string; verificationUrl: string };
  await saveAuth({ ...auth, verifier, requestId: data.requestId });
  return data;
}

/** Poll the link request; once approved, redeem it for an extension token. */
export async function redeemLink(): Promise<AccountState> {
  const auth = await loadAuth();
  if (!auth.requestId || !auth.verifier) {
    return getAccount();
  }
  const status = await fetch(`${API.linkStatus}?requestId=${encodeURIComponent(auth.requestId)}`);
  if (status.ok) {
    const data = (await status.json()) as { approved?: boolean };
    if (!data.approved) {
      throw new Error("아직 연결이 승인되지 않았습니다. 제품 사이트에서 승인을 완료해 주세요.");
    }
  }
  const res = await fetch(API.linkRedeem, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requestId: auth.requestId,
      verifier: auth.verifier,
      installId: auth.installId
    })
  });
  if (!res.ok) throw new Error("계정 연결 승인을 확인하지 못했습니다. 웹사이트에서 연결을 승인했는지 확인해 주세요.");
  const data = (await res.json()) as { token: string; expiresAt: string; accountEmail: string | null };
  await saveAuth({
    ...auth,
    token: data.token,
    tokenExpiresAt: data.expiresAt,
    email: data.accountEmail,
    requestId: null,
    verifier: null
  });
  return getAccount();
}

export async function disconnect(): Promise<void> {
  const auth = await loadAuth();
  await chrome.storage.local.remove([STORAGE_KEYS.auth, STORAGE_KEYS.entitlement]);
  await saveAuth({
    ...auth,
    token: null,
    tokenExpiresAt: null,
    email: null,
    requestId: null,
    verifier: null
  });
}

export async function getCachedEntitlement(): Promise<CachedEntitlement | null> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.entitlement);
  return (data[STORAGE_KEYS.entitlement] as CachedEntitlement | undefined) ?? null;
}

/** Fetch and cache the current entitlement. */
export async function refreshEntitlement(): Promise<CachedEntitlement | null> {
  const auth = await loadAuth();
  if (!auth.token) return getCachedEntitlement();
  let res: Response;
  try {
    res = await fetch(API.entitlement, { headers: { authorization: `Bearer ${auth.token}` } });
  } catch {
    return getCachedEntitlement();
  }
  if (res.status === 401) {
    await saveAuth({ ...auth, token: null, tokenExpiresAt: null });
    return null;
  }
  if (!res.ok) return getCachedEntitlement();
  const body = (await res.json()) as EntitlementResponse & { entitlementToken?: string };
  const cache = applyServerEntitlement(body, body.entitlementToken ?? null, Date.now());
  await chrome.storage.local.set({ [STORAGE_KEYS.entitlement]: cache });
  return cache;
}

/** Create a server-bound checkout session and return the hosted checkout URL. */
export async function startCheckout(priceId?: string): Promise<string | null> {
  const auth = await loadAuth();
  const res = await fetch(API.checkout, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth.token ? { authorization: `Bearer ${auth.token}` } : {})
    },
    body: JSON.stringify({ priceId })
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
}

/** Create a Paddle customer-portal session (payment management/cancellation). */
export async function startPortal(): Promise<string | null> {
  const auth = await loadAuth();
  const res = await fetch(API.portal, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth.token ? { authorization: `Bearer ${auth.token}` } : {})
    },
    body: "{}"
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
}
