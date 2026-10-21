// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, expect, it, vi } from "vitest";
import { localDateKey } from "../src/shared/usage";

type StorageSeed = Record<string, unknown>;

const popupHtml = readFileSync(resolve("public/popup.html"), "utf8");

function stubChrome(seed: StorageSeed): void {
  const store = new Map<string, unknown>(Object.entries(seed));
  vi.stubGlobal("chrome", {
    runtime: {
      getManifest: () => ({ version: "0.2.0" })
    },
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 1, url: "https://example.com/" }]),
      create: vi.fn().mockResolvedValue({}),
      sendMessage: vi.fn().mockRejectedValue(new Error("no content script"))
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue([])
    },
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
}

function validToken(until: string): string {
  return btoa(
    JSON.stringify({
      active: true,
      plan: "paid",
      localUntil: until,
      accountEmail: "buyer@example.com",
      issuedAt: new Date().toISOString()
    })
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  document.body.innerHTML = popupHtml;
});

it("blocks free fills after the daily limit", async () => {
  stubChrome({
    pai_daily_usage: { date: localDateKey(), count: 5 }
  });
  await import("../src/popup/popup");
  await vi.waitFor(() => expect(document.getElementById("acct-usage")?.textContent).toContain("5/5"));

  (document.getElementById("prefill") as HTMLButtonElement).click();
  await vi.waitFor(() =>
    expect(document.getElementById("status")?.textContent).toContain("무료 이용 횟수")
  );
  expect(document.getElementById("paywall")?.classList.contains("hidden")).toBe(false);
});

it("shows paid status and hides the paywall", async () => {
  const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  stubChrome({
    pai_auth: {
      token: "test-token",
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      email: "buyer@example.com",
      installId: "install-test",
      requestId: null,
      challenge: null,
      verifier: null
    },
    pai_entitlement: {
      entitlement: {
        active: true,
        plan: "paid",
        status: "active",
        paidUntil: until,
        graceUntil: null,
        revoked: false,
        revokeReason: null,
        localUntil: until,
        checkedAt: new Date().toISOString()
      },
      token: validToken(until),
      fetchedAt: Date.now()
    },
    pai_daily_usage: { date: localDateKey(), count: 5 }
  });

  await import("../src/popup/popup");
  await vi.waitFor(() => expect(document.getElementById("acct-badge")?.textContent).toBe("이용 중"));
  expect(document.getElementById("acct-badge")?.classList.contains("paid")).toBe(true);
  expect(document.getElementById("paywall")?.classList.contains("hidden")).toBe(true);
  expect((document.getElementById("btn-manage") as HTMLButtonElement).classList.contains("hidden")).toBe(false);
});
