import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
} from '../../lib/library-product-type-classifier.ts';
import { buildSafeDisplayName } from '../../lib/product-display-name.ts';
import { translateRawDescriptionToZh } from '../shared/raw-description-translator.ts';
import {
  extractCanonicalName,
  hasMeaningfulEnglish,
  isPlaceholderProductName,
  prepareUniqueBufferItemsForCleaning,
  resolvePersistedRawDescription,
} from '../nomitang-official/cleaner-helpers.ts';
import { ensureCompetitorRecord } from '../shared/competitor-registry.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BUFFER_PATH = path.resolve(__dirname, '../../data/funfactory-official-review-buffer.json');
export const CLEANED_PATH = path.resolve(__dirname, '../../data/funfactory-official-cleaned-data.json');
const RAW_TRANSLATION_CACHE_PATH = path.resolve(
  __dirname,
  '../../data/funfactory-official-raw-description-zh-cache.json',
);
const BRAND_NAME = 'Fun Factory';
const FALLBACK_EUR_TO_CNY_RATE = 7.8;

type Gender = 'male' | 'female' | 'unisex';

export type FxSnapshot = {
  rate: number;
  source: string;
  date: string | null;
  currency: string;
};

type CleanerBufferItem = {
  sourceUrl?: string;
  name?: string;
  subtitle?: string;
  priceSourceAmount?: number | null;
  originalPriceSourceAmount?: number | null;
  priceCurrency?: string | null;
  coverImage?: string | null;
  rawDescription?: string;
  categoryHints?: unknown;
  genderHint?: string;
  [key: string]: unknown;
};

export type NormalizedSpecs = {
  price_source_currency: string;
  price_source_amount: number | null;
  original_price_source_amount: number | null;
  price_rmb: number | null;
  original_price_rmb: number | null;
  fx_rate_to_cny: number;
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
  specs: NormalizedSpecs;
  typeCode: string | null;
  subtypeCode: string | null;
};

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function resolveRmbPrice(amount: number | null, rate: number): number | null {
  if (!amount || !Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * rate);
}

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

function uniqueStrings(values: Array<string | null | undefined>, limit = 24): string[] {
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

export function normalizeFunFactorySourceAmount(
  value: unknown,
  currency: string,
): number | null {
  if (value == null) return null;

  const normalizedCurrency = String(currency || '').trim().toUpperCase();
  const raw = typeof value === 'number' ? String(value) : String(value).trim();
  if (!raw) return null;

  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    if (normalizedCurrency === 'EUR' && Number.isInteger(parsed) && parsed >= 1000) {
      return parsed / 100;
    }
    return parsed;
  }

  return null;
}

export function buildLocalizedDescription(input: {
  name?: string;
  subtitle?: string;
  rawDescription?: string;
  translatedRawDescription?: string;
}) {
  return uniqueStrings(
    [
      input.name ? `产品名：${input.name}` : null,
      input.subtitle ? `定位：${input.subtitle}` : null,
      input.translatedRawDescription || null,
      input.rawDescription || null,
    ],
    20,
  ).join('\n');
}

function hasAnyHint(text: string, hints: string[]): boolean {
  const source = normalizeWhitespace(text).toLowerCase();
  return hints.some((hint) => source.includes(hint.toLowerCase()));
}

function normalizeFunFactorySignalText(text: string): string {
  return normalizeWhitespace(text)
    .replace(/g[\s-]*punkt/gi, 'g点')
    .replace(/g[\s-]*spot/gi, 'g点')
    .replace(/klitoris/gi, '阴蒂')
    .replace(/clitoral/gi, '阴蒂')
    .replace(/clitoris/gi, '阴蒂')
    .replace(/wasserdicht/gi, '防水')
    .replace(/wiederaufladbar/gi, '可充电')
    .replace(/menge/gi, '')
    .trim();
}

function normalizeSourceCurrency(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return 'EUR';
  if (normalized === '€' || normalized === 'EUR') return 'EUR';
  if (normalized === '¥' || normalized === '￥' || normalized === 'CNY' || normalized === 'RMB') return 'CNY';
  return normalized;
}

function normalizeGenderHint(value: unknown): Gender {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'female' || normalized === 'male' || normalized === 'unisex') return normalized;
  return 'unisex';
}

export function inferFunFactoryGender(text: string): Gender {
  const normalized = normalizeFunFactorySignalText(text).toLowerCase();
  if (
    [
      'klitoris',
      'clitoral',
      'clitoris',
      'cunnilingus',
      'g-punkt',
      'g spot',
      'g点',
      'vaginal',
      'rabbit',
      'auflegevibrator',
      '女性',
      '阴道',
      '阴蒂',
      '女用',
    ].some((hint) => normalized.includes(hint))
  ) {
    return 'female';
  }

  if (
    [
      '男女通用',
      '情侣',
      '双人',
      '共用',
      'for two',
      'couple',
      'couples',
      'pair',
      'zu zweit',
      '双人互动',
      '夫妻',
    ].some((hint) => normalized.includes(hint))
  ) {
    return 'unisex';
  }

  if (
    [
      'penis',
      'male',
      'men',
      'männer',
      'herren',
      '男用',
      '男性',
      '男士',
      '前列腺',
      'prostate',
      'cock',
      'stroker',
      'mr boss',
      'for him',
    ].some((hint) => normalized.includes(hint))
  ) {
    return 'male';
  }

  return 'female';
}

function inferMaterial(name: string, rawDescription: string): string {
  const text = normalizeFunFactorySignalText(`${name}\n${rawDescription}`).toLowerCase();
  if (/silicone|silikon/.test(text)) return '硅胶';
  if (/abs|plastic/.test(text)) return 'ABS/硅胶复合';
  if (/metal|steel/.test(text)) return '金属';
  return '硅胶';
}

function inferAppearance(text: string): string {
  return /quiet|discreet|compact|portable|travel|静音|便携/i.test(normalizeFunFactorySignalText(text))
    ? 'high_disguise'
    : 'normal';
}

function inferPhysicalForm(text: string): string {
  const normalized = normalizeFunFactorySignalText(text);
  if (/anal|insert|insertable|internal|g点|vaginal|后庭|插入/i.test(normalized)) {
    return 'internal';
  }
  return 'external';
}

function inferMotorType(text: string): string {
  return /powerful|strong|intense|deep|rumbly|强劲|强烈/i.test(normalizeFunFactorySignalText(text))
    ? 'strong'
    : 'gentle';
}

function inferWaterproof(text: string): number | null {
  const normalized = normalizeFunFactorySignalText(text);
  const ipxMatch = normalized.match(/ipx\s*([0-9])/i);
  if (ipxMatch?.[1]) return Number(ipxMatch[1]);
  return /waterproof|防水/i.test(normalized) ? 7 : null;
}

function inferFunctionTags(text: string): string[] {
  const normalized = normalizeFunFactorySignalText(text);
  return uniqueStrings([
    hasAnyHint(normalized, ['vibrator', 'vibration', 'vibrating', '震动', '振动']) ? '震动刺激' : null,
    hasAnyHint(normalized, ['anal', '后庭']) ? '后庭' : null,
    hasAnyHint(normalized, ['g点']) ? 'G点刺激' : null,
    hasAnyHint(normalized, ['waterproof', '防水']) ? '防水' : null,
    hasAnyHint(normalized, ['rechargeable', 'usb', 'charging', '充电', '可充电']) ? '可充电' : null,
    hasAnyHint(normalized, ['silicone', 'silikon']) ? '硅胶材质' : null,
  ]);
}

function inferMaxDb(text: string, motorType: string): number | null {
  const normalized = normalizeFunFactorySignalText(text);
  if (/(\d{2})\s*(?:db|分贝)/i.test(normalized)) {
    return Number(normalized.match(/(\d{2})\s*(?:db|分贝)/i)?.[1] || '');
  }
  if (/max\s*noise\s*(\d{2})/i.test(normalized)) {
    return Number(normalized.match(/max\s*noise\s*(\d{2})/i)?.[1] || '');
  }
  if (/keine vibration|no vibration|non-vibration|manual|handbetrieb/i.test(normalized)) {
    return null;
  }
  if (
    motorType !== 'gentle' ||
    /vibrator|vibration|vibrationsprogramme|druckwellen|pulsator|rechargeable|usb-c|batterie|wiederaufladbar|可充电|振动|脉冲/i.test(
      normalized,
    )
  ) {
    return 50;
  }
  return null;
}

const isTransientDbError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Connection terminated|ECONNRESET|server closed the connection|terminating connection|Can't reach database|P1001|P1017/i.test(message);
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
      await reconnectPrisma();
      await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

async function refreshCurrencyToCnyRate(currency: string): Promise<FxSnapshot> {
  const normalized = normalizeSourceCurrency(currency);
  if (normalized === 'CNY') {
    return { rate: 1, source: 'identity', date: null, currency: 'CNY' };
  }
  return { rate: FALLBACK_EUR_TO_CNY_RATE, source: 'fallback', date: null, currency: normalized };
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = Number(String(value ?? '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function buildNormalizedSpecs(
  item: CleanerBufferItem,
  fxSnapshot: FxSnapshot,
): NormalizedSpecs {
  const rawDescription = normalizeFunFactorySignalText(String(item.rawDescription || ''));
  const signalText = [
    String(item.name || ''),
    String(item.subtitle || ''),
    rawDescription,
    ...(Array.isArray(item.categoryHints)
      ? item.categoryHints.filter((value): value is string => typeof value === 'string')
      : []),
  ]
    .join('\n')
    .trim();
  const gender = inferFunFactoryGender(signalText);
  const material = inferMaterial(String(item.name || ''), rawDescription);
  const physicalForm = inferPhysicalForm(signalText);
  const sourceAmount = normalizeFunFactorySourceAmount(item.priceSourceAmount, String(item.priceCurrency || fxSnapshot.currency || 'EUR'));
  const originalSourceAmount = normalizeFunFactorySourceAmount(item.originalPriceSourceAmount, String(item.priceCurrency || fxSnapshot.currency || 'EUR'));
  const typeCode = classifyLibraryTypeCode({
    gender,
    physicalForm,
    name: String(item.name || ''),
    rawDescription,
    tags: Array.isArray(item.categoryHints)
      ? item.categoryHints.filter((value): value is string => typeof value === 'string')
      : [],
  });
  const subtypeCode = classifyLibrarySubtypeCode({
    typeCode,
    gender,
    physicalForm,
    name: String(item.name || ''),
    rawDescription,
    tags: Array.isArray(item.categoryHints)
      ? item.categoryHints.filter((value): value is string => typeof value === 'string')
      : [],
  });

  return {
    price_source_currency: normalizeSourceCurrency(item.priceCurrency ?? fxSnapshot.currency ?? 'EUR'),
    price_source_amount: sourceAmount,
    original_price_source_amount: originalSourceAmount,
    price_rmb: resolveRmbPrice(sourceAmount, fxSnapshot.rate),
    original_price_rmb: resolveRmbPrice(originalSourceAmount, fxSnapshot.rate),
    fx_rate_to_cny: fxSnapshot.rate,
    fx_rate_source: fxSnapshot.source,
    fx_rate_date: fxSnapshot.date,
    gender,
    material,
    appearance: inferAppearance(signalText),
    physical_form: physicalForm,
    motor_type: inferMotorType(signalText),
    waterproof: inferWaterproof(signalText),
    max_db: inferMaxDb(signalText, inferMotorType(signalText)),
    function_tags: inferFunctionTags(signalText),
    type_code: typeCode,
    subtype_code: subtypeCode,
  };
}

async function loadTranslationCache() {
  if (!fs.existsSync(RAW_TRANSLATION_CACHE_PATH)) {
    return {} as Record<string, string>;
  }
  return JSON.parse(fs.readFileSync(RAW_TRANSLATION_CACHE_PATH, 'utf8')) as Record<string, string>;
}

async function saveTranslationCache(cache: Record<string, string>) {
  fs.mkdirSync(path.dirname(RAW_TRANSLATION_CACHE_PATH), { recursive: true });
  fs.writeFileSync(RAW_TRANSLATION_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

async function translateForPersistence(rawDescription: string, canonicalName: string) {
  const normalizedRaw = normalizeWhitespace(rawDescription);
  if (!normalizedRaw) return '';
  if (!hasMeaningfulEnglish(normalizedRaw)) return resolvePersistedRawDescription(normalizedRaw, normalizedRaw);
  try {
    const translated = await translateRawDescriptionToZh(normalizedRaw, {
      cachePath: RAW_TRANSLATION_CACHE_PATH,
      logLabel: 'funfactory-official',
    });
    return resolvePersistedRawDescription(translated, normalizedRaw);
  } catch {
    return resolvePersistedRawDescription(normalizedRaw, normalizedRaw);
  }
}

export async function runCleaner(): Promise<CleanedRow[]> {
  if (!fs.existsSync(BUFFER_PATH)) {
    await prisma.$disconnect().catch(() => {});
    return [];
  }

  const bufferData = JSON.parse(fs.readFileSync(BUFFER_PATH, 'utf8')) as Array<Record<string, unknown>>;
  if (bufferData.length === 0) {
    fs.writeFileSync(CLEANED_PATH, JSON.stringify([], null, 2));
    await prisma.$disconnect().catch(() => {});
    return [];
  }

  const prepared = prepareUniqueBufferItemsForCleaning(bufferData);
  console.log(`[clean] review-buffer 已载入 ${prepared.items.length} 条`);
  const fx = await refreshCurrencyToCnyRate(String((prepared.items[0] as CleanerBufferItem)?.priceCurrency || 'EUR'));
  const cleanedRows: CleanedRow[] = [];
  let brandId: string | null = null;
  const translationCache = await loadTranslationCache();

  try {
    brandId = await ensureCompetitorRecord({
      prisma,
      withDbRetry,
      brandName: BRAND_NAME,
    });
  } catch (error) {
    console.warn('[警告] competitors 关联失败，将继续非关联入库。', error);
  }

  for (const [index, item] of (prepared.items as CleanerBufferItem[]).entries()) {
    const canonicalName = normalizeWhitespace(
      extractCanonicalName(String(item.rawDescription || ''), String(item.name || '')),
    );
    if (isPlaceholderProductName(canonicalName)) continue;
    console.log(`[clean] 处理 ${index + 1}/${prepared.items.length}: ${canonicalName || item.name || 'Unnamed Item'}`);
    const persistedRawDescription = await translateForPersistence(String(item.rawDescription || ''), canonicalName);
    translationCache[persistedRawDescription] = persistedRawDescription;
    const specs = buildNormalizedSpecs({ ...item, name: canonicalName, rawDescription: persistedRawDescription }, fx);

    const cleanedRow: CleanedRow = {
      sourceUrl: String(item.sourceUrl || ''),
      name: canonicalName,
      safeDisplayName: buildSafeDisplayName(canonicalName),
      brand: BRAND_NAME,
      price: specs.price_rmb,
      coverImage: String(item.coverImage || ''),
      rawDescription: persistedRawDescription,
      gender: specs.gender,
      material: specs.material,
      specs,
      typeCode: specs.type_code,
      subtypeCode: specs.subtype_code,
    };

    cleanedRows.push(cleanedRow);

    const productPayload = {
      name: canonicalName,
      price: specs.price_rmb,
      image: cleanedRow.coverImage || null,
      link: cleanedRow.sourceUrl || null,
      specs: {
        ...cleanedRow.specs,
        rawDescription: persistedRawDescription || null,
      } as any,
      gender: specs.gender === 'male' ? 'Male' : specs.gender === 'female' ? 'Female' : 'Unisex',
      tags: specs.function_tags,
      competitor_id: brandId ?? undefined,
    };

    const toyPayload = {
      name: canonicalName,
      safe_display_name: cleanedRow.safeDisplayName,
      brand: BRAND_NAME,
      price: specs.price_rmb,
      max_db: specs.max_db,
      waterproof: specs.waterproof,
      appearance: specs.appearance,
      physical_form: specs.physical_form,
      motor_type: specs.motor_type,
      gender: specs.gender,
      material: specs.material,
      image_url: cleanedRow.coverImage || null,
      raw_description: persistedRawDescription || null,
      type_code: specs.type_code,
      subtype_code: specs.subtype_code,
      updated_at: new Date(),
    };

    try {
      await withDbRetry(`同步商品 ${canonicalName}`, async () => {
        const existingProduct = await prisma.products.findFirst({ where: { name: canonicalName } });
        let originalId: string;
        if (existingProduct) {
          const updated = await prisma.products.update({ where: { id: existingProduct.id }, data: productPayload });
          originalId = updated.id;
        } else {
          const created = await prisma.products.create({ data: productPayload });
          originalId = created.id;
        }

        await prisma.recommender_toys.deleteMany({ where: { name: canonicalName } });
        await prisma.recommender_toys.create({
          data: {
            original_id: originalId,
            ...toyPayload,
          },
        });
      });
    } catch (error) {
      console.error(`[故障] 数据处理失败: ${canonicalName}`, error);
    }
  }

  await saveTranslationCache(translationCache);
  const dir = path.dirname(CLEANED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CLEANED_PATH, JSON.stringify(cleanedRows, null, 2));
  console.log(`[clean] cleaned-data 已写入 ${cleanedRows.length} 条: ${CLEANED_PATH}`);
  await prisma.$disconnect().catch(() => {});
  return cleanedRows;
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  runCleaner().catch((error) => {
    console.error('[funfactory-official] cleaner 执行失败:', error);
    process.exitCode = 1;
  });
}

export default runCleaner;
