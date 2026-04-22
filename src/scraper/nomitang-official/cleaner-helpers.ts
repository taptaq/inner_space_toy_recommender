export const isPlaceholderProductName = (value: string): boolean => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  return ['未知产品', '未知商品', '未命名产品', '未命名商品', '无标题', 'unknown product', 'page not found'].includes(normalized);
};

export const extractCanonicalName = (rawDescription: string, fallbackName: string): string => {
  const source = String(rawDescription || '');
  const match =
    source.match(/(?:^|\n)\s*商品名\s*[:：]\s*([^\n]+)/) ||
    source.match(/(?:^|\n)\s*Name\s*[:：]\s*([^\n]+)/i) ||
    source.match(/(?:^|\n)\s*品名\s*[:：]\s*([^\n]+)/);
  const candidate = (match?.[1] || '').trim();
  return candidate || fallbackName;
};

export function prepareUniqueBufferItemsForCleaning(rows: Array<Record<string, unknown>>) {
  const seenCanonicalNames = new Set<string>();
  const items: Array<Record<string, unknown>> = [];
  const skippedDuplicateNames: Array<{ canonicalName: string; sourceUrl: string }> = [];

  for (const row of rows) {
    const canonicalName = String(extractCanonicalName(String(row.rawDescription || ''), String(row.name || '')) || '').trim();
    if (isPlaceholderProductName(canonicalName)) {
      items.push(row);
      continue;
    }

    const dedupeKey = canonicalName.toLowerCase();
    if (seenCanonicalNames.has(dedupeKey)) {
      skippedDuplicateNames.push({
        canonicalName,
        sourceUrl: String(row.sourceUrl || ''),
      });
      continue;
    }

    seenCanonicalNames.add(dedupeKey);
    items.push(row);
  }

  return { items, skippedDuplicateNames };
}

export function resolvePersistedRawDescription(translatedRawDescription: string, sourceRawDescription: string): string {
  return String(translatedRawDescription || '').trim() || String(sourceRawDescription || '').trim();
}

export function hasMeaningfulEnglish(input: string): boolean {
  const value = String(input || '')
    .split('\n')
    .filter((line) => !/^\s*(商品名|页面标题)\s*[:：]/.test(line))
    .join('\n');
  const words: string[] = value.match(/[A-Za-z][A-Za-z'-]{3,}/g) ?? [];
  if (words.length === 0) return false;

  const allowed = new Set(['nomi', 'nomitang', 'tang', 'usb', 'usd', 'sku', 'app']);
  return words.some((word) => !allowed.has(word.toLowerCase()));
}
