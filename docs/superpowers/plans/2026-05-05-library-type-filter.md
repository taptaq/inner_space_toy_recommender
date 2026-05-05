# Library Type Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a normalized `类型` field and a linked `性别 + 类型` filter flow to `全息装备库`, including historical backfill support and frontend filtering.

**Architecture:** Centralize the category vocabulary in a small shared metadata module, then build a deterministic classifier that backfill scripts and future ingestion can reuse. After the data shape is in place, extend the API and app state to carry `typeCode`, and keep the actual reset logic for invalid gender/type combinations in a tiny pure helper so the UI behavior stays testable.

**Tech Stack:** TypeScript, React 19, Express, PostgreSQL, Prisma schema mirror, `node:test`, `tsx`

---

### File Map

**Create:**
- `src/lib/library-product-types.ts` — normalized type codes, labels, gender availability, and selection sanitizing helpers
- `src/lib/library-product-types.test.ts` — focused tests for label mapping and gender-linked option rules
- `src/lib/library-product-type-classifier.ts` — deterministic historical classification logic for `type_code`
- `src/lib/library-product-type-classifier.test.ts` — focused tests for suction, male, unisex, and unknown classification cases
- `src/db/backfill-item-type-code.ts` — one-shot database backfill for `type_code`, compatible with `recommender_items` and `recommender_toys`

**Modify:**
- `package.json` — add a runnable `db:backfill:item-type-code` script
- `prisma/schema.prisma` — mirror the new nullable `type_code` column on `recommender_items`
- `src/data/mock.ts` — extend `Product` with `typeCode?: string | null`
- `src/lib/app-shell.ts` — preserve `typeCode` during normalized payload caching
- `src/lib/app-shell.test.ts` — cover `typeCode` normalization
- `src/server/index.ts` — ensure the column exists, select `type_code`, and return `typeCode`
- `src/db/syncMock.ts` — copy `type_code` into generated local mock products
- `src/App.tsx` — persist `filterType`, sanitize it when gender changes, and pass the new filter props to `LibraryPage`
- `src/pages/LibraryPage.tsx` — render the new `类型` filter and apply linked filtering
- `src/pages/LibraryPage.test.tsx` — cover type-filter rendering and result filtering

### Task 1: Add Failing Tests For Type Metadata And Gender Linkage

**Files:**
- Create: `src/lib/library-product-types.test.ts`
- Test: `src/lib/library-product-types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  getAllowedLibraryTypeCodes,
  getLibraryTypeLabel,
  sanitizeLibraryTypeSelection,
} from "./library-product-types.ts";

test("getLibraryTypeLabel returns user-facing labels", () => {
  assert.equal(getLibraryTypeLabel("suction"), "吮吸类");
  assert.equal(getLibraryTypeLabel("masturbator"), "飞机杯");
  assert.equal(getLibraryTypeLabel("wearable_remote"), "远控穿戴");
});

test("getAllowedLibraryTypeCodes hides female-only categories from male selection", () => {
  assert.deepEqual(getAllowedLibraryTypeCodes("male"), [
    "masturbator",
    "prostate",
    "cock_ring",
  ]);
  assert.equal(getAllowedLibraryTypeCodes("male").includes("suction"), false);
});

test("sanitizeLibraryTypeSelection resets invalid type choices to all", () => {
  assert.equal(
    sanitizeLibraryTypeSelection("suction", "male"),
    "all",
  );
  assert.equal(
    sanitizeLibraryTypeSelection("masturbator", "male"),
    "masturbator",
  );
  assert.equal(
    sanitizeLibraryTypeSelection("unknown", "all"),
    "all",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/library-product-types.test.ts`
Expected: FAIL because `src/lib/library-product-types.ts` does not exist yet

- [ ] **Step 3: Commit**

```bash
git add src/lib/library-product-types.test.ts
git commit -m "test: cover library type metadata rules"
```

### Task 2: Implement Shared Type Metadata Helper

**Files:**
- Create: `src/lib/library-product-types.ts`
- Test: `src/lib/library-product-types.test.ts`

- [ ] **Step 1: Write minimal implementation**

```ts
export type LibraryAudienceGender = "all" | "female" | "male" | "unisex";

export type LibraryTypeCode =
  | "suction"
  | "external_vibe"
  | "insertable"
  | "dual_stimulation"
  | "masturbator"
  | "prostate"
  | "cock_ring"
  | "couples"
  | "wearable_remote"
  | "unknown";

export type LibraryTypeSelection = LibraryTypeCode | "all";

const TYPE_LABELS: Record<LibraryTypeCode, string> = {
  suction: "吮吸类",
  external_vibe: "外部震动",
  insertable: "入体探索",
  dual_stimulation: "双刺激",
  masturbator: "飞机杯",
  prostate: "前列腺探索",
  cock_ring: "环类/穿戴",
  couples: "双人互动",
  wearable_remote: "远控穿戴",
  unknown: "未分类",
};

const GENDER_TO_TYPES: Record<LibraryAudienceGender, LibraryTypeCode[]> = {
  all: [
    "suction",
    "external_vibe",
    "insertable",
    "dual_stimulation",
    "masturbator",
    "prostate",
    "cock_ring",
    "couples",
    "wearable_remote",
  ],
  female: ["suction", "external_vibe", "insertable", "dual_stimulation"],
  male: ["masturbator", "prostate", "cock_ring"],
  unisex: ["couples", "wearable_remote"],
};

export function getLibraryTypeLabel(typeCode: LibraryTypeCode) {
  return TYPE_LABELS[typeCode];
}

export function getAllowedLibraryTypeCodes(
  gender: LibraryAudienceGender,
) {
  return [...GENDER_TO_TYPES[gender]];
}

export function sanitizeLibraryTypeSelection(
  type: string,
  gender: LibraryAudienceGender,
): LibraryTypeSelection {
  if (type === "all") return "all";
  const allowed = getAllowedLibraryTypeCodes(gender);
  return allowed.includes(type as LibraryTypeCode)
    ? (type as LibraryTypeCode)
    : "all";
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --import tsx --test src/lib/library-product-types.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/library-product-types.ts src/lib/library-product-types.test.ts
git commit -m "feat: add library type metadata helpers"
```

### Task 3: Add Failing Tests For Historical Type Classification

**Files:**
- Create: `src/lib/library-product-type-classifier.test.ts`
- Test: `src/lib/library-product-type-classifier.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { classifyLibraryTypeCode } from "./library-product-type-classifier.ts";

test("classifyLibraryTypeCode recognizes suction products from external female signals", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Womanizer Liberty",
      rawDescription: "气脉冲吸感，外部刺激设备",
      tags: [],
    }),
    "suction",
  );
});

test("classifyLibraryTypeCode recognizes prostate products from male text signals", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "male",
      physicalForm: "internal",
      name: "前列腺按摩器",
      rawDescription: "P-spot 定向刺激",
      tags: [],
    }),
    "prostate",
  );
});

test("classifyLibraryTypeCode recognizes unisex remote wearable products", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "unisex",
      physicalForm: "external",
      name: "情侣远控穿戴器",
      rawDescription: "双人共玩，app 远程控制，可穿戴",
      tags: ["情侣", "远控"],
    }),
    "wearable_remote",
  );
});

test("classifyLibraryTypeCode falls back to unknown when signals are too weak", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "unisex",
      physicalForm: null,
      name: "探索系列",
      rawDescription: null,
      tags: [],
    }),
    "unknown",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/library-product-type-classifier.test.ts`
Expected: FAIL because `src/lib/library-product-type-classifier.ts` does not exist yet

- [ ] **Step 3: Commit**

```bash
git add src/lib/library-product-type-classifier.test.ts
git commit -m "test: cover library type classification rules"
```

### Task 4: Implement Type Classifier And Backfill Script

**Files:**
- Create: `src/lib/library-product-type-classifier.ts`
- Create: `src/db/backfill-item-type-code.ts`
- Modify: `package.json`
- Modify: `prisma/schema.prisma`
- Test: `src/lib/library-product-type-classifier.test.ts`

- [ ] **Step 1: Implement deterministic classifier**

```ts
import type { LibraryTypeCode } from "./library-product-types.ts";

type ClassificationInput = {
  gender: string | null | undefined;
  physicalForm: string | null | undefined;
  name: string | null | undefined;
  rawDescription: string | null | undefined;
  tags: string[] | null | undefined;
};

const SUCTION_PATTERN = /(吮吸|吸吮|吸感|air\s*pulse|气脉冲)/i;
const MASTURBATOR_PATTERN = /(飞机杯|masturbator|\bcup\b)/i;
const PROSTATE_PATTERN = /(前列腺|prostate|p-spot|肛)/i;
const COCK_RING_PATTERN = /(cock\s*ring|环|震动环)/i;
const WEARABLE_REMOTE_PATTERN = /(远控|app|穿戴|wearable)/i;
const COUPLES_PATTERN = /(情侣|双人|共玩|partner|shared)/i;

function joinSignals(input: ClassificationInput) {
  return [
    input.name ?? "",
    input.rawDescription ?? "",
    ...(input.tags ?? []),
  ].join("\n");
}

export function classifyLibraryTypeCode(
  input: ClassificationInput,
): LibraryTypeCode {
  const gender = input.gender ?? "";
  const physicalForm = input.physicalForm ?? "";
  const signals = joinSignals(input);

  if (gender === "female") {
    if (physicalForm === "external" && SUCTION_PATTERN.test(signals)) {
      return "suction";
    }
    if (physicalForm === "external") return "external_vibe";
    if (physicalForm === "internal") return "insertable";
    if (physicalForm === "composite") return "dual_stimulation";
  }

  if (gender === "male") {
    if (PROSTATE_PATTERN.test(signals)) return "prostate";
    if (COCK_RING_PATTERN.test(signals)) return "cock_ring";
    if (MASTURBATOR_PATTERN.test(signals)) return "masturbator";
  }

  if (gender === "unisex") {
    if (WEARABLE_REMOTE_PATTERN.test(signals)) return "wearable_remote";
    if (COUPLES_PATTERN.test(signals)) return "couples";
  }

  return "unknown";
}
```

- [ ] **Step 2: Add the backfill script and schema mirror**

```ts
// src/db/backfill-item-type-code.ts
import pg from "pg";
import dotenv from "dotenv";
import { classifyLibraryTypeCode } from "../lib/library-product-type-classifier.ts";

dotenv.config();

const { Pool } = pg;
const TABLES = ["recommender_items", "recommender_toys"] as const;

async function runBackfill() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    for (const tableName of TABLES) {
      const exists = await client.query<{ exists: boolean }>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = $1
          ) AS exists
        `,
        [tableName],
      );
      if (!exists.rows[0]?.exists) continue;

      await client.query(`
        ALTER TABLE public.${tableName}
        ADD COLUMN IF NOT EXISTS type_code TEXT
      `);

      const result = await client.query(`
        SELECT
          t.id,
          t.name,
          t.raw_description,
          t.gender,
          t.physical_form,
          t.original_id,
          p.tags,
          COALESCE(p.specs::jsonb ->> 'rawDescription', NULL) AS product_raw_description
        FROM public.${tableName}
        AS t
        LEFT JOIN public.products AS p
          ON t.original_id = p.id
      `);

      for (const row of result.rows) {
        const typeCode = classifyLibraryTypeCode({
          gender: row.gender,
          physicalForm: row.physical_form,
          name: row.name,
          rawDescription:
            [row.raw_description, row.product_raw_description]
              .filter(Boolean)
              .join("\n") || null,
          tags: Array.isArray(row.tags) ? row.tags : [],
        });

        await client.query(
          `
            UPDATE public.${tableName}
            SET type_code = $2,
                updated_at = NOW()
            WHERE id = $1
          `,
          [row.id, typeCode],
        );
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runBackfill().catch((error) => {
  console.error("[backfill-item-type-code] 执行失败:", error);
  process.exitCode = 1;
});
```

```json
// package.json
{
  "scripts": {
    "db:backfill:item-type-code": "tsx -r dotenv/config src/db/backfill-item-type-code.ts"
  }
}
```

```prisma
model recommender_items {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  original_id      String?   @db.Uuid
  name             String
  safe_display_name String?
  price            Decimal?  @db.Decimal(10, 2)
  max_db           Int?
  waterproof       Int?
  appearance       String?
  physical_form    String?
  motor_type       String?
  gender           String?
  type_code        String?
  brand            String?
  material         String?
  image_url        String?
  raw_description  String?   @db.Text
  created_at       DateTime? @default(now()) @db.Timestamptz(6)
  updated_at       DateTime? @default(now()) @db.Timestamptz(6)

  @@schema("public")
}
```

- [ ] **Step 3: Run verification**

Run: `node --import tsx --test src/lib/library-product-type-classifier.test.ts`
Expected: PASS

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/library-product-type-classifier.ts src/lib/library-product-type-classifier.test.ts src/db/backfill-item-type-code.ts package.json prisma/schema.prisma
git commit -m "feat: add library type classification and backfill"
```

### Task 5: Add Failing Tests For Payload And Library Filter Wiring

**Files:**
- Modify: `src/lib/app-shell.test.ts`
- Modify: `src/pages/LibraryPage.test.tsx`
- Test: `src/lib/app-shell.test.ts`
- Test: `src/pages/LibraryPage.test.tsx`

- [ ] **Step 1: Extend app-shell normalization tests**

```ts
import { normalizeProductsPayload } from "./app-shell.ts";

test("normalizeProductsPayload preserves typeCode from cached products", () => {
  const products = normalizeProductsPayload([
    {
      id: "p1",
      name: "Liberty",
      safeDisplayName: "Liberty",
      canonicalName: "Liberty",
      price: 999,
      maxDb: 42,
      waterproof: 7,
      appearance: "normal",
      physicalForm: "external",
      motorType: "gentle",
      gender: "female",
      typeCode: "suction",
      brand: "Womanizer",
      material: "硅胶",
      imagePlaceholder: "",
    },
  ]);

  assert.equal(products[0]?.typeCode, "suction");
});
```

- [ ] **Step 2: Add page-level failing tests for the new filter**

```tsx
test("library page shows only male type options when male gender is selected", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({ id: "m1", gender: "male", typeCode: "masturbator", name: "Cup One" }),
      ]}
      filterGender="male"
      filterType="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterTypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /类型/);
  assert.match(html, /飞机杯/);
  assert.match(html, /前列腺探索/);
  assert.doesNotMatch(html, /吮吸类/);
});

test("library page filters products by selected type code", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({ id: "f1", name: "Suction One", gender: "female", typeCode: "suction" }),
        makeProduct({ id: "f2", name: "Insertable One", gender: "female", typeCode: "insertable" }),
      ]}
      filterGender="female"
      filterType="suction"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterTypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /Suction One/);
  assert.doesNotMatch(html, /Insertable One/);
});

test("library page keeps uncategorized products visible only under all types", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({ id: "u1", name: "Unknown One", gender: "female", typeCode: null }),
      ]}
      filterGender="female"
      filterType="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterTypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /Unknown One/);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --import tsx --test src/lib/app-shell.test.ts src/pages/LibraryPage.test.tsx`
Expected: FAIL because `normalizeProductsPayload` does not preserve `typeCode` and `LibraryPage` does not accept `filterType` props yet

- [ ] **Step 4: Commit**

```bash
git add src/lib/app-shell.test.ts src/pages/LibraryPage.test.tsx
git commit -m "test: cover library type payload and page filtering"
```

### Task 6: Implement API, App State, And Library Page Integration

**Files:**
- Modify: `src/data/mock.ts`
- Modify: `src/lib/app-shell.ts`
- Modify: `src/server/index.ts`
- Modify: `src/db/syncMock.ts`
- Modify: `src/App.tsx`
- Modify: `src/pages/LibraryPage.tsx`
- Test: `src/lib/app-shell.test.ts`
- Test: `src/pages/LibraryPage.test.tsx`
- Test: `src/lib/library-product-types.test.ts`

- [ ] **Step 1: Extend payload and caching types**

```ts
// src/data/mock.ts
export type Product = {
  id: string;
  name: string;
  safeDisplayName?: string;
  canonicalName?: string;
  price: number;
  maxDb: number | null;
  waterproof: number | null;
  appearance: "high_disguise" | "normal";
  physicalForm: "external" | "internal" | "composite";
  motorType: "gentle" | "strong";
  gender: "male" | "female" | "unisex";
  typeCode?: string | null;
  brand: string;
  material: string;
  imagePlaceholder: string;
  link?: string;
  sourceUrl?: string;
  rawDescription?: string | null;
  tags?: string[];
  reason?: string;
  personaAnalysis?: string;
  isDomestic?: boolean;
};
```

```ts
// src/lib/app-shell.ts
export function normalizeProductsPayload(payload: unknown): Product[] {
  if (Array.isArray(payload)) {
    return payload.map((product) => {
      if (!product || typeof product !== "object") {
        return product as Product;
      }

      const typedProduct = product as Product;
      const canonicalName = typedProduct.canonicalName || typedProduct.name;
      return {
        ...typedProduct,
        canonicalName,
        typeCode:
          typeof typedProduct.typeCode === "string"
            ? typedProduct.typeCode
            : null,
        safeDisplayName:
          typedProduct.safeDisplayName || buildSafeDisplayName(canonicalName),
      };
    }) as Product[];
  }
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as ProductsCachePayload).products)
  ) {
    return normalizeProductsPayload((payload as ProductsCachePayload).products);
  }
  return [];
}
```

- [ ] **Step 2: Extend the API and sync layer**

```ts
// src/server/index.ts
async function ensureRecommenderItemsSchema(pool: any) {
  await pool.query(`
    ALTER TABLE public.recommender_items
    ADD COLUMN IF NOT EXISTS safe_display_name TEXT,
    ADD COLUMN IF NOT EXISTS type_code TEXT
  `);
}

app.get("/api/recommender/toys", async (_req, res) => {
  const result = await pool.query(`
    SELECT
      t.id, t.name, t.safe_display_name, t.price, t.max_db, t.waterproof,
      t.appearance, t.physical_form, t.motor_type, t.gender, t.type_code,
      t.brand, t.material, t.image_url, t.raw_description,
      p.link, p.tags, p.persona_\x61nalysis AS persona_analysis, c.is_domestic
    FROM public.recommender_items t
    LEFT JOIN public.products p ON t.original_id = p.id
    LEFT JOIN public.competitors c ON p.competitor_id = c.id
    ORDER BY t.created_at DESC
  `);

  const normalized = result.rows.map((t) => ({
    id: t.id,
    name: t.name,
    canonicalName: t.name,
    safeDisplayName: t.safe_display_name || buildSafeDisplayName(t.name),
    price: Number(t.price),
    maxDb: t.max_db,
    waterproof: t.waterproof,
    appearance: t.appearance,
    physicalForm: t.physical_form,
    motorType: t.motor_type,
    gender: t.gender,
    typeCode: t.type_code ?? null,
    brand: t.brand || "探索品牌",
    material: t.material || "亲肤材质",
    rawDescription: t.raw_description || null,
    imagePlaceholder: t.image_url || "bg-gradient-to-br from-indigo-900/40 to-blue-900/40",
    link: t.link,
    sourceUrl: t.link,
    tags: t.tags || [],
    personaAnalysis: t.persona_analysis,
    isDomestic: t.is_domestic,
  }));

  res.json(normalized);
});
```

```ts
// src/db/syncMock.ts
const mappedProducts = rows.map((row) => {
  return {
    id: String(row.id),
    name: row.name,
    price: Number(row.price),
    maxDb: row.max_db,
    waterproof: row.waterproof,
    appearance: row.appearance,
    physicalForm: row.physical_form,
    motorType: row.motor_type,
    gender: row.gender,
    typeCode: row.type_code ?? null,
    imagePlaceholder: row.image_url || "bg-gradient-to-br from-indigo-900/40 to-blue-900/40",
    link: row.link || null,
    sourceUrl: row.link || null,
  };
});
```

- [ ] **Step 3: Add persisted filter state and linked reset behavior**

```ts
// src/App.tsx
type PersistedAppState = {
  step?: number;
  answers?: AnswerState;
  topProducts?: RankedProduct[];
  backupProducts?: BackupProduct[];
  recommendationTips?: string[];
  shoppingGuidance?: string[];
  filterGender?: string;
  filterType?: string;
  filterBrand?: string;
  filterOrigin?: string;
  filterMaxDb?: number;
  filterMaterial?: string;
  filterPriceRange?: string;
  currentResultProvider?: AppAiProvider;
  currentResultModelName?: string;
};

const [filterGender, setFilterGender] = useState<string>(
  persistedState.filterGender ?? "all",
);
const [filterType, setFilterType] = useState<string>(
  sanitizeLibraryTypeSelection(
    persistedState.filterType ?? "all",
    (persistedState.filterGender ?? "all") as "all" | "female" | "male" | "unisex",
  ),
);

useEffect(() => {
  setFilterType((current) =>
    sanitizeLibraryTypeSelection(
      current,
      filterGender as "all" | "female" | "male" | "unisex",
    ),
  );
}, [filterGender]);

useEffect(() => {
  writeSessionJsonStorage(APP_STATE_STORAGE_KEY, {
    step,
    answers,
    topProducts,
    backupProducts,
    recommendationTips,
    shoppingGuidance,
    filterGender,
    filterType,
    filterBrand,
    filterOrigin,
    filterMaxDb,
    filterMaterial,
    filterPriceRange,
    currentResultProvider,
    currentResultModelName,
  });
}, [
  step,
  answers,
  topProducts,
  backupProducts,
  recommendationTips,
  shoppingGuidance,
  filterGender,
  filterType,
  filterBrand,
  filterOrigin,
  filterMaxDb,
  filterMaterial,
  filterPriceRange,
  currentResultProvider,
  currentResultModelName,
]);

<LibraryPage
  allProducts={allProducts}
  filterGender={filterGender}
  filterType={filterType}
  filterBrand={filterBrand}
  filterOrigin={filterOrigin}
  filterMaterial={filterMaterial}
  filterPriceRange={filterPriceRange}
  filterMaxDb={filterMaxDb}
  isLoading={isLoading}
  error={productsError}
  onReload={() => fetchProducts({ force: true })}
  onFilterGenderChange={setFilterGender}
  onFilterTypeChange={setFilterType}
  onFilterBrandChange={setFilterBrand}
  onFilterOriginChange={setFilterOrigin}
  onFilterMaterialChange={setFilterMaterial}
  onFilterPriceRangeChange={setFilterPriceRange}
  onFilterMaxDbChange={setFilterMaxDb}
  onBack={() => navigateTo(getReturnRoute())}
/>
```

- [ ] **Step 4: Render the new select and apply type filtering**

```tsx
// src/pages/LibraryPage.tsx
import {
  getAllowedLibraryTypeCodes,
  getLibraryTypeLabel,
} from "../lib/library-product-types.ts";

export function LibraryPage({
  allProducts,
  filterGender,
  filterType,
  filterBrand,
  filterOrigin,
  filterMaterial,
  filterPriceRange,
  filterMaxDb,
  onFilterGenderChange,
  onFilterTypeChange,
  onFilterBrandChange,
  onFilterOriginChange,
  onFilterMaterialChange,
  onFilterPriceRangeChange,
  onFilterMaxDbChange,
  onBack,
}: {
  allProducts: Product[];
  filterGender: string;
  filterType: string;
  filterBrand: string;
  filterOrigin: string;
  filterMaterial: string;
  filterPriceRange: string;
  filterMaxDb: number;
  isLoading: boolean;
  error: string | null;
  onReload: () => void;
  onFilterGenderChange: (value: string) => void;
  onFilterTypeChange: (value: string) => void;
  onFilterBrandChange: (value: string) => void;
  onFilterOriginChange: (value: string) => void;
  onFilterMaterialChange: (value: string) => void;
  onFilterPriceRangeChange: (value: string) => void;
  onFilterMaxDbChange: (value: number) => void;
  onBack: () => void;
}) {
  const allowedTypeCodes = getAllowedLibraryTypeCodes(
    filterGender as "all" | "female" | "male" | "unisex",
  );

  return (
    <div className="space-y-2">
      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
        类型
      </label>
      <select
        value={filterType}
        onChange={(e) => onFilterTypeChange(e.target.value)}
        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50 appearance-none"
      >
        <option value="all">全部类型</option>
        {allowedTypeCodes.map((typeCode) => (
          <option key={typeCode} value={typeCode}>
            {getLibraryTypeLabel(typeCode)}
          </option>
        ))}
      </select>
    </div>
  );
}
```

```ts
// still inside src/pages/LibraryPage.tsx, in the existing products.filter callback
const matchGender =
  filterGender === "all" || product.gender === filterGender;
const matchType =
  filterType === "all" || product.typeCode === filterType;
const matchBrand =
  filterBrand === "all" || product.brand === filterBrand;
const matchOrigin =
  filterOrigin === "all" ||
  (filterOrigin === "domestic"
    ? product.isDomestic === true
    : product.isDomestic === false);
const matchDb =
  product.maxDb == null || product.maxDb <= filterMaxDb;
const matchMaterial =
  filterMaterial === "all" || product.material.includes(filterMaterial);
const matchPrice = matchesPriceRange(product.price, filterPriceRange);

return (
  matchGender &&
  matchType &&
  matchBrand &&
  matchOrigin &&
  matchDb &&
  matchMaterial &&
  matchPrice
);
```

- [ ] **Step 5: Run verification**

Run: `node --import tsx --test src/lib/library-product-types.test.ts src/lib/library-product-type-classifier.test.ts src/lib/app-shell.test.ts src/pages/LibraryPage.test.tsx`
Expected: PASS

Run: `npm run lint`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/data/mock.ts src/lib/app-shell.ts src/lib/app-shell.test.ts src/server/index.ts src/db/syncMock.ts src/App.tsx src/pages/LibraryPage.tsx src/pages/LibraryPage.test.tsx
git commit -m "feat: add linked library type filter"
```

### Task 7: Run The Database Backfill And Final Verification

**Files:**
- Modify: working tree only through script execution
- Test: `src/lib/library-product-types.test.ts`
- Test: `src/lib/library-product-type-classifier.test.ts`
- Test: `src/lib/app-shell.test.ts`
- Test: `src/pages/LibraryPage.test.tsx`

- [ ] **Step 1: Run the historical backfill**

Run: `npm run db:backfill:item-type-code`
Expected: script completes without throwing and updates `type_code` on `recommender_items`; if `recommender_toys` exists, it should update that table too

- [ ] **Step 2: Run final automated verification**

Run: `node --import tsx --test src/lib/library-product-types.test.ts src/lib/library-product-type-classifier.test.ts src/lib/app-shell.test.ts src/pages/LibraryPage.test.tsx`
Expected: PASS

Run: `npm run lint`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add package.json prisma/schema.prisma src/lib/library-product-types.ts src/lib/library-product-types.test.ts src/lib/library-product-type-classifier.ts src/lib/library-product-type-classifier.test.ts src/db/backfill-item-type-code.ts src/data/mock.ts src/lib/app-shell.ts src/lib/app-shell.test.ts src/server/index.ts src/db/syncMock.ts src/App.tsx src/pages/LibraryPage.tsx src/pages/LibraryPage.test.tsx
git commit -m "chore: backfill library type codes"
```
