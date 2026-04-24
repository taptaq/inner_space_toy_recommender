# Womanizer Official Scraper Design

## Goal

Add a full `womanizer-official` scraper pipeline for the Womanizer US independent site, starting from:

- `https://www.womanizer.com/us/sex-toys`

The pipeline should:

- crawl the Womanizer US product listing
- collect list and detail data into a review buffer
- clean and normalize the data into the repo's standard product shape
- convert USD prices into CNY during cleaning
- preserve original USD price data for traceability
- write cleaned records into the existing database tables

## Confirmed Site Behavior

Browser inspection on April 24, 2026 confirmed:

- the list page at `/us/sex-toys` renders a standard product grid
- product cards expose product name, product link, image, descriptive text, and price text
- detail pages expose richer marketing copy, image gallery content, and product metadata
- detail pages also expose structure that can be parsed from visible DOM and supplemented from metadata or embedded structured data

This means the scraper should follow the existing official-site pattern used elsewhere in the repo:

- DOM-first extraction for the visible page
- structured-data and metadata fallbacks for resilience

## Chosen Approach

Recommended implementation: `DOM-first extraction with structured-data fallback`

Why this approach:

- it matches the current independent-site scraper pattern already used in this repo
- it is fast enough for end-to-end crawling without requiring fragile network reverse engineering
- it is more resilient than pure DOM scraping because JSON-LD, meta tags, or embedded product config can backfill missing fields

Alternatives considered but not chosen:

- pure DOM scraping: fastest to build, but too brittle when the storefront layout changes
- network-first reverse engineering: potentially cleaner, but higher effort and not justified unless the site blocks stable DOM extraction

## Scope

The feature will be fully integrated and include:

- `src/scraper/womanizer-official/crawler.ts`
- `src/scraper/womanizer-official/cleaner.ts`
- `package.json` script entry for running the scraper
- review buffer output under `src/data/`
- cleaned output under `src/data/`
- parser-focused tests for the new scraper where practical

Brand naming:

- internal brand slug: `womanizer-official`
- display brand: `Womanizer`

## Architecture

### 1. Crawler

The crawler owns browser automation, raw extraction, deduplication, and review-buffer creation.

Responsibilities:

- open `https://www.womanizer.com/us/sex-toys`
- discover additional listing content by pagination, load-more behavior, or controlled scrolling as needed
- parse product cards from the listing
- deduplicate list items by canonical detail URL
- visit each unique detail page and extract richer structured content
- merge list and detail fields into raw buffer entries
- write `src/data/womanizer-official-review-buffer.json`
- invoke the cleaner at the end

Expected list-level fields:

- `sourceUrl`
- `name`
- `subtitle` or short descriptive copy when available
- `coverImage`
- `priceUsd`
- `originalPriceUsd` when available
- `genderHint`
- `categoryHints`
- `listPosition`

Expected detail-level enrichment:

- title and subtitle-like marketing text
- meta title and meta description
- current price text and original price text
- feature headlines or hero bullets
- specification key/value pairs
- body description and summary blocks
- gallery image URLs
- SKU or product-code-like identifiers if discoverable
- raw text segments useful for translation and downstream classification

### 2. Cleaner

The cleaner owns normalization, translation, currency conversion, duplicate protection, and database writes.

Responsibilities:

- read the review buffer
- normalize strings, URLs, images, and product metadata
- translate `rawDescription` into Chinese using the shared translation flow already used by other official-site cleaners
- convert USD prices into CNY
- map data into the repo's standard `products` and `recommender_toys` shapes
- skip invalid or duplicate records
- emit `src/data/womanizer-official-cleaned-data.json`
- write valid non-duplicate records into the database

## Data Flow

1. Start from `/us/sex-toys`
2. Collect visible product cards from the current listing state
3. If the storefront exposes more items through pagination or dynamic loading, continue until no new products appear or configured limits are reached
4. Normalize and deduplicate product URLs
5. Visit each unique detail page
6. Merge list data with detail data into review-buffer entries
7. Run cleaner
8. Translate `rawDescription` into Chinese
9. Convert USD prices to CNY
10. Skip duplicate or invalid records during persistence
11. Write cleaned JSON and insert remaining records

## Listing Strategy

Primary strategy:

- parse the `/us/sex-toys` listing DOM directly
- detect whether the site exposes explicit pagination, load-more controls, or appended cards
- continue crawling with the least fragile available mechanism

Planned behavior:

- prefer deterministic URL or button-driven expansion when available
- fall back to controlled browser scrolling only when necessary to reveal additional items
- stop when no new canonical product URLs are discovered

This keeps the scraper consistent with existing official-site modules while avoiding assumptions about a single loading pattern.

## Parsing Strategy

List pages:

- use visible card DOM for product name, link, image, short copy, and displayed prices
- normalize relative URLs against `https://www.womanizer.com`
- keep raw price text available when helpful for debugging or fallback parsing

Detail pages:

- use visible DOM as the primary source for title, marketing copy, specs, price, and gallery
- supplement missing fields from:
  - `application/ld+json`
  - meta tags
  - embedded product configuration objects when present

Fallback order:

1. visible product DOM
2. structured data and metadata
3. list-page fallback values already captured

## Duplicate Handling

Crawler-side duplicate handling:

- deduplicate by canonicalized detail URL before visiting product pages
- preserve the earliest list position when duplicate cards appear

Cleaner/database duplicate handling:

- skip records with empty or placeholder names
- skip insertion when an existing product with the same normalized name already exists
- keep cleaned JSON output for inspection even if DB insertion is skipped

This matches the duplicate-avoidance behavior already used for existing official-site scrapers.

## Price Conversion

Source prices are expected to be in USD on the US Womanizer storefront.

Planned behavior:

- crawler stores raw USD-derived values as `priceUsd` and `originalPriceUsd` when available
- cleaner refreshes a live USD/CNY exchange rate when possible
- cleaner falls back to a fixed USD/CNY rate if the live request fails
- final `price` persisted to the main product shape is the RMB value
- cleaned specs preserve:
  - `price_usd`
  - `price_rmb`
  - `fx_rate_to_cny`
  - `fx_rate_source`
  - `fx_rate_date`

This keeps the user-facing price behavior consistent with the current frontend and recommendation logic, which already expects RMB in the main `price` field.

## Classification and Normalization

The cleaner should infer and normalize the same core fields used by other official-site modules, including:

- `gender`
- `function_tags`
- `material`
- `appearance`
- `physical_form`
- `motor_type`
- `waterproof`
- `max_db`

Inference should follow the same practical pattern already used by `nomitang-official`, `satisfyer-official`, `wevibe-official`, and `lovehoney-official`:

- use explicit product text first
- fall back to brand-specific heuristics from name, subtitle, features, and raw description
- tolerate partial data rather than failing the record

## Error Handling

Crawler safeguards:

- continue when a single detail page fails
- log failed URLs with enough context to debug later
- skip malformed URLs or cards without meaningful names
- tolerate missing images, missing subtitle text, or missing price on individual products

Cleaner safeguards:

- retry transient database failures
- continue processing if an individual translation call fails, using the best available text
- allow partial specs when some fields cannot be confidently inferred
- preserve raw context in the review buffer for later debugging

## Testing and Verification

Before claiming completion:

- add parser-oriented tests where they provide stable value
- run the new scraper with a small item cap and confirm that:
  - `womanizer-official-review-buffer.json` is produced
  - `womanizer-official-cleaned-data.json` is produced
  - extracted products include real Womanizer URLs and prices
- run `npx tsc --noEmit`

Preferred test focus:

- price parsing from list or detail text
- URL normalization and deduplication
- detail fallback parsing when one source is missing

## Out of Scope

This change does not include:

- frontend presentation changes
- support for Womanizer storefronts outside the US region
- retroactive cleanup of existing non-Womanizer data
- reverse-engineering a private API unless the DOM-plus-fallback approach proves insufficient

## Implementation Notes

- prefer the existing `satisfyer-official`, `nomitang-official`, and `lovehoney-official` patterns
- keep Womanizer-specific selectors and parsing logic isolated inside `src/scraper/womanizer-official`
- keep crawler and cleaner independently runnable and debuggable
- design the parser so small storefront copy or layout changes do not require rewriting the whole scraper
