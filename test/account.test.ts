import { beforeEach, expect, it, vi } from "vitest";
import { getAccount, redeemLink, sha256Hex, startLink } from "../src/shared/account";
import { STORAGE_KEYS } from "../src/shared/config";

type StorageSeed = Record<string, unknown>;

function stubChrome(): Map<string, unknown> {
  const store = new Map<string, unknown>();
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store.get(key) })),
        set: vi.fn(async (values: StorageSeed) => {
          for (const [key, value] of Object.entries(values)) store.set(key, value);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key);
        })
      }
    }
  });
  return store;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("sends only the challenge hash at start and the raw verifier at redeem", async () => {
  const store = stubChrome();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ requestId: "req_1", verificationUrl: "https://example.test/connect" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ approved: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          token: "ext_token",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          accountEmail: "buyer@example.com"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
  vi.stubGlobal("fetch", fetchMock);

  const link = await startLink();
  expect(link.requestId).toBe("req_1");

  const auth = store.get(STORAGE_KEYS.auth) as { verifier: string; requestId: string };
  const startBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));
  expect(startBody.challenge).toBe(await sha256Hex(auth.verifier));
  expect(startBody.verifier).toBeUndefined();
  expect(startBody.installId).toBeTruthy();

  const account = await redeemLink();
  expect(account.connected).toBe(true);
  expect(account.email).toBe("buyer@example.com");

  const redeemBody = JSON.parse(String(fetchMock.mock.calls[2][1].body));
  expect(redeemBody.verifier).toBe(auth.verifier);
  expect(redeemBody.challenge).toBeUndefined();

  expect((await getAccount()).connected).toBe(true);
});
