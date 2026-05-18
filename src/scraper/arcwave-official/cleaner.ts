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
import { ensureCompetitorRecord } from '../shared/competitor-registry.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const BUFFER_PATH = path.resolve(__dirname, '../../data/arcwave-official-review-buffer.json');
export const CLEANED_PATH = path.resolve(__dirname, '../../data/arcwave-official-cleaned-data.json');
const RAW_TRANSLATION_CACHE_PATH = path.resolve(__dirname, '../../data/arcwave-official-raw-description-zh-cache.json');
const BRAND_NAME = 'Arcwave';

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const FALLBACK_USD_TO_CNY_RATE = 7.2;
let usdToCnyRate = FALLBACK_USD_TO_CNY_RATE;
let usdToCnyRateDate = '';
let usdToCnyRateSource = 'fallback';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function refreshUsdToCnyRate() {
  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY', {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = (await response.json()) as {
      date?: string;
      rates?: Record<string, number>;
    };
    const liveRate = Number(payload?.rates?.CNY);
    if (!Number.isFinite(liveRate) || liveRate <= 0) {
      throw new Error('missing CNY rate');
    }

    usdToCnyRate = liveRate;
    usdToCnyRateDate = String(payload?.date || '').trim();
    usdToCnyRateSource = 'frankfurter';
  } catch {
    usdToCnyRate = FALLBACK_USD_TO_CNY_RATE;
    usdToCnyRateDate = '';
    usdToCnyRateSource = 'fallback';
  }
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

function parsePositiveNumber(value: unknown): number | null {
  const parsed = Number(String(value ?? '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function uniqueStrings(values: Array<string | null | undefined>, limit = 20): string[] {
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

function resolveRmbPrice(usd: number | null): number | null {
  if (!Number.isFinite(Number(usd)) || Number(usd) <= 0) return null;
  return Math.round(Number(usd) * usdToCnyRate);
}

function inferMaterial(text: string): string {
  const value = text.toLowerCase();
  if (/silicone/.test(value) && /abs|plastic/.test(value)) return 'ABS/硅胶复合';
  if (/silicone/.test(value)) return '硅胶';
  if (/abs|plastic/.test(value)) return 'ABS/硅胶复合';
  if (/metal|aluminum|steel/.test(value)) return '金属';
  return '硅胶';
}

function inferAppearance(text: string): string {
  return /discreet|quiet|travel|portable|便携|静音/i.test(text) ? 'high_disguise' : 'normal';
}

function inferPhysicalForm(text: string): string {
  if (/prostate|anal|insert|internal|插入|肛门|前列腺/i.test(text)) return 'internal';
  return 'external';
}

function inferMotorType(text: string): string {
  return /powerful|intense|strong|强劲|强烈|air pulse/i.test(text) ? 'strong' : 'gentle';
}

function inferWaterproof(text: string): number | null {
  const ipx = text.match(/ipx\s*([0-9])/i)?.[1];
  if (ipx) return Number(ipx);
  return /waterproof|splashproof|water-resistant|防水/i.test(text) ? 7 : null;
}

function inferFunctionTags(text: string): string[] {
  return uniqueStrings([
    /air pulse|pulse/i.test(text) ? '脉冲刺激' : null,
    /thrust|stroker|masturbator/i.test(text) ? '男性自慰' : null,
    /prostate/i.test(text) ? '前列腺刺激' : null,
    /quiet|silent/i.test(text) ? '静音' : null,
    /waterproof|ipx/i.test(text) ? '防水' : null,
    /rechargeable|usb|charging/i.test(text) ? '可充电' : null,
  ]);
}

function loadTranslationCache(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(RAW_TRANSLATION_CACHE_PATH, 'utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveTranslationCache(cache: Record<string, string>) {
  const dir = path.dirname(RAW_TRANSLATION_CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(RAW_TRANSLATION_CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function translateForPersistence(rawDescription: string, canonicalName: string): Promise<string> {
  const normalizedRaw = normalizeWhitespace(rawDescription);
  if (!hasMeaningfulEnglish(normalizedRaw)) return normalizedRaw;

  const cache = loadTranslationCache();
  const cacheKey = canonicalName || normalizedRaw.slice(0, 120);
  if (cache[cacheKey]) {
    return resolvePersistedRawDescription(cache[cacheKey], normalizedRaw);
  }

  try {
    const translated = await translateRawDescriptionToZh(normalizedRaw);
    const persisted = resolvePersistedRawDescription(translated, normalizedRaw);
    cache[cacheKey] = persisted;
    saveTranslationCache(cache);
    return persisted;
  } catch {
    return normalizedRaw;
  }
}

export async function runCleaner() {
  console.log('--- 启动 Arcwave 官方站 AI 清洗与入库模块 ---');

  if (!fs.existsSync(BUFFER_PATH)) {
    await prisma.$disconnect().catch(() => {});
    return [];
  }

  await refreshUsdToCnyRate();

  const bufferData = JSON.parse(fs.readFileSync(BUFFER_PATH, 'utf-8'));
  const prepared = prepareUniqueBufferItemsForCleaning(bufferData);
  const cleanedData: any[] = [];

  let brandId: string | null = null;
  try {
    brandId = await ensureCompetitorRecord({
      prisma,
      withDbRetry,
      brandName: BRAND_NAME,
    });
  } catch (error) {
    console.warn('[警告] Arcwave 竞品品牌记录处理失败，将跳过 competitor_id 关联:', error);
  }

  for (const item of prepared.items as Array<Record<string, unknown>>) {
    const fallbackName = normalizeWhitespace(String(item.name || ''));
    const canonicalName = normalizeWhitespace(extractCanonicalName(String(item.rawDescription || ''), fallbackName));
    if (isPlaceholderProductName(canonicalName)) continue;

    const persistedRawDescription = await translateForPersistence(String(item.rawDescription || ''), canonicalName);
    const signalText = `${canonicalName}\n${item.subtitle || ''}\n${persistedRawDescription}`;

    const priceUsd = parsePositiveNumber(item.priceSourceAmount);
    const priceRmb = resolveRmbPrice(priceUsd);
    const gender = 'male';
    const material = inferMaterial(signalText);
    const appearance = inferAppearance(signalText);
    const physicalForm = inferPhysicalForm(signalText);
    const motorType = inferMotorType(signalText);
    const waterproof = inferWaterproof(signalText);
    const functionTags = inferFunctionTags(signalText);
    const typeCode = classifyLibraryTypeCode({
      gender,
      physicalForm,
      name: canonicalName,
      rawDescription: persistedRawDescription,
      tags: functionTags,
    });
    const subtypeCode = classifyLibrarySubtypeCode({
      gender,
      physicalForm,
      name: canonicalName,
      rawDescription: persistedRawDescription,
      tags: functionTags,
      typeCode,
    });

    const specs = {
      price_source_currency: 'USD',
      price_source_amount: priceUsd,
      price_rmb: priceRmb,
      original_price_source_amount: parsePositiveNumber(item.originalPriceSourceAmount),
      original_price_rmb: resolveRmbPrice(parsePositiveNumber(item.originalPriceSourceAmount)),
      fx_rate_to_cny: usdToCnyRate,
      fx_rate_source: usdToCnyRateSource,
      fx_rate_date: usdToCnyRateDate || null,
      gender,
      material,
      appearance,
      physical_form: physicalForm,
      motor_type: motorType,
      waterproof,
      max_db: /quiet|silent/i.test(signalText) ? 50 : null,
      function_tags: functionTags,
      type_code: typeCode,
      subtype_code: subtypeCode,
    };

    const cleanedRecord = {
      sourceUrl: String(item.sourceUrl || ''),
      name: canonicalName,
      safeDisplayName: buildSafeDisplayName(canonicalName),
      brand: BRAND_NAME,
      price: priceRmb,
      coverImage: String(item.coverImage || ''),
      rawDescription: persistedRawDescription,
      gender,
      material,
      specs,
      typeCode,
      subtypeCode,
    };
    cleanedData.push(cleanedRecord);

    try {
      await withDbRetry(`同步 Arcwave 商品 ${canonicalName}`, async () => {
        const existingProduct = await prisma.products.findFirst({ where: { name: canonicalName } });
        const productPayload = {
          name: canonicalName,
          price: priceRmb,
          image: String(item.coverImage || '') || null,
          link: String(item.sourceUrl || '') || null,
          specs: {
            ...specs,
            rawDescription: persistedRawDescription || null,
          } as any,
          gender: 'Male',
          tags: functionTags,
          competitor_id: brandId || undefined,
        };

        let originalId: string;
        if (existingProduct) {
          const updated = await prisma.products.update({
            where: { id: existingProduct.id },
            data: productPayload,
          });
          originalId = updated.id;
        } else {
          const created = await prisma.products.create({ data: productPayload });
          originalId = created.id;
        }

        await prisma.recommender_toys.deleteMany({ where: { name: canonicalName } });
        await prisma.recommender_toys.create({
          data: {
            original_id: originalId,
            name: canonicalName,
            safe_display_name: buildSafeDisplayName(canonicalName),
            brand: BRAND_NAME,
            price: priceRmb,
            max_db: specs.max_db,
            waterproof: specs.waterproof,
            appearance: specs.appearance,
            physical_form: specs.physical_form,
            motor_type: specs.motor_type,
            gender,
            material,
            image_url: String(item.coverImage || '') || null,
            raw_description: persistedRawDescription || null,
            type_code: typeCode,
            subtype_code: subtypeCode,
            updated_at: new Date(),
          },
        });
      });
    } catch (error) {
      console.error(`[故障] 数据处理失败: ${canonicalName}`, error);
    }
  }

  const dir = path.dirname(CLEANED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CLEANED_PATH, JSON.stringify(cleanedData, null, 2));
  await prisma.$disconnect().catch(() => {});
  return cleanedData;
}
