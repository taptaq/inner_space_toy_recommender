# LBDO Official Scraper Design

## Goal

Create a dedicated `lbdo-official` scraper for the US storefront that crawls `https://us.lbdo.com/collections/all`, extracts products from the `collection__products` grid, reads product detail text from `accordion` / `accordion__content`, filters out charging-cable style accessories, and converts USD prices to RMB during cleaning.

## Scope

This work covers:

- one shared official-site scraper directory for LBDO US
- collection page parsing from `.collection__products`
- Shopify `products.json` fallback
- product detail hydration from product HTML and `/products/<handle>.js`
- cleaner with `USD -> CNY` conversion
- product filtering for charging cables and similar accessory-only rows
- tests and package scripts

## Structure

New directory:

- `src/scraper/lbdo-official/crawler.ts`
- `src/scraper/lbdo-official/cleaner.ts`
- `src/scraper/lbdo-official/crawler.test.ts`
- `src/scraper/lbdo-official/cleaner.test.ts`

Data files:

- `src/data/lbdo-official-review-buffer.json`
- `src/data/lbdo-official-cleaned-data.json`
- `src/data/lbdo-official-raw-description-zh-cache.json`

## List Strategy

Primary source:

- `.collection__products`

Stable fallback:

- `https://us.lbdo.com/collections/all/products.json?limit=250&page=N`

Use URL-based dedupe and prefer Shopify JSON titles when HTML names look more marketing-heavy.

## Detail Strategy

Primary detail text source:

- `.accordion`
- `.accordion__content`

Do not use whole-page `stripTags(html)` as the main description source.

Extract:

- accordion section headings
- accordion content text

Use `/products/<handle>.js` for:

- stable title
- stable price
- image list
- fallback raw description

## Filtering

Filter out charging-cable accessory products such as:

- `charging cable`
- `charger`
- `replacement charging cable`
- `magnetic charging cable`

This should apply at least to:

- product title
- subtitle / product_type
- handle

## Currency

The `us.lbdo.com` storefront serves USD pricing.

Cleaner requirements:

- preserve `price_source_currency = USD`
- preserve `price_source_amount`
- convert to `price_rmb`
- persist FX metadata

## Validation

Tests should cover:

- `.collection__products` parsing
- charging-cable filtering
- JSON fallback
- detail extraction from accordion panels
- USD to RMB conversion
