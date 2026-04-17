import fs from 'fs';

export type ReviewBufferEntry = {
  [key: string]: unknown;
  sourceUrl?: string;
  name?: string;
  price?: number | null;
  coverImage?: string;
  genderHint?: string;
  rawDescription?: string;
  imagePlaceholder?: string;
  isReviewed?: boolean;
};

type ReviewBufferLookupCandidate = {
  itemId?: string;
  href?: string;
  sourceUrl?: string;
  title?: string;
  name?: string;
};

type ReviewBufferFallback = {
  sourceUrl?: string;
  title?: string;
  price?: number | null;
  coverImage?: string;
  genderHint?: string;
  imagePlaceholder?: string;
};

function normalizeTitle(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeItemId(value: string | null | undefined): string {
  return String(value || '').trim();
}

function collectLookupKeys(
  candidate: ReviewBufferLookupCandidate,
  extractItemId: (url: string) => string,
): string[] {
  const keys = new Set<string>();
  const itemIds = [
    normalizeItemId(candidate.itemId),
    normalizeItemId(extractItemId(candidate.href || '')),
    normalizeItemId(extractItemId(candidate.sourceUrl || '')),
  ].filter(Boolean);

  for (const itemId of itemIds) {
    keys.add(`tmall-item:${itemId}`);
  }

  const normalizedTitle = normalizeTitle(candidate.title || candidate.name || '');
  if (normalizedTitle) {
    keys.add(`title:${normalizedTitle}`);
  }

  return Array.from(keys);
}

export function hasUsableReviewBufferEntry(entry: ReviewBufferEntry): boolean {
  const rawDescription = String(entry.rawDescription || '').trim();
  return Boolean(rawDescription && rawDescription !== '信息未获取');
}

export function loadReviewBufferEntries(bufferPath: string): ReviewBufferEntry[] {
  try {
    if (!fs.existsSync(bufferPath)) return [];
    const parsed = JSON.parse(fs.readFileSync(bufferPath, 'utf-8')) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is ReviewBufferEntry => Boolean(entry) && typeof entry === 'object');
  } catch {
    return [];
  }
}

export function indexReviewBufferEntry(
  lookup: Map<string, ReviewBufferEntry>,
  entry: ReviewBufferEntry,
  extractItemId: (url: string) => string,
) {
  if (!hasUsableReviewBufferEntry(entry)) return;
  for (const key of collectLookupKeys(entry, extractItemId)) {
    lookup.set(key, entry);
  }
}

export function buildReviewBufferLookup(
  entries: ReviewBufferEntry[],
  extractItemId: (url: string) => string,
): Map<string, ReviewBufferEntry> {
  const lookup = new Map<string, ReviewBufferEntry>();
  for (const entry of entries) {
    indexReviewBufferEntry(lookup, entry, extractItemId);
  }
  return lookup;
}

export function findCachedReviewBufferEntry(
  lookup: Map<string, ReviewBufferEntry>,
  candidate: ReviewBufferLookupCandidate,
  extractItemId: (url: string) => string,
): ReviewBufferEntry | null {
  for (const key of collectLookupKeys(candidate, extractItemId)) {
    const cachedEntry = lookup.get(key);
    if (cachedEntry) return cachedEntry;
  }
  return null;
}

export function mergeCachedReviewBufferEntry(
  cachedEntry: ReviewBufferEntry,
  fallback: ReviewBufferFallback,
): ReviewBufferEntry {
  const nextEntry: ReviewBufferEntry = {
    ...cachedEntry,
    sourceUrl: String(cachedEntry.sourceUrl || fallback.sourceUrl || '').trim(),
    name: String(cachedEntry.name || fallback.title || '').trim(),
    price: cachedEntry.price ?? fallback.price ?? null,
    coverImage: String(cachedEntry.coverImage || fallback.coverImage || '').trim(),
    genderHint: String(cachedEntry.genderHint || fallback.genderHint || '').trim(),
    rawDescription: String(cachedEntry.rawDescription || '').trim() || '信息未获取',
    imagePlaceholder: String(cachedEntry.imagePlaceholder || fallback.imagePlaceholder || '').trim(),
    isReviewed: typeof cachedEntry.isReviewed === 'boolean' ? cachedEntry.isReviewed : false,
  };

  delete nextEntry.listUrl;
  delete nextEntry.listPageUrl;

  return nextEntry;
}
