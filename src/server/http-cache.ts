import crypto from "node:crypto";

export function createJsonEtag(payload: unknown) {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("base64url");

  return `"${hash}"`;
}

export function requestHasMatchingEtag(
  ifNoneMatchHeader: string | string[] | undefined,
  etag: string,
) {
  const headerValue = Array.isArray(ifNoneMatchHeader)
    ? ifNoneMatchHeader.join(",")
    : ifNoneMatchHeader;

  if (!headerValue) {
    return false;
  }

  return headerValue
    .split(",")
    .map((value) => value.trim())
    .some((value) => value === "*" || value === etag);
}
