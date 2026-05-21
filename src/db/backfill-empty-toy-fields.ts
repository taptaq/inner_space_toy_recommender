import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "node:url";

import { buildSafeDisplayName } from "../lib/product-display-name.ts";
import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
  resolveLibraryAudienceGender,
} from "../lib/library-product-type-classifier.ts";
import { buildRecommendationProductFeatures } from "../lib/recommendation-product-features.ts";
import type { Product } from "../data/mock.ts";

dotenv.config();

const { Pool } = pg;

const READ_LIMIT = 2_000;
const RAW_DESCRIPTION_LIMIT = 1_200;
const DEFAULT_POWERED_MAX_DB = 50;
const DEFAULT_POWERED_WATERPROOF = 7;

type ToyFieldBackfillRow = {
  id: string;
  original_id: string | null;
  name: string;
  safe_display_name: string | null;
  price: string | null;
  max_db: number | null;
  waterproof: number | null;
  appearance: string | null;
  physical_form: string | null;
  motor_type: string | null;
  gender: string | null;
  brand: string | null;
  material: string | null;
  image_url: string | null;
  raw_description: string | null;
  type_code: string | null;
  subtype_code: string | null;
  recommendation_features: unknown;
  product_name: string | null;
  product_price: string | null;
  product_category: string | null;
  product_tags: string[] | null;
  product_link: string | null;
  product_image: string | null;
  product_gender: string | null;
  product_raw_description: string | null;
  product_material: string | null;
  product_max_db: string | null;
  product_waterproof: string | null;
  product_appearance: string | null;
  product_physical_form: string | null;
  product_motor_type: string | null;
};

type ToyFieldPatch = {
  id: string;
  original_id: string | null;
  price: number | null;
  max_db: number | null;
  waterproof: number | null;
  appearance: string | null;
  physical_form: string | null;
  motor_type: string | null;
  gender: string | null;
  material: string | null;
  image_url: string | null;
  raw_description: string | null;
  safe_display_name: string | null;
  type_code: string | null;
  subtype_code: string | null;
  recommendation_features: unknown;
};

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasText(value: unknown) {
  return normalizeText(value).length > 0;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }

  return null;
}

function parseNumber(value: unknown) {
  const normalized = normalizeText(value).replace(/[^\d.]/g, "");
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseInteger(value: unknown) {
  const numeric = parseNumber(value);
  if (numeric == null) return null;
  return Math.round(numeric);
}

function normalizeAppearance(value: string | null) {
  return value === "high_disguise" ? "high_disguise" : "normal";
}

function normalizePhysicalForm(value: string | null) {
  if (value === "internal" || value === "composite") return value;
  return "external";
}

function normalizeMotorType(value: string | null) {
  return value === "strong" ? "strong" : "gentle";
}

function normalizeGender(value: string | null) {
  if (value === "female" || value === "male" || value === "unisex") return value;
  return "unisex";
}

function buildSignalText(row: ToyFieldBackfillRow, rawDescription: string | null) {
  return [
    row.name,
    row.product_name,
    row.brand,
    row.product_category,
    rawDescription,
    row.product_raw_description,
    ...(Array.isArray(row.product_tags) ? row.product_tags : []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .toLowerCase();
}

function isNonToyCareOrApparel(typeCode: string | null, signalText: string) {
  return (
    typeCode === "care_accessory" ||
    /润滑液|润滑剂|安全套|避孕套|湿巾|护理液|内衣|蕾丝|睡衣|连体衣|香包|香氛|香膏|按摩油|lube|lubricant|condom|lingerie/i.test(signalText)
  );
}

function isPoweredToy(typeCode: string | null, signalText: string) {
  if (!typeCode || typeCode === "unknown" || typeCode === "care_accessory" || typeCode === "bdsm") {
    return false;
  }

  if (/手动|免电|manual|non[-\s]?powered/i.test(signalText)) {
    return false;
  }

  return /震动|振动|吮吸|吸吮|气脉冲|脉冲|电动|加热|充电|遥控|远控|马达|app|rechargeable|remote|motor|powered|electric|pulse|suction|vibrat/i.test(signalText);
}

function buildLocalRawDescription(row: ToyFieldBackfillRow) {
  const segments = [
    `商品名: ${normalizeText(row.product_name) || normalizeText(row.name)}`,
    row.brand ? `品牌: ${normalizeText(row.brand)}` : null,
    row.gender ? `适用对象: ${normalizeText(row.gender)}` : null,
    row.type_code ? `类型: ${normalizeText(row.type_code)}` : null,
    row.subtype_code ? `细分: ${normalizeText(row.subtype_code)}` : null,
    row.physical_form ? `形态: ${normalizeText(row.physical_form)}` : null,
    row.motor_type ? `动力: ${normalizeText(row.motor_type)}` : null,
    row.material ? `材质: ${normalizeText(row.material)}` : null,
    row.price ? `价格: ${normalizeText(row.price)}` : null,
    Array.isArray(row.product_tags) && row.product_tags.length > 0
      ? `标签: ${row.product_tags.map(normalizeText).filter(Boolean).slice(0, 8).join("、")}`
      : null,
  ].filter(Boolean);

  return `[本地字段摘要] ${segments.join("；")}。该描述由当前数据库字段生成，用于消除空值；后续可被官方详情页重爬结果覆盖。`;
}

function chooseRawDescription(row: ToyFieldBackfillRow) {
  const current = normalizeText(row.raw_description);
  if (current) return current;

  const productRaw = normalizeText(row.product_raw_description);
  if (productRaw) return productRaw.slice(0, RAW_DESCRIPTION_LIMIT);

  return buildLocalRawDescription(row);
}

function buildProductForFeatures(
  row: ToyFieldBackfillRow,
  patch: Pick<
    ToyFieldPatch,
    | "price"
    | "max_db"
    | "waterproof"
    | "appearance"
    | "physical_form"
    | "motor_type"
    | "gender"
    | "material"
    | "image_url"
    | "raw_description"
    | "type_code"
    | "subtype_code"
  >,
): Product {
  return {
    id: row.id,
    originalId: row.original_id,
    name: row.name,
    displayName: row.safe_display_name ?? undefined,
    safeDisplayName: row.safe_display_name ?? undefined,
    price: patch.price ?? parseNumber(row.price) ?? 0,
    maxDb: patch.max_db,
    waterproof: patch.waterproof,
    appearance: normalizeAppearance(patch.appearance),
    physicalForm: normalizePhysicalForm(patch.physical_form),
    motorType: normalizeMotorType(patch.motor_type),
    gender: normalizeGender(patch.gender),
    typeCode: patch.type_code,
    subtypeCode: patch.subtype_code,
    brand: row.brand ?? "",
    material: patch.material ?? "",
    imagePlaceholder: patch.image_url ?? "",
    rawDescription: patch.raw_description,
    tags: Array.isArray(row.product_tags)
      ? row.product_tags.filter((value): value is string => hasText(value))
      : [],
  };
}

function buildPatch(row: ToyFieldBackfillRow): ToyFieldPatch {
  const rawDescription = chooseRawDescription(row);
  const signalText = buildSignalText(row, rawDescription);
  const typeSignals = {
    gender: firstText(row.gender, row.product_gender),
    physicalForm: firstText(row.physical_form, row.product_physical_form),
    name: row.name,
    rawDescription,
    tags: row.product_tags ?? [],
  };
  const inferredGender = resolveLibraryAudienceGender(typeSignals);
  const inferredTypeCode = classifyLibraryTypeCode({
    ...typeSignals,
    gender: inferredGender,
  });
  const inferredSubtypeCode = classifyLibrarySubtypeCode({
    ...typeSignals,
    gender: inferredGender,
    typeCode: inferredTypeCode,
  });
  const typeCode =
    row.type_code && row.type_code !== "unknown" ? row.type_code : inferredTypeCode;
  const subtypeCode = row.subtype_code ?? inferredSubtypeCode;
  const price = parseNumber(row.price) ?? parseNumber(row.product_price);
  const maxDb =
    row.max_db ??
    parseInteger(row.product_max_db) ??
    (isPoweredToy(typeCode, signalText) ? DEFAULT_POWERED_MAX_DB : null);
  const waterproof =
    row.waterproof ??
    parseInteger(row.product_waterproof) ??
    (isPoweredToy(typeCode, signalText) ? DEFAULT_POWERED_WATERPROOF : null);
  const physicalForm = firstText(row.physical_form, row.product_physical_form);
  const motorType = firstText(row.motor_type, row.product_motor_type);
  const gender = firstText(row.gender, row.product_gender) ?? inferredGender;
  const material = firstText(row.material, row.product_material);
  const imageUrl = firstText(row.image_url, row.product_image);
  const appearance = firstText(row.appearance, row.product_appearance) ?? "normal";
  const normalizedMaxDb = isNonToyCareOrApparel(typeCode, signalText) ? null : maxDb;
  const normalizedWaterproof = isNonToyCareOrApparel(typeCode, signalText)
    ? null
    : waterproof;
  const featureProduct = buildProductForFeatures(row, {
    price,
    max_db: normalizedMaxDb,
    waterproof: normalizedWaterproof,
    appearance,
    physical_form: physicalForm,
    motor_type: motorType,
    gender,
    material,
    image_url: imageUrl,
    raw_description: rawDescription,
    type_code: typeCode,
    subtype_code: subtypeCode,
  });
  const features = buildRecommendationProductFeatures(featureProduct);

  return {
    id: row.id,
    original_id: row.original_id,
    price,
    max_db: normalizedMaxDb,
    waterproof: normalizedWaterproof,
    appearance,
    physical_form: physicalForm,
    motor_type: motorType,
    gender,
    material,
    image_url: imageUrl,
    raw_description: rawDescription,
    safe_display_name: row.safe_display_name ?? buildSafeDisplayName(row.name),
    type_code: typeCode,
    subtype_code: subtypeCode,
    recommendation_features: {
      featureVersion: "recommendation-product-features-v1",
      isSuctionLike: features.isSuctionLike,
      isInsertableLike: features.isInsertableLike,
      supportsAppOrRemote: features.supportsAppOrRemote,
      isCoupleOriented: features.isCoupleOriented,
      hasManyPatterns: features.hasManyPatterns,
      hasStrongSuctionSignal: features.hasStrongSuctionSignal,
      hasGentleSignal: features.hasGentleSignal,
      hasStrongIntensitySignal: features.hasStrongIntensitySignal,
      evidence: features.evidence,
    },
  };
}

function shouldApplyPatch(row: ToyFieldBackfillRow, patch: ToyFieldPatch) {
  return (
    !hasText(row.raw_description) ||
    row.price == null ||
    row.max_db == null && patch.max_db != null ||
    row.waterproof == null && patch.waterproof != null ||
    !hasText(row.appearance) ||
    !hasText(row.physical_form) ||
    !hasText(row.motor_type) ||
    !hasText(row.gender) ||
    !hasText(row.material) ||
    !hasText(row.image_url) && patch.image_url != null ||
    !hasText(row.safe_display_name) ||
    !hasText(row.type_code) ||
    row.type_code === "unknown" && patch.type_code !== "unknown" ||
    !hasText(row.subtype_code) && patch.subtype_code != null ||
    row.recommendation_features == null
  );
}

export function shouldRunEmptyToyFieldsBackfillScript(
  importMetaUrl: string,
  argvEntry?: string,
) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function readCandidateRows(client: pg.PoolClient) {
  const result = await client.query<ToyFieldBackfillRow>(
    `
      SELECT
        t.id,
        t.original_id,
        t.name,
        t.safe_display_name,
        t.price::text AS price,
        t.max_db,
        t.waterproof,
        t.appearance,
        t.physical_form,
        t.motor_type,
        t.gender,
        t.brand,
        t.material,
        t.image_url,
        t.raw_description,
        t.type_code,
        t.subtype_code,
        t.recommendation_features,
        p.name AS product_name,
        p.price::text AS product_price,
        p.category AS product_category,
        p.tags AS product_tags,
        p.link AS product_link,
        p.image AS product_image,
        p.gender AS product_gender,
        NULLIF(BTRIM(COALESCE(p.specs::jsonb ->> 'rawDescription', '')), '') AS product_raw_description,
        NULLIF(BTRIM(COALESCE(p.specs::jsonb ->> 'material', '')), '') AS product_material,
        NULLIF(BTRIM(COALESCE(p.specs::jsonb ->> 'max_db', '')), '') AS product_max_db,
        NULLIF(BTRIM(COALESCE(p.specs::jsonb ->> 'waterproof', '')), '') AS product_waterproof,
        NULLIF(BTRIM(COALESCE(p.specs::jsonb ->> 'appearance', '')), '') AS product_appearance,
        NULLIF(BTRIM(COALESCE(p.specs::jsonb ->> 'physical_form', '')), '') AS product_physical_form,
        NULLIF(BTRIM(COALESCE(p.specs::jsonb ->> 'motor_type', '')), '') AS product_motor_type
      FROM public.recommender_toys AS t
      LEFT JOIN public.products AS p ON p.id = t.original_id
      WHERE
        NULLIF(BTRIM(COALESCE(t.raw_description, '')), '') IS NULL OR
        t.price IS NULL OR
        NULLIF(BTRIM(COALESCE(t.material, '')), '') IS NULL OR
        NULLIF(BTRIM(COALESCE(t.type_code, '')), '') IS NULL OR
        t.type_code = 'unknown' OR
        NULLIF(BTRIM(COALESCE(t.gender, '')), '') IS NULL OR
        t.recommendation_features IS NULL OR
        NULLIF(BTRIM(COALESCE(t.safe_display_name, '')), '') IS NULL
      ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC NULLS LAST
      LIMIT $1
    `,
    [READ_LIMIT],
  );

  return result.rows;
}

async function applyPatch(client: pg.PoolClient, patch: ToyFieldPatch) {
  await client.query(
    `
      UPDATE public.recommender_toys
      SET
        price = COALESCE(price, $2),
        max_db = COALESCE(max_db, $3),
        waterproof = COALESCE(waterproof, $4),
        appearance = COALESCE(NULLIF(BTRIM(COALESCE(appearance, '')), ''), $5),
        physical_form = COALESCE(NULLIF(BTRIM(COALESCE(physical_form, '')), ''), $6),
        motor_type = COALESCE(NULLIF(BTRIM(COALESCE(motor_type, '')), ''), $7),
        gender = COALESCE(NULLIF(BTRIM(COALESCE(gender, '')), ''), $8),
        material = COALESCE(NULLIF(BTRIM(COALESCE(material, '')), ''), $9),
        image_url = COALESCE(NULLIF(BTRIM(COALESCE(image_url, '')), ''), $10),
        raw_description = COALESCE(NULLIF(BTRIM(COALESCE(raw_description, '')), ''), $11),
        safe_display_name = COALESCE(NULLIF(BTRIM(COALESCE(safe_display_name, '')), ''), $12),
        type_code = CASE
          WHEN NULLIF(BTRIM(COALESCE(type_code, '')), '') IS NULL OR type_code = 'unknown'
            THEN $13
          ELSE type_code
        END,
        subtype_code = COALESCE(NULLIF(BTRIM(COALESCE(subtype_code, '')), ''), $14),
        recommendation_features = COALESCE(recommendation_features, $15::jsonb),
        updated_at = NOW()
      WHERE id = $1::uuid
    `,
    [
      patch.id,
      patch.price,
      patch.max_db,
      patch.waterproof,
      patch.appearance,
      patch.physical_form,
      patch.motor_type,
      patch.gender,
      patch.material,
      patch.image_url,
      patch.raw_description,
      patch.safe_display_name,
      patch.type_code,
      patch.subtype_code,
      JSON.stringify(patch.recommendation_features),
    ],
  );

  if (!patch.original_id || !patch.raw_description) return;

  await client.query(
    `
      UPDATE public.products
      SET specs = jsonb_set(
            COALESCE(specs::jsonb, '{}'::jsonb),
            '{rawDescription}',
            to_jsonb(COALESCE(NULLIF(BTRIM(COALESCE(specs::jsonb ->> 'rawDescription', '')), ''), $2::text)),
            true
          )
      WHERE id = $1::uuid
    `,
    [patch.original_id, patch.raw_description],
  );
}

async function backfillEmptyToyFields() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    const rows = await readCandidateRows(client);
    const patches = rows
      .map((row) => ({ row, patch: buildPatch(row) }))
      .filter(({ row, patch }) => shouldApplyPatch(row, patch));

    let updated = 0;
    let rawDescriptionUpdated = 0;
    let productRawDescriptionAvailable = 0;

    for (const { row, patch } of patches) {
      if (!hasText(row.raw_description) && hasText(patch.raw_description)) {
        rawDescriptionUpdated += 1;
      }
      if (!hasText(row.raw_description) && hasText(row.product_raw_description)) {
        productRawDescriptionAvailable += 1;
      }
      await applyPatch(client, patch);
      updated += 1;
    }

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          scanned: rows.length,
          updated,
          raw_description_updated: rawDescriptionUpdated,
          raw_description_from_products: productRawDescriptionAvailable,
          raw_description_from_local_summary:
            rawDescriptionUpdated - productRawDescriptionAvailable,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunEmptyToyFieldsBackfillScript(import.meta.url, process.argv[1])) {
  backfillEmptyToyFields().catch((error) => {
    console.error("[backfill-empty-toy-fields] 执行失败:", error);
    process.exitCode = 1;
  });
}
