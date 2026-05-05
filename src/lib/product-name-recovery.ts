type RecoveryInput = {
  currentName: string | null | undefined;
  rawDescription?: string | null | undefined;
  productName?: string | null | undefined;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripQqArtifacts(value: string) {
  return normalizeWhitespace(
    value
      .replace(/q{2,}/gi, " ")
      .replace(/[【\[(（]\s*q+\s*[\]】)）]/gi, " ")
      .replace(/[|/,_-]{2,}/g, " ")
      .replace(/\s+([/|,，])/g, "$1")
      .replace(/([/|,，])\s+/g, "$1"),
  );
}

function isMeaningfulName(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return false;
  if (normalized.length < 2) return false;
  if (/^[q\s._\-|/]+$/i.test(normalized)) return false;
  if (/^(未知|未命名|name|product)$/i.test(normalized)) return false;
  return true;
}

function extractNameFromDescription(rawDescription: string) {
  const source = String(rawDescription || "");
  const patterns = [
    /(?:^|\n)\s*(?:品名|产品名称|商品名称|名称|产品名)\s*[:：]\s*([^\n]+)/i,
    /(?:^|\n)\s*(?:product\s*name|product|name|model)\s*[:：]\s*([^\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    const candidate = normalizeWhitespace(String(match?.[1] || "").replace(/^["'“”‘’]+|["'“”‘’]+$/g, ""));
    if (isMeaningfulName(candidate)) {
      return candidate;
    }
  }

  return "";
}

export function recoverCanonicalProductName({
  currentName,
  rawDescription,
  productName,
}: RecoveryInput) {
  const normalizedCurrent = normalizeWhitespace(String(currentName || ""));
  const cleanedCurrent = stripQqArtifacts(normalizedCurrent);
  const extractedFromDescription = extractNameFromDescription(String(rawDescription || ""));
  const normalizedProductName = stripQqArtifacts(String(productName || ""));
  const currentLooksCorrupted =
    /q{2,}/i.test(normalizedCurrent) || !isMeaningfulName(normalizedCurrent);

  if (currentLooksCorrupted) {
    if (isMeaningfulName(extractedFromDescription)) {
      return extractedFromDescription;
    }
    if (isMeaningfulName(cleanedCurrent)) {
      return cleanedCurrent;
    }
    if (isMeaningfulName(normalizedProductName)) {
      return normalizedProductName;
    }
  }

  if (isMeaningfulName(cleanedCurrent)) {
    return cleanedCurrent;
  }
  if (isMeaningfulName(extractedFromDescription)) {
    return extractedFromDescription;
  }
  if (isMeaningfulName(normalizedProductName)) {
    return normalizedProductName;
  }

  return normalizedCurrent || normalizedProductName || extractedFromDescription || "未命名商品";
}
