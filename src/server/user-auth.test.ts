import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { verifyBearerUserId } from "./user-auth.ts";

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createTestJwt(payload: Record<string, unknown>, secret: string) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(
    crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest(),
  );

  return `${header}.${body}.${signature}`;
}

test("verifyBearerUserId returns the signed JWT subject", () => {
  const secret = "test-jwt-secret";
  const token = createTestJwt(
    { sub: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00" },
    secret,
  );

  assert.equal(
    verifyBearerUserId(`Bearer ${token}`, secret),
    "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00",
  );
});

test("verifyBearerUserId rejects tampered JWT signatures", () => {
  const token = createTestJwt(
    { sub: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00" },
    "real-secret",
  );

  assert.equal(verifyBearerUserId(`Bearer ${token}`, "wrong-secret"), null);
});

test("verifyBearerUserId rejects tokens without a subject", () => {
  const token = createTestJwt({ role: "authenticated" }, "test-jwt-secret");

  assert.equal(verifyBearerUserId(`Bearer ${token}`, "test-jwt-secret"), null);
});
