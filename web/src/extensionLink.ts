import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function hashEquals(a: string, b: string): boolean {
  const left = Buffer.from(String(a ?? ""), "utf8");
  const right = Buffer.from(String(b ?? ""), "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}

export function randomUserId(): string {
  return `usr_${randomUUID()}`;
}

/**
 * PKCE-style link proof. The extension generates a random `verifier` and sends
 * `challenge = sha256(verifier)` at start. At redeem it sends the raw verifier;
 * the server compares its hash to the stored challenge.
 */
export function challengeForVerifier(verifier: string): string {
  return sha256Hex(verifier);
}
