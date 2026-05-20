# LELO Full Refetch Design

**Goal:** Re-scrape all LELO products represented in `public.recommender_toys`, then repopulate `raw_description`, `material`, `type_code`, and `subtype_code` with the project's current official-site normalization pipeline.

## Context

The current LELO scraper chain under `src/scraper/lelo/` is still a legacy pipeline. It writes a generic review buffer, relies on an old LLM-only cleaner shape, and does not consistently persist the modern normalized fields that newer official-site scrapers write into `products` and `recommender_toys`.

On May 19, 2026, the live database state showed:

- `brand = LELO` rows in `public.recommender_toys`: `62`
- LELO rows with empty `raw_description`: `62`

That means the issue is no longer limited to the 49 rows listed in [docs/2026-05-19-raw-description-needs-refetch.md](/Users/taptaq/Documents/Original%20Heart%20Road/project/inner_space_toy_recommender/docs/2026-05-19-raw-description-needs-refetch.md:1). We need a full LELO rerun.

## Approach

Reuse the project's modern official-site scraper pattern instead of patching the legacy LELO cleaner in place.

- Keep the existing `src/scraper/lelo/` directory so package script and repo references stay stable.
- Upgrade the crawler to emit a LELO-specific review buffer with enough structured fields for modern normalization.
- Replace the old cleaner with a deterministic normalization pipeline modeled after current official-site scrapers such as `jejoue-official` and `magicmotion-official`.
- Reuse shared helpers for canonical name extraction, raw-description persistence, competitor linking, and library type/subtype classification.

## Data Flow

1. `src/scraper/lelo/crawler.ts` crawls LELO collection pages and product pages.
2. The crawler writes `src/data/lelo-review-buffer.json`.
3. `src/scraper/lelo/cleaner.ts` reads that buffer, dedupes canonical names, normalizes/translates `rawDescription`, infers `material`, computes `type_code/subtype_code`, and writes `src/data/lelo-cleaned-data.json`.
4. The cleaner upserts linked `products` rows and rewrites corresponding `recommender_toys` rows with modern normalized fields.

## Field Rules

### `raw_description`

- Prefer product-detail text blocks from the LELO product page instead of page-wide body text.
- Preserve structured sections when possible.
- If the description is mostly English, translate for persistence using the shared raw-description translator and fall back to the original text on translation failure.

### `material`

- Infer deterministically from product name + persisted `raw_description`.
- Favor LELO-appropriate defaults such as `硅胶` when device text clearly describes a toy but no explicit material is found.
- Avoid introducing accessory-specific material labels unless the text actually supports them.

### `type_code` and `subtype_code`

- Use the shared library classifier in `src/lib/library-product-type-classifier.ts`.
- Feed it the normalized name, persisted `raw_description`, gender hint, and crawler category hints.
- Keep classifier output as the source of truth unless a narrow LELO-specific post-adjustment is required for obvious false negatives.

## Scope

Included:

- LELO crawler modernization
- LELO cleaner modernization
- LELO cleaner tests
- Full LELO rerun and DB verification

Excluded:

- Reworking other brands
- Changing shared classifier behavior unless LELO work exposes a clear bug
- Bulk backfill of non-LELO `raw_description` gaps

## Risks

- LELO page structure may have drifted since the legacy scraper was written.
- A full rerun needs network access and live database writes.
- Some LELO products may still classify as `unknown` if the site copy is too sparse; those should be the minority after the rerun.

## Success Criteria

- `brand = LELO` rows are recrawled from the official site.
- Most or all LELO `recommender_toys.raw_description` values become non-empty after the rerun.
- LELO `material`, `type_code`, and `subtype_code` are rewritten through the modern normalization pipeline.
- Targeted tests for the new LELO cleaner pass before the live rerun.
