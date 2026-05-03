import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export type AccessTokenVerifier = {
  verifyAccessToken: (accessToken: string) => Promise<string | null>;
};

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  return Buffer.from(padded, "base64");
}

function base64UrlEncode(value: Buffer) {
  return value
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function verifyBearerUserId(
  authorizationHeader: string | undefined,
  jwtSecret: string | undefined,
) {
  if (!authorizationHeader || !jwtSecret) return null;

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1];
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  try {
    const header = JSON.parse(base64UrlDecode(encodedHeader).toString("utf8")) as {
      alg?: string;
    };
    if (header.alg !== "HS256") return null;

    const expectedSignature = base64UrlEncode(
      crypto
        .createHmac("sha256", jwtSecret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest(),
    );
    const actualSignature = Buffer.from(encodedSignature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);

    if (
      actualSignature.length !== expectedSignatureBuffer.length ||
      !crypto.timingSafeEqual(actualSignature, expectedSignatureBuffer)
    ) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as {
      sub?: unknown;
    };
    return typeof payload.sub === "string" && payload.sub.trim()
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}

function extractBearerToken(authorizationHeader: string | undefined) {
  const match = authorizationHeader?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function createSupabaseAccessTokenVerifier({
  supabaseUrl,
  serviceRoleKey,
}: {
  supabaseUrl: string | undefined;
  serviceRoleKey: string | undefined;
}): AccessTokenVerifier | undefined {
  if (!supabaseUrl || !serviceRoleKey) {
    return undefined;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return {
    async verifyAccessToken(accessToken) {
      const { data, error } = await adminClient.auth.getUser(accessToken);
      if (error) {
        return null;
      }

      return data.user?.id || null;
    },
  };
}

export async function resolveBearerUserId({
  authorizationHeader,
  jwtSecret,
  authVerifier,
}: {
  authorizationHeader: string | undefined;
  jwtSecret: string | undefined;
  authVerifier?: AccessTokenVerifier;
}) {
  const accessToken = extractBearerToken(authorizationHeader);
  if (!accessToken) {
    return null;
  }

  const verifiedSupabaseUserId = authVerifier
    ? await authVerifier.verifyAccessToken(accessToken)
    : null;
  if (verifiedSupabaseUserId) {
    return verifiedSupabaseUserId;
  }

  return verifyBearerUserId(authorizationHeader, jwtSecret);
}
