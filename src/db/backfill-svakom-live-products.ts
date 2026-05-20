import dotenv from 'dotenv';
import pg from 'pg';
import { pathToFileURL } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
} from '../lib/library-product-type-classifier.ts';
import type { LibrarySubtypeCode, LibraryTypeCode } from '../lib/library-product-types.ts';

dotenv.config();

const { Pool } = pg;
const DEFAULT_CDP_ENDPOINT = 'http://127.0.0.1:9222';
const SVAKOM_DOMAIN = 'svakom.com';
const POWERED_SUBTYPES = new Set<LibrarySubtypeCode>([
  'suction_pure',
  'suction_dual',
  'rabbit_dual',
  'multi_head_dual',
  'bullet_vibe',
  'wand_massager',
  'insertable_vibe',
  'vibrating_masturbator',
  'interactive_masturbator',
  'prostate_vibe',
  'vibrating_cock_ring',
  'panty_wearable',
  'insertable_remote',
  'dual_wearable_remote',
]);

const SVAKOM_SLUG_OVERRIDES: Record<
  string,
  { gender: Gender; type_code: LibraryTypeCode; subtype_code: LibrarySubtypeCode }
> = {
  beatrice: { gender: 'female', type_code: 'external_vibe', subtype_code: 'bullet_vibe' },
  'beginers-vibrator-cici-2': { gender: 'female', type_code: 'insertable', subtype_code: 'insertable_vibe' },
  'clitoral-panty-vibrator': { gender: 'female', type_code: 'wearable_remote', subtype_code: 'panty_wearable' },
  'male-masturbator': { gender: 'male', type_code: 'masturbator', subtype_code: 'interactive_masturbator' },
  'mini-bullet-vibrator': { gender: 'female', type_code: 'external_vibe', subtype_code: 'bullet_vibe' },
  'thrusting-rabbit-vibrator': { gender: 'female', type_code: 'dual_stimulation', subtype_code: 'rabbit_dual' },
  'wearable-vibrator': { gender: 'female', type_code: 'wearable_remote', subtype_code: 'insertable_remote' },
};

type Gender = 'female' | 'male' | 'unisex';

export type SvakomLiveSnapshot = {
  url: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  bodyText: string;
  headings: string[];
  images: string[];
};

export type SvakomLivePatchInput = {
  name: string;
  currentGender: string | null;
  currentTypeCode: string | null;
  currentSubtypeCode: string | null;
  snapshot: SvakomLiveSnapshot;
};

export type SvakomLivePatch = {
  raw_description: string;
  gender: Gender;
  type_code: LibraryTypeCode;
  subtype_code: LibrarySubtypeCode | null;
  max_db: number | null;
  waterproof: number | null;
};

type SvakomDbRow = {
  id: string;
  original_id: string | null;
  name: string;
  current_gender: string | null;
  current_type_code: string | null;
  current_subtype_code: string | null;
  link: string;
};

function normalizeWhitespace(value: string): string {
  return String(value || '')
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

function normalizeInline(value: string): string {
  return normalizeWhitespace(value).replace(/\s*\n\s*/g, ' ').trim();
}

function uniqueStrings(values: Array<string | null | undefined>, limit = 40): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeInline(String(value || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function resolveSvakomUrl(inputUrl: string): string {
  try {
    const parsed = new URL(String(inputUrl || '').trim(), 'https://www.svakom.com');
    parsed.hostname = parsed.hostname.replace(/^www\./i, 'www.');
    return parsed.toString();
  } catch {
    return '';
  }
}

export function isCapturableSvakomProductUrl(inputUrl: string): boolean {
  const value = resolveSvakomUrl(inputUrl);
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.hostname.replace(/^www\./i, '') === SVAKOM_DOMAIN && /\/products\//i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function parseNumber(value: unknown): number | null {
  const numeric = Number(String(value ?? '').replace(/,/g, '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function parsePrice(snapshot: SvakomLiveSnapshot): { amount: number | null; currency: string } {
  const source = `${snapshot.metaDescription}\n${snapshot.bodyText}`;
  const match =
    source.match(/(?:USD|US\$|\$)\s*([0-9]+(?:\.[0-9]+)?)/i) ||
    source.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:USD|美元)/i);
  return {
    amount: parseNumber(match?.[1]),
    currency: match ? 'USD' : 'UNKNOWN',
  };
}

function inferGender(input: SvakomLivePatchInput, rawDescription: string): Gender {
  const source = `${input.name}\n${input.currentGender || ''}\n${input.snapshot.url}\n${rawDescription}`.toLowerCase();
  if (/\b(couple|partner|unisex|dual wearable)\b|情侣|双人|夫妻/i.test(source)) return 'unisex';
  if (/\b(male|men|penis|masturbator|neo)\b|男性|男用|阴茎/i.test(source)) return 'male';
  if (/\b(female|women|clitoral|panty|rabbit|g-?spot|beatrice|cici|edeny|ella|erica|avery)\b|女性|女用|阴蒂|兔|跳蛋|穿戴/i.test(source)) {
    return 'female';
  }
  return input.currentGender === 'male' || input.currentGender === 'female' || input.currentGender === 'unisex'
    ? input.currentGender
    : 'unisex';
}

function isPoweredSubtype(subtypeCode: LibrarySubtypeCode | null) {
  return subtypeCode != null && POWERED_SUBTYPES.has(subtypeCode);
}

function inferWaterproof(rawDescription: string, powered: boolean): number | null {
  if (/ipx\s*7|ipx7|waterproof|防水|全身水洗/i.test(rawDescription)) return 7;
  return powered ? 7 : null;
}

function inferMaxDb(rawDescription: string, powered: boolean): number | null {
  const maxDbMatch = rawDescription.match(/(\d{2})\s*(?:db|dB|DB|分贝)/);
  const explicit = Number(maxDbMatch?.[1]);
  if (Number.isFinite(explicit) && explicit >= 15 && explicit <= 90) return explicit;
  return powered ? 50 : null;
}

function extractProductSlug(inputUrl: string): string {
  try {
    const parsed = new URL(resolveSvakomUrl(inputUrl));
    return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).at(-1) || '').toLowerCase();
  } catch {
    return '';
  }
}

function normalizeTitleName(snapshot: SvakomLiveSnapshot, fallbackName: string): string {
  const title = normalizeInline(snapshot.title || snapshot.metaTitle)
    .replace(/\s*\|\s*SVAKOM.*$/i, '')
    .replace(/^SVAKOM出品的/i, '')
    .trim();
  if (title && fallbackName && title.toLowerCase() === fallbackName.toLowerCase()) {
    return fallbackName;
  }
  return title || fallbackName;
}

export function buildSvakomRawDescription(
  snapshot: SvakomLiveSnapshot,
  input: { name: string; currentGender: string | null },
): string {
  const name = normalizeTitleName(snapshot, input.name);
  const price = parsePrice(snapshot);
  const headings = uniqueStrings(snapshot.headings, 12);
  const bodyText = normalizeWhitespace(snapshot.bodyText).slice(0, 14000);
  const genderHint = inferGender(
    {
      name,
      currentGender: input.currentGender,
      currentTypeCode: null,
      currentSubtypeCode: null,
      snapshot,
    },
    bodyText,
  );

  return [
    '[基础信息]',
    `商品名: ${name}`,
    snapshot.metaTitle ? `页面标题: ${normalizeInline(snapshot.metaTitle)}` : '',
    snapshot.metaDescription ? `页面描述: ${normalizeInline(snapshot.metaDescription)}` : '',
    price.amount ? `页面价格(${price.currency}): ${price.amount}` : '',
    `性别提示: ${genderHint}`,
    '',
    headings.length ? '[卖点摘要]' : '',
    ...headings,
    '',
    bodyText ? '[页面正文摘录]' : '',
    bodyText,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 18000)
    .trim();
}

export function buildSvakomLivePatch(input: SvakomLivePatchInput): SvakomLivePatch {
  const rawDescription = buildSvakomRawDescription(input.snapshot, {
    name: input.name,
    currentGender: input.currentGender,
  });
  const gender = inferGender(input, rawDescription);
  const tags = uniqueStrings([input.snapshot.metaDescription, ...input.snapshot.headings], 10);
  const classifierInput = {
    name: input.name,
    rawDescription,
    tags,
    gender,
    typeCode: input.currentTypeCode || undefined,
  };
  const classifiedType = classifyLibraryTypeCode(classifierInput);
  const typeCode = classifiedType === 'unknown' && input.currentTypeCode
    ? (input.currentTypeCode as LibraryTypeCode)
    : classifiedType;
  const subtypeCode = classifyLibrarySubtypeCode({
    ...classifierInput,
    typeCode,
  });
  const override = SVAKOM_SLUG_OVERRIDES[extractProductSlug(input.snapshot.url)];
  const finalGender = override?.gender ?? gender;
  const finalTypeCode = override?.type_code ?? typeCode;
  const finalSubtypeCode = override?.subtype_code ?? subtypeCode;
  const powered = isPoweredSubtype(finalSubtypeCode);

  return {
    raw_description: rawDescription,
    gender: finalGender,
    type_code: finalTypeCode,
    subtype_code: finalSubtypeCode,
    max_db: inferMaxDb(rawDescription, powered),
    waterproof: inferWaterproof(rawDescription, powered),
  };
}

export function buildSvakomSnapshotScript(): string {
  return `(() => {
    const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const images = Array.from(document.querySelectorAll('img'))
      .map((img) =>
        normalize(
          img.getAttribute('src') ||
            img.getAttribute('data-src') ||
            img.getAttribute('srcset')?.split(',')[0]?.trim().split(/\\s+/)[0] ||
            '',
        ),
      )
      .filter(Boolean);
    const title =
      normalize(document.querySelector('h1')?.textContent || '') ||
      normalize(document.querySelector('[class*="product"][class*="title"]')?.textContent || '') ||
      normalize(document.title || '');

    return {
      url: window.location.href,
      title,
      metaTitle: normalize(document.title || ''),
      metaDescription: normalize(document.querySelector('meta[name="description"]')?.getAttribute('content') || ''),
      bodyText: String(document.body?.innerText || '').trim(),
      headings: Array.from(document.querySelectorAll('h2, h3'))
        .map((node) => normalize(node.textContent || ''))
        .filter(Boolean),
      images,
    };
  })()`;
}

async function connectToChrome(cdpEndpoint: string): Promise<Browser> {
  try {
    return await chromium.connectOverCDP(cdpEndpoint);
  } catch (error) {
    throw new Error(
      `无法连接真实 Chrome 的 CDP 端口 ${cdpEndpoint}。请先用 --remote-debugging-port=9222 启动 Chrome。原始错误: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function captureSnapshot(page: Page): Promise<SvakomLiveSnapshot> {
  return page.evaluate(buildSvakomSnapshotScript()) as Promise<SvakomLiveSnapshot>;
}

export function shouldRunSvakomLiveProductsScript(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function backfillSvakomLiveProducts() {
  const cdpEndpoint = String(process.env.SVAKOM_CDP_ENDPOINT || '').trim() || DEFAULT_CDP_ENDPOINT;
  const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  const client = await pool.connect();
  const browser = await connectToChrome(cdpEndpoint);

  try {
    const rows = await client.query<SvakomDbRow>(
      `
        SELECT
          t.id,
          t.original_id,
          t.name,
          t.gender AS current_gender,
          t.type_code AS current_type_code,
          t.subtype_code AS current_subtype_code,
          p.link
        FROM public.recommender_toys AS t
        LEFT JOIN public.products AS p
          ON t.original_id = p.id
        WHERE lower(regexp_replace(split_part(coalesce(p.link, ''), '/', 3), '^www\\.', '')) = 'svakom.com'
        ORDER BY p.link
      `,
    );

    const context = browser.contexts()[0] || (await browser.newContext());
    const page = context.pages().find((candidate) => !candidate.isClosed() && candidate.url().includes('svakom.com')) || (await context.newPage());
    let updated = 0;
    const updatedNames: string[] = [];

    await client.query('BEGIN');
    await client.query('SET statement_timeout TO 0');
    await client.query("SET lock_timeout TO '5s'");

    for (const row of rows.rows) {
      const url = resolveSvakomUrl(row.link);
      if (!isCapturableSvakomProductUrl(url)) continue;
      console.log(`[svakom-live] 打开 ${row.name}: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2500);
      const snapshot = await captureSnapshot(page);
      const patch = buildSvakomLivePatch({
        name: row.name,
        currentGender: row.current_gender,
        currentTypeCode: row.current_type_code,
        currentSubtypeCode: row.current_subtype_code,
        snapshot,
      });

      await client.query(
        `
          UPDATE public.recommender_toys
          SET raw_description = $2,
              gender = $3,
              type_code = $4,
              subtype_code = $5,
              max_db = $6,
              waterproof = $7,
              updated_at = NOW()
          WHERE id = $1::uuid
        `,
        [row.id, patch.raw_description, patch.gender, patch.type_code, patch.subtype_code, patch.max_db, patch.waterproof],
      );

      if (row.original_id) {
        await client.query(
          `
            UPDATE public.products
            SET specs = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      COALESCE(specs::jsonb, '{}'::jsonb),
                      '{rawDescription}',
                      to_jsonb($2::text),
                      true
                    ),
                    '{type_code}',
                    to_jsonb($3::text),
                    true
                  ),
                  '{subtype_code}',
                  to_jsonb($4::text),
                  true
                ),
                gender = $5
            WHERE id = $1::uuid
          `,
          [row.original_id, patch.raw_description, patch.type_code, patch.subtype_code, patch.gender.charAt(0).toUpperCase() + patch.gender.slice(1)],
        );
      }

      updated += 1;
      updatedNames.push(row.name);
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ scanned: rows.rowCount ?? 0, updated, updated_names: updatedNames }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await browser.close().catch(() => {});
    client.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunSvakomLiveProductsScript(import.meta.url, process.argv[1])) {
  backfillSvakomLiveProducts().catch((error) => {
    console.error('[backfill-svakom-live-products] 执行失败:', error);
    process.exitCode = 1;
  });
}
