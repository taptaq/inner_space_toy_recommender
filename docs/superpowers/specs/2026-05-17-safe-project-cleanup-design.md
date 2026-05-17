# Safe Project Cleanup Design

## Goal

Reduce obvious clutter and document the safest next cleanup targets without disrupting current scraper, database, or frontend behavior.

## Phase 1 Boundaries

This cleanup phase is intentionally conservative.

It includes:

- deleting disposable runtime artifacts under `src/data`
- deleting dead debug-only files not referenced by runtime code
- documenting high-duplication areas for later extraction

It does not include:

- deleting `src/data/mock.ts` or `src/data/mock.test.ts`
- renaming scraper directories
- changing scraper runtime behavior
- changing DB schema or frontend architecture

## What Was Safe To Remove

### Removed

- generated `review-buffer.json` files
- generated `cleaned-data.json` files
- generated `raw-description-zh-cache.json` files
- generated `list-price-cache.json` files
- stale HTML debug snapshots under `src/data`
- stale `.bak` files under `src/data`
- `src/debug_detail_dom.html`

### Explicitly Kept

- `src/data/knowledge-nebula.ts`
- `src/data/mock.ts`
- `src/data/mock.test.ts`
- `src/data/lovehoney-official-storage-state.json`

Reason:

- `mock.ts` and `mock.test.ts` are still referenced by app code and tests
- `knowledge-nebula.ts` is source code, not generated output
- `lovehoney-official-storage-state.json` is session state that may still be intentionally reused

## Duplication Inventory

The scraper layer currently contains very high repetition:

- `crawler.ts`: 29 files
- `cleaner.ts`: 29 files

Repeated crawler helpers appear across many official-site scrapers:

- `decodeHtml`
- `normalizeWhitespace`
- `uniqueStrings`
- `parsePrice`
- `normalizeProductUrl`

These are strong candidates for later extraction into a shared official-site helper module.

## Safe Next-Step Refactor Candidates

### Candidate A: Shared official-site crawler utils

Create one shared helper module for stable, low-level text and URL helpers used by official-site crawlers.

Good extraction targets:

- HTML entity decoding
- whitespace normalization
- string dedupe
- product URL normalization
- source price parsing

Initial low-risk migration candidates:

- `src/scraper/hotoctopuss-official/crawler.ts`
- `src/scraper/hellonancy-official/crawler.ts`
- `src/scraper/lbdo-official/crawler.ts`

Reason:

- these three were created recently
- they follow the same Shopify-official pattern
- they already have direct test coverage
- they are safer than backporting shared helpers into older legacy scrapers first

Why safe:

- these are mostly pure helpers
- repeated implementation count is high
- test coverage already exists in many scraper-specific suites

### Candidate B: Shared official-site cleaner currency/material helpers

Create one shared helper module for:

- source-currency normalization
- RMB conversion
- FX fallback rules

Why safe:

- newer official-site cleaners already converge on this pattern
- repeated code is large enough to justify extraction

### Candidate C: Shared logging conventions for official-site scrapers

Standardize:

- collection start
- list candidate counts
- detail progress
- review-buffer write
- cleaner processing progress

Why safe:

- behavior-neutral
- improves debugging and maintenance

## Deferred to Higher-Risk Phase

These should not be touched in safe cleanup:

- broad taxonomy redesign
- merging Tmall and official-site frameworks
- moving `mock.ts` data model
- deleting old scraper families without full reference audit
- changing runtime file paths used by existing scrapers

## Current Recommendation

The next safe refactor step should be:

1. extract shared official-site crawler text/URL helpers
2. extract shared official-site currency helpers
3. keep brand-specific business rules inside each scraper until helper extraction is proven stable

Current status:

- `src/scraper/shared/shopify-official-helpers.ts` has been created as the shared helper seed
- full migration of live crawlers was intentionally deferred in this phase to avoid destabilizing working scraper chains mid-stream
- next execution pass should migrate one tested Shopify official-site scraper at a time and verify after each move
