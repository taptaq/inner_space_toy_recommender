# LBDO Official Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `lbdo-official` scraper and cleaner for the US LBDO storefront that parse `.collection__products`, extract detail text from accordion panels, filter charging cables, and convert USD prices to RMB.

**Architecture:** Build one shared Shopify-style crawler for the single `collections/all` entry point, using both collection HTML and `products.json` for robust listing coverage, then normalize and sync through a dedicated cleaner into the existing `products` and `recommender_toys` flow.

**Tech Stack:** TypeScript, Playwright, Shopify `products.json` / product `.js`, Prisma/pg, Node test runner via `tsx --test`

---

### Task 1: Scaffold LBDO scraper files and scripts
- [ ] Add package scripts
- [ ] Create crawler/cleaner/test files
- [ ] Run tests to verify red

### Task 2: Implement list extraction from `.collection__products`
- [ ] Parse collection cards from `.collection__products`
- [ ] Add `products.json` fallback
- [ ] Filter charging cable products
- [ ] Verify crawler tests

### Task 3: Implement detail extraction from accordion content
- [ ] Parse accordion labels and `.accordion__content`
- [ ] Merge with product `.js` detail
- [ ] Keep stable JSON prices
- [ ] Verify crawler tests

### Task 4: Implement cleaner with USD to RMB conversion
- [ ] Normalize source currency as USD
- [ ] Convert source price to RMB
- [ ] Classify type/subtype, gender, tags
- [ ] Verify cleaner tests

### Task 5: Verify end-to-end
- [ ] Run crawler tests
- [ ] Run cleaner tests
- [ ] If stable, run `npm run scrape:lbdo-official`
- [ ] If stable, run `npm run clean:lbdo-official`
