import crypto from "node:crypto";

export type EncryptedPrivateJson = {
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
};

function resolveEncryptionKey(rawKey: string) {
  const trimmedKey = rawKey.trim();
  const key = /^[a-f0-9]{64}$/i.test(trimmedKey)
    ? Buffer.from(trimmedKey, "hex")
    : Buffer.from(trimmedKey, "base64");

  if (key.byteLength !== 32) {
    throw new Error(
      "PRIVATE_DATA_ENCRYPTION_KEY must be a 32-byte hex or base64 key",
    );
  }

  return key;
}

export function encryptPrivateJson(
  payload: unknown,
  rawKey: string,
): EncryptedPrivateJson {
  const key = resolveEncryptionKey(rawKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(payload);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptPrivateJson(
  encrypted: EncryptedPrivateJson,
  rawKey: string,
): unknown {
  const key = resolveEncryptionKey(rawKey);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(encrypted.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plaintext);
}
