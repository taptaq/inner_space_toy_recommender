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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BUFFER_PATH = path.resolve(__dirname, '../../data/master4fancy-official-review-buffer.json');
export const CLEANED_PATH = path.resolve(__dirname, '../../data/master4fancy-official-cleaned-data.json');
const RAW_TRANSLATION_CACHE_PATH = path.resolve(__dirname, '../../data/master4fancy-official-raw-description-zh-cache.json');
const FALLBACK_USD_TO_CNY_RATE = 7.2;

type Gender = 'male' | 'female' | 'unisex';

export type FxSnapshot = {
  rate: number;
  source: string;
  date: string | null;
};

type CleanerBufferItem = {
  sourceUrl?: string;
  name?: string;
  subtitle?: string;
  brand?: string;
  price?: number | null;
  priceUsd?: number | null;
  originalPriceUsd?: number | null;
  priceCurrency?: string | null;
  coverImage?: string | null;
  rawDescription?: string;
  categoryHints?: unknown;
  genderHint?: string;
  stock?: string;
  [key: string]: unknown;
};

export type NormalizedSpecs = {
  price_usd: number | null;
  price_rmb: number | null;
  original_price_usd: number | null;
  original_price_rmb: number | null;
  fx_rate_usd_cny: number;
  fx_rate_source: string;
  fx_rate_date: string | null;
  gender: Gender;
  material: string;
  appearance: string;
  physical_form: string;
  motor_type: string;
  waterproof: number | null;
  max_db: number | null;
  function_tags: string[];
  type_code: string | null;
  subtype_code: string | null;
};

export type CleanedRow = {
  sourceUrl: string;
  name: string;
  safeDisplayName: string;
  brand: string;
  price: number | null;
  coverImage: string;
  rawDescription: string;
  gender: Gender;
  material: string;
  specs: NormalizedSpecs & {
    price_source_currency: string;
    price_source_amount: number | null;
  };
  typeCode: string | null;
  subtypeCode: string | null;
};

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

function parsePositiveNumber(value: unknown): number | null {
  const parsed = Number(String(value ?? '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeGenderHint(value: unknown): Gender {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'female' || normalized === 'male' || normalized === 'unisex') {
    return normalized;
  }
  return 'unisex';
}

function uniqueStrings(values: Array<string | null | undefined>, limit = 12): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeWhitespace(String(value || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result;
}

function hasAnyHint(text: string, hints: string[]): boolean {
  const source = normalizeWhitespace(text).toLowerCase();
  return hints.some((hint) => source.includes(hint.toLowerCase()));
}

function hasAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

const APPAREL_PATTERNS = [
  /\bharness\b/i,
  /\bapparel\b/i,
  /\blingerie\b/i,
  /\blace\b/i,
  /\bbodysuit\b/i,
  /\bsleepwear\b/i,
  /\bfantasy wear\b/i,
  /情趣内衣/u,
  /内衣/u,
  /服饰/u,
  /蕾丝/u,
];

const APPAREL_EXCLUSION_PATTERNS = [
  /\bwearable\b/i,
  /\bvibrator\b/i,
  /\bremote\b/i,
  /\bcouples?\b/i,
  /\binsertable\b/i,
  /跳蛋/u,
  /震动/u,
  /遥控/u,
  /穿戴/u,
];

const TOY_SIGNAL_PATTERNS = [
  /\bwearable\b/i,
  /\bvibrator\b/i,
  /\bremote\b/i,
  /\binsertable\b/i,
  /\bsilicone\b/i,
  /\bcouples?\b/i,
  /跳蛋/u,
  /震动/u,
  /遥控/u,
  /硅胶/u,
  /入体/u,
];

function hasApparelSignals(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return false;
  if (!hasAnyPattern(normalized, APPAREL_PATTERNS)) return false;
  if (hasAnyPattern(normalized, APPAREL_EXCLUSION_PATTERNS)) return false;

  return true;
}

function inferMaterial(name: string, rawDescription: string): string {
  const text = `${name}\n${rawDescription}`.toLowerCase();
  if (/lace|lingerie|bodysuit|sleepwear|harness|strap|apparel/.test(text)) return '织物/皮革混合';
  if (/silicone/.test(text)) return '硅胶';
  if (/resin|plastic|acrylic|mold|casting/.test(text)) return '硅胶/树脂辅助材质';
  return '混合材质';
}

function inferAppearance(text: string): string {
  return /harness|wear|lingerie|apparel|strap|bodysuit|sleepwear|穿戴|服饰/i.test(text) ? 'high_disguise' : 'normal';
}

function inferPhysicalForm(text: string): string {
  if (/dildo|insertable|internal|g-spot|vaginal|plug|anal|prostate|egg/i.test(text)) return 'internal';
  return 'external';
}

function inferMotorType(text: string): string {
  if (/vibrat|powerful|intense|strong|rumbl|motor|震动|振动|强劲/i.test(text)) return 'strong';
  return 'gentle';
}

function inferWaterproof(text: string): number | null {
  const ipxMatch = text.match(/ipx\s*([0-9])/i);
  if (ipxMatch) return Number(ipxMatch[1]);
  return /waterproof|防水/i.test(text) ? 7 : null;
}

function collectClassifierTags(item: Record<string, unknown>, rawDescription: string): string[] {
  const rawTags = Array.isArray(item.categoryHints)
    ? item.categoryHints.filter((value): value is string => typeof value === 'string')
    : [];
  const signalText = `${item.name || ''}\n${item.subtitle || ''}\n${rawDescription}`;
  const shouldTagAsApparel = hasApparelSignals(signalText);

  return uniqueStrings([
    ...rawTags,
    hasAnyHint(signalText, ['fantasy']) ? 'fantasy' : null,
    hasAnyHint(signalText, ['dildo']) ? 'dildo' : null,
    hasAnyHint(signalText, ['insertable', 'internal']) ? 'insertable' : null,
    hasAnyHint(signalText, ['egg']) ? 'egg' : null,
    hasAnyHint(signalText, ['mold', 'casting']) ? 'mold' : null,
    hasAnyHint(signalText, ['accessory', 'accessories']) ? 'accessory' : null,
    hasAnyHint(signalText, ['harness']) ? 'harness' : null,
    hasAnyHint(signalText, ['wear', 'apparel']) ? 'wearable' : null,
    shouldTagAsApparel && hasAnyHint(signalText, ['lingerie', 'lace', 'bodysuit', 'sleepwear', 'apparel']) ? 'lingerie' : null,
  ]);
}

function resolveMaster4FancyClassification(item: Record<string, unknown>, rawDescription: string) {
  const name = normalizeWhitespace(String(item.name || ''));
  const subtitle = normalizeWhitespace(String(item.subtitle || ''));
  const signalText = [name, subtitle, rawDescription].filter(Boolean).join('\n');
  const gender = normalizeGenderHint(item.genderHint);
  const tags = collectClassifierTags(item, rawDescription);
  const classifierInput = {
    gender,
    physicalForm: null,
    name,
    rawDescription,
    tags,
  };

  const classifierTypeCode = classifyLibraryTypeCode(classifierInput);
  const classifierSubtypeCode = classifyLibrarySubtypeCode({
    ...classifierInput,
    typeCode: classifierTypeCode,
  });

  const isApparel = hasApparelSignals(signalText);
  const isAccessory = !isApparel && hasAnyHint(signalText, ['accessory', 'mold', 'casting', 'kit', 'stand']);
  const hasToySignals = hasAnyPattern(signalText, TOY_SIGNAL_PATTERNS);
  const looksDildo = hasAnyHint(signalText, [
    'dildo',
    'insertable',
    'internal firmness',
    'fantasy dildo',
    '假阳具',
    '入体探索',
    '内部支撑',
    '入体',
  ]);
  const shouldReclassifyToyFromCareAccessory =
    classifierTypeCode === 'care_accessory' &&
    !isApparel &&
    hasToySignals;

  if (shouldReclassifyToyFromCareAccessory) {
    const scrubbedClassifierInput = {
      ...classifierInput,
      name: name.replace(/\b(lace|harness|apparel|lingerie|sleepwear|bodysuit)\b/gi, ' '),
      rawDescription: rawDescription.replace(/\b(lace|harness|apparel|lingerie|sleepwear|bodysuit)\b/gi, ' '),
      tags: tags.filter((tag) => !['lingerie', 'harness'].includes(tag)),
    };
    const scrubbedTypeCode = classifyLibraryTypeCode(scrubbedClassifierInput);
    const scrubbedSubtypeCode = classifyLibrarySubtypeCode({
      ...scrubbedClassifierInput,
      typeCode: scrubbedTypeCode,
    });

    if (scrubbedTypeCode !== 'care_accessory' && scrubbedTypeCode !== 'unknown') {
      return {
        type_code: looksDildo && scrubbedTypeCode === 'insertable' ? 'dildo' : scrubbedTypeCode,
        subtype_code: scrubbedSubtypeCode,
        classifierTypeCode: scrubbedTypeCode,
        classifierSubtypeCode: scrubbedSubtypeCode,
        tags,
      };
    }
  }

  if (isApparel) {
    return {
      type_code: 'care_accessory',
      subtype_code: 'lingerie',
      classifierTypeCode,
      classifierSubtypeCode,
      tags,
    };
  }

  if (isAccessory) {
    return {
      type_code: 'care_accessory',
      subtype_code: classifierSubtypeCode,
      classifierTypeCode,
      classifierSubtypeCode,
      tags,
    };
  }

  if (looksDildo && classifierTypeCode === 'insertable') {
    return {
      type_code: 'dildo',
      subtype_code: classifierSubtypeCode,
      classifierTypeCode,
      classifierSubtypeCode,
      tags,
    };
  }

  return {
    type_code: classifierTypeCode,
    subtype_code: classifierSubtypeCode,
    classifierTypeCode,
    classifierSubtypeCode,
    tags,
  };
}

function inferFunctionTags(signalText: string, typeCode: string | null, subtypeCode: string | null): string[] {
  const isApparel = subtypeCode === 'lingerie' || hasApparelSignals(signalText);
  const isAccessory = !isApparel && (typeCode === 'care_accessory' || hasAnyHint(signalText, ['accessory', 'mold', 'casting', 'kit']));

  if (isApparel) {
    return uniqueStrings([
      '服饰',
      hasAnyHint(signalText, ['harness', 'strap']) ? '穿戴' : null,
      hasAnyHint(signalText, ['adjustable', 'strap']) ? '可调节' : null,
      hasAnyHint(signalText, ['lace', 'lingerie']) ? '蕾丝' : null,
    ]);
  }

  if (isAccessory) {
    return uniqueStrings([
      '配件',
      hasAnyHint(signalText, ['mold', 'casting']) ? '模具辅助' : null,
      hasAnyHint(signalText, ['kit']) ? '套装配件' : null,
      hasAnyHint(signalText, ['portable', 'travel']) ? '便携' : null,
    ]);
  }

  return uniqueStrings([
    hasAnyHint(signalText, ['fantasy']) ? '奇幻造型' : null,
    hasAnyHint(signalText, ['dildo', 'insertable', '假阳具', '入体']) ? '入体探索' : null,
    hasAnyHint(signalText, ['silicone']) ? '硅胶触感' : null,
    hasAnyHint(signalText, ['egg']) ? '蛋形' : null,
    hasAnyHint(signalText, ['waterproof', 'ipx']) ? '防水' : null,
  ]);
}

const isTransientDbError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Connection terminated|ECONNRESET|server closed the connection|terminating connection|Can't reach database|P1001|P1017/i.test(
    message,
  );
};

async function reconnectPrisma() {
  await prisma.$disconnect().catch(() => {});
  await sleep(800);
  await prisma.$connect();
}

async function ensurePrismaConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    if (!isTransientDbError(error)) throw error;
    console.warn('[DB] 检测到连接已断开，正在重建 Prisma 连接...');
    await reconnectPrisma();
  }
}

async function withDbRetry<T>(label: string, action: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await ensurePrismaConnection();
      return await action();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === 3) break;
      console.warn(`[DB] ${label} 遇到瞬断，重连后重试 (${attempt}/3)...`);
      await reconnectPrisma();
      await sleep(1000 * attempt);
    }
  }

  throw lastError;
}

export function resolveRmbPrice(usd: number | null, rate = FALLBACK_USD_TO_CNY_RATE): number | null {
  if (!Number.isFinite(Number(usd)) || Number(usd) <= 0) return null;
  return Math.round(Number(usd) * rate);
}

async function refreshUsdToCnyRate(): Promise<FxSnapshot> {
  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY', {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = (await response.json()) as { date?: string; rates?: Record<string, number> };
    const liveRate = Number(payload?.rates?.CNY);
    if (!Number.isFinite(liveRate) || liveRate <= 0) throw new Error('missing CNY rate');

    return {
      rate: liveRate,
      source: 'frankfurter',
      date: String(payload?.date || '').trim() || null,
    };
  } catch (error) {
    console.warn(`[汇率] 实时汇率获取失败，回退到固定汇率 USD/CNY=${FALLBACK_USD_TO_CNY_RATE}:`, error);
    return {
      rate: FALLBACK_USD_TO_CNY_RATE,
      source: 'fallback',
      date: null,
    };
  }
}

export function formatMaster4FancyRawDescription(input: string): string {
  const normalized = String(input || '').replace(/\r/g, '\n');
  if (!normalized.trim()) return '';

  return normalized
    .replace(/\s*(features|materials|care|description|details|specifications)\s*:/gi, '\n$1: ')
    .replace(/:\s+/g, ': ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function translateForPersistence(rawDescription: string, canonicalName: string): Promise<string> {
  if (!hasMeaningfulEnglish(rawDescription)) {
    return formatMaster4FancyRawDescription(rawDescription);
  }

  try {
    const translatedRawDescription = await translateRawDescriptionToZh(rawDescription, {
      cachePath: RAW_TRANSLATION_CACHE_PATH,
      logLabel: canonicalName,
    });

    const finalizedRawDescription = resolvePersistedRawDescription(translatedRawDescription, rawDescription);
    return formatMaster4FancyRawDescription(finalizedRawDescription);
  } catch (error) {
    console.warn(`[翻译] ${canonicalName} 翻译失败，保留原始描述。`, error);
    return formatMaster4FancyRawDescription(rawDescription);
  }
}

export function buildNormalizedSpecs(item: Record<string, unknown>, fx: FxSnapshot): NormalizedSpecs {
  const rawDescription = normalizeWhitespace(String(item.rawDescription || ''));
  const priceUsd = parsePositiveNumber(item.priceUsd ?? item.price ?? null);
  const originalPriceUsd = parsePositiveNumber(item.originalPriceUsd ?? null);
  const gender = normalizeGenderHint(item.genderHint);
  const classification = resolveMaster4FancyClassification(item, rawDescription);
  const signalText = [item.name, item.subtitle, rawDescription, ...classification.tags].filter(Boolean).join('\n');

  return {
    price_usd: priceUsd,
    price_rmb: resolveRmbPrice(priceUsd, fx.rate),
    original_price_usd: originalPriceUsd,
    original_price_rmb: resolveRmbPrice(originalPriceUsd, fx.rate),
    fx_rate_usd_cny: fx.rate,
    fx_rate_source: fx.source,
    fx_rate_date: fx.date,
    gender,
    material: inferMaterial(String(item.name || ''), rawDescription),
    appearance: inferAppearance(signalText),
    physical_form: inferPhysicalForm(signalText),
    motor_type: inferMotorType(signalText),
    waterproof: inferWaterproof(signalText),
    max_db: null,
    function_tags: inferFunctionTags(signalText, classification.type_code, classification.subtype_code),
    type_code: classification.type_code,
    subtype_code: classification.subtype_code,
  };
}

function buildProductPayload(cleanedRow: CleanedRow, persistedRawDescription: string) {
  return {
    name: cleanedRow.name,
    price: cleanedRow.price,
    image: cleanedRow.coverImage || null,
    link: cleanedRow.sourceUrl || null,
    specs: {
      ...cleanedRow.specs,
      rawDescription: persistedRawDescription || null,
    } as any,
    gender: cleanedRow.gender.charAt(0).toUpperCase() + cleanedRow.gender.slice(1),
    tags: cleanedRow.specs.function_tags,
  };
}

function buildToyPayload(cleanedRow: CleanedRow, persistedRawDescription: string) {
  return {
    name: cleanedRow.name,
    safe_display_name: cleanedRow.safeDisplayName,
    brand: 'Master4Fancy',
    price: cleanedRow.price,
    max_db: cleanedRow.specs.max_db,
    waterproof: cleanedRow.specs.waterproof,
    appearance: cleanedRow.specs.appearance,
    physical_form: cleanedRow.specs.physical_form,
    motor_type: cleanedRow.specs.motor_type,
    gender: cleanedRow.gender,
    material: cleanedRow.material,
    image_url: cleanedRow.coverImage || null,
    raw_description: persistedRawDescription || null,
    type_code: cleanedRow.typeCode,
    subtype_code: cleanedRow.subtypeCode,
    updated_at: new Date(),
  };
}

async function syncCleanedRowToDb(cleanedRow: CleanedRow, persistedRawDescription: string) {
  const canonicalName = cleanedRow.name;
  const productPayload = buildProductPayload(cleanedRow, persistedRawDescription);
  const toyPayload = buildToyPayload(cleanedRow, persistedRawDescription);

  await withDbRetry(`同步商品 ${canonicalName}`, async () => {
    await prisma.$transaction(async (tx) => {
      const existingProduct = await tx.products.findFirst({ where: { name: canonicalName } });
      let originalId: string;

      if (existingProduct) {
        const updated = await tx.products.update({
          where: { id: existingProduct.id },
          data: productPayload,
        });
        originalId = updated.id;
      } else {
        const created = await tx.products.create({ data: productPayload });
        originalId = created.id;
      }

      await tx.recommender_toys.deleteMany({ where: { name: canonicalName } });
      await tx.recommender_toys.create({
        data: {
          original_id: originalId,
          ...toyPayload,
        },
      });
    });
  });
}

export async function runCleaner(): Promise<CleanedRow[]> {
  if (!fs.existsSync(BUFFER_PATH)) {
    console.error('[中断] 未发现 master4fancy-official review-buffer。');
    return [];
  }

  const bufferData = JSON.parse(fs.readFileSync(BUFFER_PATH, 'utf8')) as Array<Record<string, unknown>>;
  const prepared = prepareUniqueBufferItemsForCleaning(bufferData);
  const fx = await refreshUsdToCnyRate();
  const cleanedRows: CleanedRow[] = [];

  for (const item of prepared.items as CleanerBufferItem[]) {
    const canonicalName = normalizeWhitespace(
      extractCanonicalName(String(item.rawDescription || ''), String(item.name || '')),
    );
    if (isPlaceholderProductName(canonicalName)) continue;

    const persistedRawDescription = await translateForPersistence(String(item.rawDescription || ''), canonicalName);
    const specs = buildNormalizedSpecs(
      {
        ...item,
        name: canonicalName,
        rawDescription: persistedRawDescription,
      },
      fx,
    );

    const cleanedRow: CleanedRow = {
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
        price_source_currency: normalizeWhitespace(String(item.priceCurrency || 'USD')) || 'USD',
        price_source_amount: specs.price_usd,
      },
      typeCode: specs.type_code,
      subtypeCode: specs.subtype_code,
    };

    cleanedRows.push(cleanedRow);

    try {
      await syncCleanedRowToDb(cleanedRow, persistedRawDescription);
    } catch (error) {
      console.error(`[故障] 数据处理失败: ${canonicalName}`, error);
    }
  }

  const dir = path.dirname(CLEANED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CLEANED_PATH, JSON.stringify(cleanedRows, null, 2));

  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});

  return cleanedRows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCleaner().catch((error) => {
    console.error(error);
    prisma.$disconnect().catch(() => {});
    pool.end().catch(() => {});
    process.exitCode = 1;
  });
}
