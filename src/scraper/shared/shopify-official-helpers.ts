export function decodeHtmlEntities(value: string): string {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

export function stripHtmlTags(value: string): string {
  return decodeHtmlEntities(String(value || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '));
}

export function normalizeOfficialWhitespace(value: string): string {
  return stripHtmlTags(value)
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function uniqueOfficialStrings(values: Array<string | null | undefined>, limit = 120): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeOfficialWhitespace(String(value || ''));
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

export function parseOfficialPrice(value: unknown): number | null {
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeOfficialAssetUrl(input: string, origin: string): string {
  const trimmed = decodeHtmlEntities(String(input || '').trim());
  if (!trimmed) return '';
  try {
    return new URL(trimmed, origin).toString();
  } catch {
    return '';
  }
}

export function normalizeOfficialProductUrl(input: string, origin: string): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed, origin);
    const handle = url.pathname.match(/\/products\/([^/?#]+)/i)?.[1];
    if (!handle) return '';
    return `${origin}/products/${handle}`;
  } catch {
    return '';
  }
}
