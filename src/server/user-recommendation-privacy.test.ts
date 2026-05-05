import assert from "node:assert/strict";
import test from "node:test";

import {
  decryptPrivateJson,
  encryptPrivateJson,
} from "./user-recommendation-privacy.ts";

test("private recommendation json is encrypted and can be decrypted with the same key", () => {
  const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const payload = {
    answers: {
      gender: "female",
      tags: ["静音", "高伪装"],
    },
    topProductIds: ["item-1", "item-2"],
  };

  const encrypted = encryptPrivateJson(payload, key);

  assert.equal(encrypted.algorithm, "aes-256-gcm");
  assert.notEqual(encrypted.ciphertext, JSON.stringify(payload));
  assert.ok(encrypted.iv.length > 0);
  assert.ok(encrypted.authTag.length > 0);
  assert.deepEqual(decryptPrivateJson(encrypted, key), payload);
});

test("private recommendation json rejects invalid encryption keys", () => {
  assert.throws(
    () => encryptPrivateJson({ answers: { tags: [] } }, "short-key"),
    /PRIVATE_DATA_ENCRYPTION_KEY must be a 32-byte hex or base64 key/,
  );
});
