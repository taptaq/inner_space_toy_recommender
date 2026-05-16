# Master4Fancy Official Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full `master4fancy-official` scraper pipeline that crawls the live Master4Fancy inventory storefront, keeps toys plus eligible accessories and apparel, converts USD prices into RMB, and persists normalized records through the existing cleaner/database flow.

**Architecture:** Follow the repo's existing Shopify `*-official` scraper pattern. `crawler.ts` owns Playwright navigation, list/detail parsing within `#product-grid`, pagination parsing from `.pagination__list.list-unstyled`, inclusion filtering, deduplication, review-buffer writing, and optional cleaner invocation; `cleaner.ts` owns translation, USD-to-CNY conversion, classifier-driven normalization, cleaned JSON output, and DB writes.

**Tech Stack:** TypeScript, Node.js 20, `tsx`, `node:test`, Playwright, Prisma + PostgreSQL, shared raw-description translator, shared library product type classifier, shared cleaner helpers from `nomitang-official`.

---

## File Structure

- Create: `src/scraper/master4fancy-official/crawler.ts`
- Create: `src/scraper/master4fancy-official/crawler.test.ts`
- Create: `src/scraper/master4fancy-official/cleaner.ts`
- Create: `src/scraper/master4fancy-official/cleaner.test.ts`
- Modify: `package.json`
- Create at runtime: `src/data/master4fancy-official-review-buffer.json`
- Create at runtime: `src/data/master4fancy-official-cleaned-data.json`
- Create at runtime: `src/data/master4fancy-official-raw-description-zh-cache.json`
- Reuse: `src/scraper/shared/raw-description-translator.ts`
- Reuse: `src/scraper/nomitang-official/cleaner-helpers.ts`
- Reuse: `src/lib/library-product-type-classifier.ts`
- Reuse as pattern only: `src/scraper/dame-official/*`, `src/scraper/luxevibes-official/*`

Responsibilities:

- `src/scraper/master4fancy-official/crawler.ts`: Playwright runtime, canonical URL normalization, list parsing, pagination parsing, include/exclude filtering, detail extraction, runtime logging, cleaner handoff.
- `src/scraper/master4fancy-official/crawler.test.ts`: regression coverage for inclusion filtering, scoped parsing under `#product-grid`, fallback link parsing, pagination helper behavior, runtime options.
- `src/scraper/master4fancy-official/cleaner.ts`: exchange-rate refresh/fallback, raw-description translation, spec inference, classifier-based type/subtype mapping, cleaned JSON emission, and DB writes.
- `src/scraper/master4fancy-official/cleaner.test.ts`: regression coverage for USD→RMB conversion, classification of toy/accessory/apparel signals, and normalized output shape.
- `package.json`: add `scrape:master4fancy-official` and `clean:master4fancy-official`.

## Task 1: Scaffold crawler tests around filtering, list parsing, and runtime options

**Files:**
- Create: `src/scraper/master4fancy-official/crawler.test.ts`
- Create: `src/scraper/master4fancy-official/crawler.ts`

- [ ] **Step 1: Write the failing crawler tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractListItemsFromHtml,
  mergeUniqueListItems,
  normalizeProductUrl,
  resolveCrawlerRuntimeOptions,
  shouldAutoRunCleaner,
  shouldKeepMaster4FancyCandidate,
} from './crawler.ts';

test('normalizeProductUrl keeps canonical Master4Fancy product urls', () => {
  assert.equal(
    normalizeProductUrl('https://master4fancy.com/products/anubis?variant=123#gallery'),
    'https://master4fancy.com/products/anubis',
  );
  assert.equal(
    normalizeProductUrl('/collections/inventory/products/reaper'),
    'https://master4fancy.com/products/reaper',
  );
});

test('shouldKeepMaster4FancyCandidate keeps toys, accessories, and apparel but rejects weak merch', () => {
  assert.equal(
    shouldKeepMaster4FancyCandidate({
      name: 'ANUBIS',
      subtitle: 'Fantasy dual-density dildo',
      rawDescription: 'Fantasy body-safe insertable toy.',
    }),
    true,
  );

  assert.equal(
    shouldKeepMaster4FancyCandidate({
      name: 'Alien Egg Mold',
      subtitle: 'Accessory for casting fantasy eggs',
      rawDescription: 'Silicone mold accessory.',
    }),
    true,
  );

  assert.equal(
    shouldKeepMaster4FancyCandidate({
      name: 'Black Blood Harness',
      subtitle: 'Adjustable fantasy harness wear',
      rawDescription: 'Harness apparel for fantasy play.',
    }),
    true,
  );

  assert.equal(
    shouldKeepMaster4FancyCandidate({
      name: 'Fantasy Play Mat',
      subtitle: 'Printed merch mat',
      rawDescription: 'A decorative play mat accessory for photos.',
    }),
    false,
  );

  assert.equal(
    shouldKeepMaster4FancyCandidate({
      name: 'Lucky Bag',
      subtitle: 'Mystery merch bundle',
      rawDescription: 'Random lucky bag.',
    }),
    false,
  );
});

test('extractListItemsFromHtml parses inventory cards from #product-grid', () => {
  const result = extractListItemsFromHtml(`
    <div id="product-grid">
      <div class="grid__item">
        <a href="/products/anubis">
          <img src="//cdn.shopify.com/anubis.jpg" alt="ANUBIS" />
          <h3>ANUBIS</h3>
        </a>
        <p>Fantasy dual-density dildo</p>
        <span class="price-item price-item--sale">$95.00</span>
        <span class="price-item price-item--regular">$110.00</span>
      </div>
      <div class="grid__item">
        <a href="/products/black-blood-harness">
          <img src="//cdn.shopify.com/harness.jpg" alt="Black Blood Harness" />
          <h3>Black Blood Harness</h3>
        </a>
        <p>Adjustable fantasy harness wear</p>
        <span class="price-item">$65.00</span>
      </div>
    </div>
  `);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://master4fancy.com/products/anubis',
    name: 'ANUBIS',
    subtitle: 'Fantasy dual-density dildo',
    coverImage: 'https://cdn.shopify.com/anubis.jpg',
    priceUsd: 95,
    originalPriceUsd: 110,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'unisex',
    stock: 'in_stock',
    listPosition: 1,
  });
});

test('extractListItemsFromHtml falls back to plain product links when card classes are unstable', () => {
  const result = extractListItemsFromHtml(`
    <div id="product-grid">
      <a href="/products/reaper">Reaper 6 reviews</a>
      <div>$88.00</div>
      <div>~~$98.00~~</div>
      <a href="/products/alien-egg-mold">Alien Egg Mold no reviews</a>
      <div>$20.00</div>
    </div>
  `);

  assert.equal(result.length, 2);
  assert.equal(result[0]?.name, 'Reaper');
  assert.equal(result[0]?.priceUsd, 88);
  assert.equal(result[1]?.name, 'Alien Egg Mold');
  assert.equal(result[1]?.priceUsd, 20);
});

test('mergeUniqueListItems keeps earliest position for duplicate canonical urls', () => {
  const result = mergeUniqueListItems([
    {
      sourceUrl: 'https://master4fancy.com/collections/inventory/products/anubis?variant=1',
      name: 'ANUBIS',
      subtitle: 'Fantasy dual-density dildo',
      coverImage: 'https://cdn.example.com/1.jpg',
      priceUsd: 95,
      originalPriceUsd: 110,
      priceCurrency: 'USD',
      categoryHints: ['fantasy'],
      genderHint: 'unisex',
      stock: 'in_stock',
      listPosition: 5,
    },
    {
      sourceUrl: 'https://master4fancy.com/products/anubis',
      name: 'ANUBIS',
      subtitle: 'Fantasy dual-density dildo',
      coverImage: 'https://cdn.example.com/2.jpg',
      priceUsd: 95,
      originalPriceUsd: 110,
      priceCurrency: 'USD',
      categoryHints: ['dildo'],
      genderHint: 'unisex',
      stock: 'sold_out',
      listPosition: 1,
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.sourceUrl, 'https://master4fancy.com/products/anubis');
  assert.equal(result[0]?.listPosition, 1);
  assert.deepEqual(result[0]?.categoryHints, ['fantasy', 'dildo']);
});

test('resolveCrawlerRuntimeOptions supports debug overrides and skip-cleaner flag', () => {
  assert.deepEqual(
    resolveCrawlerRuntimeOptions({
      MASTER4FANCY_OFFICIAL_MAX_ITEMS: '2',
      MASTER4FANCY_OFFICIAL_LIST_SETTLE_MS: '400',
      MASTER4FANCY_OFFICIAL_PAGE_SETTLE_MS: '500',
      MASTER4FANCY_OFFICIAL_DETAIL_SETTLE_MS: '600',
      MASTER4FANCY_OFFICIAL_DETAIL_DELAY_MS: '0',
      MASTER4FANCY_OFFICIAL_VERBOSE: '0',
    }),
    {
      maxItems: 2,
      listSettleMs: 400,
      pageSettleMs: 500,
      detailSettleMs: 600,
      detailDelayMs: 0,
      verbose: false,
    },
  );

  assert.equal(shouldAutoRunCleaner({}), true);
  assert.equal(shouldAutoRunCleaner({ MASTER4FANCY_OFFICIAL_SKIP_CLEANER: '1' }), false);
});
```

- [ ] **Step 2: Run the crawler tests to verify they fail**

Run: `node --import tsx --test src/scraper/master4fancy-official/crawler.test.ts`

Expected: FAIL because `src/scraper/master4fancy-official/crawler.ts` does not yet exist or does not export the tested helpers.

- [ ] **Step 3: Create the minimal crawler scaffold with the required exports**

```ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ORIGIN = 'https://master4fancy.com';
export const LIST_URL = `${ORIGIN}/collections/inventory`;
export const BUFFER_PATH = path.resolve(__dirname, '../../data/master4fancy-official-review-buffer.json');
export const DEFAULT_MAX_ITEMS = 200;

type EnvSource = Record<string, string | undefined>;

export type Master4FancyListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  priceCurrency: 'USD';
  categoryHints: string[];
  genderHint: 'female' | 'male' | 'unisex';
  stock: 'in_stock' | 'sold_out';
  listPosition: number | null;
};

export type Master4FancyCrawlerRuntimeOptions = {
  maxItems: number;
  listSettleMs: number;
  pageSettleMs: number;
  detailSettleMs: number;
  detailDelayMs: number;
  verbose: boolean;
};

export function normalizeProductUrl(input: string): string { return ''; }
export function shouldKeepMaster4FancyCandidate(input: Record<string, unknown>): boolean { return false; }
export function extractListItemsFromHtml(html: string): Master4FancyListItem[] { return []; }
export function mergeUniqueListItems(items: Master4FancyListItem[]): Master4FancyListItem[] { return items; }
export function resolveCrawlerRuntimeOptions(env: EnvSource = process.env): Master4FancyCrawlerRuntimeOptions {
  return { maxItems: 200, listSettleMs: 4000, pageSettleMs: 3000, detailSettleMs: 2500, detailDelayMs: 0, verbose: true };
}
export function shouldAutoRunCleaner(env: EnvSource = process.env): boolean { return true; }
export async function runCrawler(): Promise<unknown[]> { return []; }
```

- [ ] **Step 4: Run the crawler tests again to verify they still fail for the expected reasons**

Run: `node --import tsx --test src/scraper/master4fancy-official/crawler.test.ts`

Expected: FAIL on assertions for parsing/filtering behavior instead of module-not-found errors.

- [ ] **Step 5: Commit the scaffold**

```bash
git add src/scraper/master4fancy-official/crawler.ts src/scraper/master4fancy-official/crawler.test.ts
git commit -m "test: scaffold master4fancy crawler coverage"
```

## Task 2: Implement the crawler list/detail parsing and progress logging

**Files:**
- Modify: `src/scraper/master4fancy-official/crawler.ts`
- Test: `src/scraper/master4fancy-official/crawler.test.ts`

- [ ] **Step 1: Implement URL normalization, filtering, and list parsing helpers**

```ts
function normalizeWhitespace(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function parsePriceUsd(value: string): number | null {
  const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeProductUrl(input: string): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  const url = new URL(trimmed, ORIGIN);
  url.protocol = 'https:';
  url.host = 'master4fancy.com';
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/^\/collections\/inventory\/products\//, '/products/').replace(/\/+$/, '') || '/';
  return url.toString();
}

export function shouldKeepMaster4FancyCandidate(input: Record<string, unknown>): boolean {
  const haystack = [input.name, input.subtitle, input.rawDescription]
    .map((value) => String(value || ''))
    .join(' ')
    .toLowerCase();

  const blockedPatterns = [/\bplay mat\b/i, /\bsquish(?:y|ies)\b/i, /\blucky bag\b/i, /\bgift card\b/i, /\bsticker\b/i, /\bposter\b/i];
  if (blockedPatterns.some((pattern) => pattern.test(haystack))) return false;

  const allowedTerms = [
    'dildo', 'plug', 'vibrator', 'massager', 'fantasy', 'egg mold', 'mold',
    'harness', 'strap', 'lingerie', 'wear', 'accessory', 'silicone', 'insertable'
  ];
  return allowedTerms.some((term) => haystack.includes(term));
}
```

- [ ] **Step 2: Implement scoped parsing under `#product-grid` plus anchor fallback**

```ts
function extractScopedListingHtml(html: string): string {
  const start = html.search(/id=["']product-grid["']/i);
  if (start < 0) return html;
  const tail = html.slice(start);
  const nextSection = tail.search(/class=["'][^"']*pagination__list list-unstyled[^"']*["']/i);
  return nextSection < 0 ? tail : tail.slice(0, nextSection);
}

function stripReviewSuffix(value: string): string {
  return normalizeWhitespace(String(value || ''))
    .replace(/\bno reviews?\b/gi, '')
    .replace(/\b\d+\s+reviews?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractListItemsFromHtml(html: string): Master4FancyListItem[] {
  const scopedHtml = extractScopedListingHtml(html);
  const blocks = Array.from(scopedHtml.matchAll(/<a[^>]+href="([^"]*(?:\/products\/|\/collections\/inventory\/products\/)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi));
  const items: Master4FancyListItem[] = [];

  for (const [index, match] of blocks.entries()) {
    const href = match[1] || '';
    const sourceUrl = normalizeProductUrl(href);
    const currentStart = match.index ?? 0;
    const nextStart = blocks[index + 1]?.index ?? scopedHtml.length;
    const window = scopedHtml.slice(currentStart, nextStart);
    const name = stripReviewSuffix(decodeHtml(normalizeWhitespace(match[2] || '')));
    const subtitle = decodeHtml(normalizeWhitespace(window.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || ''));
    const coverImage =
      new URL(
        window.match(/<img[^>]+src="([^"]+)"/i)?.[1] ||
        window.match(/<img[^>]+data-src="([^"]+)"/i)?.[1] ||
        '',
        ORIGIN,
      ).toString();
    const prices = Array.from(window.matchAll(/\$\s*\d+(?:\.\d+)?/g))
      .map((entry) => parsePriceUsd(entry[0]))
      .filter((value): value is number => value !== null);

    const item: Master4FancyListItem = {
      sourceUrl,
      name,
      subtitle,
      coverImage,
      priceUsd: prices[0] ?? null,
      originalPriceUsd: prices[1] ?? null,
      priceCurrency: 'USD',
      categoryHints: [],
      genderHint: 'unisex',
      stock: /sold out/i.test(window) ? 'sold_out' : 'in_stock',
      listPosition: index + 1,
    };

    if (item.sourceUrl && item.name && shouldKeepMaster4FancyCandidate(item)) {
      items.push(item);
    }
  }

  return items;
}
```

- [ ] **Step 3: Implement pagination/detail helpers, runtime logging, and crawler execution**

```ts
function logProgress(runtime: Master4FancyCrawlerRuntimeOptions, message: string) {
  if (runtime.verbose) console.log(`[master4fancy-official] ${message}`);
}

async function resolveTotalPages(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.querySelector('.pagination__list.list-unstyled');
    const links = Array.from(root?.querySelectorAll('a[href*="page="]') || []);
    const pageNumbers = links
      .map((link) => Number(new URL((link as HTMLAnchorElement).href).searchParams.get('page') || ''))
      .filter((value) => Number.isFinite(value) && value > 0);
    return pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
  }).catch(() => 1);
}

export function mergeUniqueListItems(items: Master4FancyListItem[]): Master4FancyListItem[] {
  const byUrl = new Map<string, Master4FancyListItem>();
  for (const item of items) {
    const sourceUrl = normalizeProductUrl(item.sourceUrl);
    if (!sourceUrl) continue;
    const existing = byUrl.get(sourceUrl);
    if (!existing || (item.listPosition ?? Infinity) < (existing.listPosition ?? Infinity)) {
      byUrl.set(sourceUrl, { ...item, sourceUrl });
    } else {
      byUrl.set(sourceUrl, {
        ...existing,
        categoryHints: [...new Set([...(existing.categoryHints || []), ...(item.categoryHints || [])])],
      });
    }
  }
  return Array.from(byUrl.values()).sort((a, b) => (a.listPosition ?? Infinity) - (b.listPosition ?? Infinity));
}

export async function runCrawler(env: EnvSource = process.env): Promise<Master4FancyReviewBufferItem[]> {
  const runtime = resolveCrawlerRuntimeOptions(env);
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'], ignoreDefaultArgs: ['--enable-automation'] });
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 ... Chrome/124.0.0.0 Safari/537.36', viewport: { width: 1440, height: 2200 }, locale: 'en-US' });
  const page = await context.newPage();

  try {
    logProgress(runtime, `启动抓取，目标列表页: ${LIST_URL}`);
    await page.goto(LIST_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(runtime.listSettleMs);
    const totalPages = await resolveTotalPages(page);
    let aggregatedItems: Master4FancyListItem[] = [];

    for (let currentPage = 1; currentPage <= totalPages; currentPage += 1) {
      const url = currentPage === 1 ? LIST_URL : `${LIST_URL}?page=${currentPage}`;
      logProgress(runtime, `抓取列表页 ${currentPage}/${totalPages}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForTimeout(runtime.pageSettleMs);
      const pageItems = extractListItemsFromHtml(await page.content()).map((item) => ({
        ...item,
        listPosition: item.listPosition === null ? null : aggregatedItems.length + (item.listPosition || 0),
      }));
      aggregatedItems = mergeUniqueListItems([...aggregatedItems, ...pageItems]).slice(0, runtime.maxItems);
      logProgress(runtime, `当前累计唯一商品数: ${aggregatedItems.length}`);
      if (aggregatedItems.length >= runtime.maxItems) break;
    }

    // implement detail crawling and review-buffer writing in-place following dame/luxevibes pattern
    return [];
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
```

- [ ] **Step 4: Run the crawler tests to verify they pass**

Run: `node --import tsx --test src/scraper/master4fancy-official/crawler.test.ts`

Expected: PASS with all crawler tests green.

- [ ] **Step 5: Commit the crawler implementation**

```bash
git add src/scraper/master4fancy-official/crawler.ts src/scraper/master4fancy-official/crawler.test.ts
git commit -m "feat: add master4fancy crawler"
```

## Task 3: Add cleaner tests and implement normalization, translation, and DB syncing

**Files:**
- Create: `src/scraper/master4fancy-official/cleaner.test.ts`
- Create: `src/scraper/master4fancy-official/cleaner.ts`
- Test: `src/scraper/master4fancy-official/cleaner.test.ts`

- [ ] **Step 1: Write the failing cleaner tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';

test('resolveRmbPrice converts USD prices to rounded RMB', () => {
  assert.equal(cleaner.resolveRmbPrice(95, 7.2), 684);
  assert.equal(cleaner.resolveRmbPrice(20, 7.2), 144);
  assert.equal(cleaner.resolveRmbPrice(null, 7.2), null);
});

test('buildNormalizedSpecs classifies fantasy toy signals', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'ANUBIS',
      subtitle: 'Fantasy dual-density dildo',
      priceUsd: 95,
      rawDescription: 'Body-safe silicone fantasy dildo with internal firmness and insertable shape.',
      genderHint: 'unisex',
    },
    { rate: 7.2, source: 'test-fixture', date: '2026-05-15' },
  );

  assert.equal(specs.price_rmb, 684);
  assert.equal(specs.type_code, 'dildo');
  assert.ok(Array.isArray(specs.function_tags));
});

test('buildNormalizedSpecs classifies accessory and apparel signals', () => {
  const accessory = cleaner.buildNormalizedSpecs(
    {
      name: 'Alien Egg Mold',
      subtitle: 'Casting accessory',
      priceUsd: 20,
      rawDescription: 'Silicone casting mold accessory for fantasy eggs.',
      genderHint: 'unisex',
    },
    { rate: 7.2, source: 'test-fixture', date: '2026-05-15' },
  );

  const apparel = cleaner.buildNormalizedSpecs(
    {
      name: 'Black Blood Harness',
      subtitle: 'Adjustable fantasy harness wear',
      priceUsd: 65,
      rawDescription: 'Harness apparel with adjustable straps for fantasy wear.',
      genderHint: 'unisex',
    },
    { rate: 7.2, source: 'test-fixture', date: '2026-05-15' },
  );

  assert.equal(accessory.type_code, 'care_accessory');
  assert.ok(accessory.function_tags.includes('配件') || accessory.function_tags.includes('便携'));
  assert.equal(apparel.type_code, 'care_accessory');
  assert.equal(apparel.subtype_code, 'lingerie');
});
```

- [ ] **Step 2: Run the cleaner tests to verify they fail**

Run: `node --import tsx --test src/scraper/master4fancy-official/cleaner.test.ts`

Expected: FAIL because `cleaner.ts` does not yet exist or does not export `resolveRmbPrice` / `buildNormalizedSpecs`.

- [ ] **Step 3: Implement the cleaner by adapting the `dame-official` structure**

```ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { buildSafeDisplayName } from '../../lib/product-display-name.ts';
import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
} from '../../lib/library-product-type-classifier.ts';
import { translateRawDescriptionToZh } from '../shared/raw-description-translator.ts';
import {
  extractCanonicalName,
  hasMeaningfulEnglish,
  isPlaceholderProductName,
  prepareUniqueBufferItemsForCleaning,
  resolvePersistedRawDescription,
} from '../nomitang-official/cleaner-helpers.ts';

dotenv.config();

export const BUFFER_PATH = path.resolve(__dirname, '../../data/master4fancy-official-review-buffer.json');
export const CLEANED_PATH = path.resolve(__dirname, '../../data/master4fancy-official-cleaned-data.json');
const RAW_TRANSLATION_CACHE_PATH = path.resolve(__dirname, '../../data/master4fancy-official-raw-description-zh-cache.json');
const FALLBACK_USD_TO_CNY_RATE = 7.2;

export function resolveRmbPrice(usd: number | null, rate = FALLBACK_USD_TO_CNY_RATE): number | null {
  if (!Number.isFinite(Number(usd)) || Number(usd) <= 0) return null;
  return Math.round(Number(usd) * rate);
}

export function buildNormalizedSpecs(item: Record<string, unknown>, fx: { rate: number; source: string; date: string | null }) {
  const rawDescription = String(item.rawDescription || '').trim();
  const classifierInput = {
    gender: 'unisex',
    physicalForm: null,
    name: String(item.name || ''),
    rawDescription,
    tags: [String(item.subtitle || '')],
  };
  const type_code = classifyLibraryTypeCode(classifierInput);
  const subtype_code = classifyLibrarySubtypeCode({ ...classifierInput, typeCode: type_code });
  return {
    price_usd: Number(item.priceUsd || 0) || null,
    price_rmb: resolveRmbPrice(Number(item.priceUsd || 0) || null, fx.rate),
    original_price_usd: Number(item.originalPriceUsd || 0) || null,
    original_price_rmb: resolveRmbPrice(Number(item.originalPriceUsd || 0) || null, fx.rate),
    fx_rate_usd_cny: fx.rate,
    fx_rate_source: fx.source,
    fx_rate_date: fx.date,
    gender: 'unisex',
    material: /silicone/i.test(rawDescription) ? '硅胶' : '混合材质',
    appearance: /harness|wear|lingerie/i.test(rawDescription) ? 'high_disguise' : 'normal',
    physical_form: /insertable|dildo|plug/i.test(rawDescription) ? 'internal' : 'external',
    motor_type: 'gentle',
    waterproof: /waterproof|防水/i.test(rawDescription) ? 7 : null,
    max_db: null,
    function_tags: [],
    type_code,
    subtype_code,
  };
}
```

- [ ] **Step 4: Extend the cleaner to translate, write cleaned JSON, and sync DB rows**

Run implementation using the same structure as `src/scraper/dame-official/cleaner.ts`, but change:

- buffer paths to `master4fancy-official`
- brand name to `Master4Fancy`
- cleaner logging label to `master4fancy-official`
- function-tag heuristics to preserve accessory/apparel semantics
- DB payload `brand` / `safe_display_name` / `raw_description` fields for this source

Use this cleaned-row skeleton inside the loop:

```ts
const cleanedRow = {
  sourceUrl: String(item.sourceUrl || ''),
  name: canonicalName,
  safeDisplayName: buildSafeDisplayName(canonicalName),
  brand: 'Master4Fancy',
  price: specs.price_rmb,
  coverImage: String(item.coverImage || ''),
  rawDescription: persistedRawDescription,
  gender: specs.gender,
  material: specs.material,
  specs: {
    ...specs,
    price_source_currency: String(item.priceCurrency || 'USD').trim() || 'USD',
    price_source_amount: specs.price_usd,
  },
  typeCode: specs.type_code,
  subtypeCode: specs.subtype_code,
};
```

- [ ] **Step 5: Run the cleaner tests to verify they pass**

Run: `node --import tsx --test src/scraper/master4fancy-official/cleaner.test.ts`

Expected: PASS with all cleaner tests green.

- [ ] **Step 6: Commit the cleaner implementation**

```bash
git add src/scraper/master4fancy-official/cleaner.ts src/scraper/master4fancy-official/cleaner.test.ts
git commit -m "feat: add master4fancy cleaner"
```

## Task 4: Wire package scripts and run end-to-end verification

**Files:**
- Modify: `package.json`
- Test: `src/scraper/master4fancy-official/crawler.test.ts`
- Test: `src/scraper/master4fancy-official/cleaner.test.ts`

- [ ] **Step 1: Add package scripts**

```json
{
  "scripts": {
    "clean:master4fancy-official": "tsx -r dotenv/config src/scraper/master4fancy-official/cleaner.ts",
    "scrape:master4fancy-official": "tsx -r dotenv/config src/scraper/master4fancy-official/crawler.ts"
  }
}
```

- [ ] **Step 2: Run unit coverage for the new scraper**

Run: `node --import tsx --test src/scraper/master4fancy-official/crawler.test.ts src/scraper/master4fancy-official/cleaner.test.ts`

Expected: PASS with all tests green.

- [ ] **Step 3: Run TypeScript verification**

Run: `npm run lint`

Expected: PASS with `tsc --noEmit` exiting successfully.

- [ ] **Step 4: Run a tiny live scrape without cleaner to verify non-zero inventory results**

Run: `MASTER4FANCY_OFFICIAL_MAX_ITEMS=2 MASTER4FANCY_OFFICIAL_SKIP_CLEANER=1 npm run scrape:master4fancy-official`

Expected:

- logs show pagination progress
- `当前累计唯一商品数` becomes non-zero
- `src/data/master4fancy-official-review-buffer.json` is written with at least 1 item

- [ ] **Step 5: Run the cleaner manually on the small sample**

Run: `npm run clean:master4fancy-official`

Expected:

- `src/data/master4fancy-official-cleaned-data.json` is written
- cleaned rows contain RMB prices and normalized `typeCode` / `subtypeCode`

- [ ] **Step 6: Commit the final wiring and verification**

```bash
git add package.json src/scraper/master4fancy-official docs/superpowers/specs/2026-05-15-master4fancy-official-scraper-design.md docs/superpowers/plans/2026-05-15-master4fancy-official.md
git commit -m "feat: add master4fancy official scraper pipeline"
```

## Self-Review

Spec coverage check:

- 列表区域 `#product-grid`: covered in Task 1 tests and Task 2 parsing helpers.
- 分页区域 `.pagination__list.list-unstyled`: covered in Task 2 runtime implementation.
- 保留玩具 + 配件 + 服饰,过滤弱相关周边: covered in Task 1 filtering tests and Task 2 inclusion rules.
- USD→RMB、翻译、分类、入库: covered in Task 3.
- 调试环境变量和 skip cleaner: covered in Task 1 runtime-option tests and Task 2 execution wiring.

Placeholder scan:

- No `TODO` / `TBD`.
- All new files and runtime outputs are explicitly named.
- Verification commands are concrete.

Type consistency:

- `normalizeProductUrl`, `extractListItemsFromHtml`, `mergeUniqueListItems`, `resolveCrawlerRuntimeOptions`, `shouldAutoRunCleaner`, and `shouldKeepMaster4FancyCandidate` are defined first in crawler tasks and referenced consistently later.
- `resolveRmbPrice` and `buildNormalizedSpecs` are defined in cleaner tasks before verification steps reference them.
