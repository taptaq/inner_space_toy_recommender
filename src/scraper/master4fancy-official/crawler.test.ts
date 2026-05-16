import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildDetailExtractionScript,
  buildMaster4FancyRawDescription,
  buildReviewBufferItem,
  collapseDuplicateMaster4FancySeries,
  crawlDetailItems,
  crawlListingPages,
  deriveMaster4FancySeriesKey,
  extractListItemsFromHtml,
  extractPaginationUrlsFromHtml,
  mergeUniqueListItems,
  normalizeProductUrl,
  orchestrateMaster4FancyDetailOcr,
  resolveCrawlerRuntimeOptions,
  shouldAutoRunCleaner,
  shouldKeepMaster4FancyCandidate,
  withClosablePage,
  writeReviewBuffer,
} from './crawler.ts';

test('normalizeProductUrl keeps canonical Master4Fancy product urls', () => {
  assert.equal(
    normalizeProductUrl('https://master4fancy.com/products/anubis?variant=123#gallery'),
    'https://master4fancy.com/products/anubis',
  );
  assert.equal(
    normalizeProductUrl('/collections/inventory/products/reaper'),
    'https://master4fancy.com/products/reaper',
  );
});

test('deriveMaster4FancySeriesKey removes obvious size hardness and copy suffixes while keeping series identity', () => {
  assert.equal(
    deriveMaster4FancySeriesKey({
      name: 'ANUBIS Small 00-40(NC)',
      sourceUrl: 'https://master4fancy.com/products/anubis-small-00-40nc-%E5%A4%8D%E5%88%B6-1',
    }),
    'anubis',
  );

  assert.equal(
    deriveMaster4FancySeriesKey({
      name: 'Reaper 403 Small NC31 2A SOFT',
      sourceUrl: 'https://master4fancy.com/products/reaper-403-small-nc31-2a-soft',
    }),
    'reaper 403',
  );

  assert.equal(
    deriveMaster4FancySeriesKey({
      name: 'Silby Medium Size 2A SOFT',
      sourceUrl: 'https://master4fancy.com/products/silby-medium-size-2a-soft',
    }),
    'silby',
  );

  assert.equal(
    deriveMaster4FancySeriesKey({
      name: 'GEM THE KEEPER 00-50 ONE SIZE',
      sourceUrl: 'https://master4fancy.com/products/gem-the-keeper-00-50-one-size-2',
    }),
    'gem the keeper',
  );

  assert.equal(
    deriveMaster4FancySeriesKey({
      name: 'Black Blood Harness: Perfect for Hands-Free Strap-on and Female-led Play',
      sourceUrl: 'https://master4fancy.com/products/black-blood-harness-perfect-for-strap-on-and-female-led-play',
    }),
    'black blood harness',
  );
});

test('collapseDuplicateMaster4FancySeries keeps one representative per series and preserves earliest position', () => {
  const result = collapseDuplicateMaster4FancySeries([
    {
      sourceUrl: 'https://master4fancy.com/products/anubis-small-2a-soft',
      name: 'ANUBIS Small 2A SOFT',
      subtitle: 'Vendor:',
      coverImage: 'https://cdn.example.com/anubis-1.jpg',
      priceUsd: 95,
      originalPriceUsd: 110,
      priceCurrency: 'USD',
      categoryHints: ['fantasy'],
      genderHint: 'unisex',
      stock: 'in_stock',
      listPosition: 3,
    },
    {
      sourceUrl: 'https://master4fancy.com/products/anubis-small-00-40nc-%E5%A4%8D%E5%88%B6-1',
      name: 'ANUBIS Small 00-40(NC)',
      subtitle: 'Sale',
      coverImage: 'https://cdn.example.com/anubis-2.jpg',
      priceUsd: 92,
      originalPriceUsd: 108,
      priceCurrency: 'USD',
      categoryHints: ['insertable'],
      genderHint: 'unisex',
      stock: 'in_stock',
      listPosition: 1,
    },
    {
      sourceUrl: 'https://master4fancy.com/products/silby-medium-size-2a-soft',
      name: 'Silby Medium Size 2A SOFT',
      subtitle: 'Vendor:',
      coverImage: 'https://cdn.example.com/silby-1.jpg',
      priceUsd: 88,
      originalPriceUsd: 99,
      priceCurrency: 'USD',
      categoryHints: [],
      genderHint: 'unisex',
      stock: 'in_stock',
      listPosition: 2,
    },
    {
      sourceUrl: 'https://master4fancy.com/products/silby-small-2a-soft',
      name: 'Silby Small 2A SOFT',
      subtitle: 'Vendor:',
      coverImage: 'https://cdn.example.com/silby-2.jpg',
      priceUsd: 84,
      originalPriceUsd: 94,
      priceCurrency: 'USD',
      categoryHints: ['soft'],
      genderHint: 'unisex',
      stock: 'in_stock',
      listPosition: 4,
    },
  ]);

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => ({
      name: item.name,
      sourceUrl: item.sourceUrl,
      listPosition: item.listPosition,
      categoryHints: item.categoryHints,
    })),
    [
      {
        name: 'ANUBIS Small 00-40(NC)',
        sourceUrl: 'https://master4fancy.com/products/anubis-small-00-40nc-%E5%A4%8D%E5%88%B6-1',
        listPosition: 1,
        categoryHints: ['insertable', 'fantasy'],
      },
      {
        name: 'Silby Medium Size 2A SOFT',
        sourceUrl: 'https://master4fancy.com/products/silby-medium-size-2a-soft',
        listPosition: 2,
        categoryHints: ['soft'],
      },
    ],
  );
});

test('shouldKeepMaster4FancyCandidate keeps toys, accessories, and apparel but rejects weak merch', () => {
  assert.equal(
    shouldKeepMaster4FancyCandidate({
      name: 'ANUBIS',
      subtitle: 'Fantasy dual-density dildo',
      rawDescription: 'Fantasy body-safe insertable toy.',
    }),
    true,
  );

  assert.equal(
    shouldKeepMaster4FancyCandidate({
      name: 'Alien Egg Mold',
      subtitle: 'Accessory for casting fantasy eggs',
      rawDescription: 'Silicone mold accessory.',
    }),
    true,
  );

  assert.equal(
    shouldKeepMaster4FancyCandidate({
      name: 'Black Blood Harness',
      subtitle: 'Adjustable fantasy harness wear',
      rawDescription: 'Harness apparel for fantasy play.',
    }),
    true,
  );

  assert.equal(
    shouldKeepMaster4FancyCandidate({
      name: 'Fantasy Play Mat',
      subtitle: 'Printed merch mat',
      rawDescription: 'A decorative play mat accessory for photos.',
    }),
    false,
  );

  assert.equal(
    shouldKeepMaster4FancyCandidate({
      name: 'Lucky Bag',
      subtitle: 'Mystery merch bundle',
      rawDescription: 'Random lucky bag.',
    }),
    false,
  );

  assert.equal(
    shouldKeepMaster4FancyCandidate({
      sourceUrl: 'https://master4fancy.com/products/anubis-small-2a-soft',
      name: 'ANUBIS Small 2A Soft',
      subtitle: 'Vendor:',
      rawDescription: '',
    }),
    true,
  );

  assert.equal(
    shouldKeepMaster4FancyCandidate({
      sourceUrl: 'https://master4fancy.com/products/the-mini-squishies-1',
      name: 'The Mini Squishies',
      subtitle: 'Cute squishy merch',
      rawDescription: '',
    }),
    false,
  );
});

test('extractListItemsFromHtml parses inventory cards from #product-grid', () => {
  const result = extractListItemsFromHtml(`
    <div id="product-grid">
      <div class="grid__item">
        <a href="/products/anubis">
          <img src="//cdn.shopify.com/anubis.jpg" alt="ANUBIS" />
          <h3>ANUBIS</h3>
        </a>
        <p>Fantasy dual-density dildo</p>
        <span class="price-item price-item--sale">$95.00</span>
        <span class="price-item price-item--regular">$110.00</span>
      </div>
      <div class="grid__item">
        <a href="/products/black-blood-harness">
          <img src="//cdn.shopify.com/harness.jpg" alt="Black Blood Harness" />
          <h3>Black Blood Harness</h3>
        </a>
        <p>Adjustable fantasy harness wear</p>
        <span class="price-item">$65.00</span>
      </div>
    </div>
  `);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://master4fancy.com/products/anubis',
    name: 'ANUBIS',
    subtitle: 'Fantasy dual-density dildo',
    coverImage: 'https://cdn.shopify.com/anubis.jpg',
    priceUsd: 95,
    originalPriceUsd: 110,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'unisex',
    stock: 'in_stock',
    listPosition: 1,
  });
});

test('extractListItemsFromHtml keeps inventory products whose titles are universe names without generic toy keywords', () => {
  const result = extractListItemsFromHtml(`
    <div id="product-grid">
      <div class="grid__item">
        <a href="/products/anubis-small-2a-soft">
          <img src="//cdn.shopify.com/anubis.jpg" alt="ANUBIS Small 2A Soft" />
          <h3>ANUBIS Small 2A Soft</h3>
        </a>
        <p>Vendor:</p>
        <span class="price-item">$95.00</span>
      </div>
      <div class="grid__item">
        <a href="/products/the-mini-squishies-1">
          <img src="//cdn.shopify.com/squishies.jpg" alt="The Mini Squishies" />
          <h3>The Mini Squishies</h3>
        </a>
        <p>Cute squishy merch</p>
        <span class="price-item">$12.00</span>
      </div>
    </div>
  `);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.sourceUrl, 'https://master4fancy.com/products/anubis-small-2a-soft');
});

test('extractListItemsFromHtml falls back to plain product links when card classes are unstable', () => {
  const result = extractListItemsFromHtml(`
    <div id="product-grid">
      <a href="/products/reaper">Reaper 6 reviews</a>
      <div>$88.00</div>
      <div>~~$98.00~~</div>
      <a href="/products/alien-egg-mold">Alien Egg Mold no reviews</a>
      <div>$20.00</div>
    </div>
  `);

  assert.equal(result.length, 2);
  assert.equal(result[0]?.name, 'Reaper');
  assert.equal(result[0]?.priceUsd, 88);
  assert.equal(result[1]?.name, 'Alien Egg Mold');
  assert.equal(result[1]?.priceUsd, 20);
});

test('extractListItemsFromHtml fallback keeps one item per product when Shopify cards repeat product anchors', () => {
  const result = extractListItemsFromHtml(`
    <div id="product-grid">
      <a href="/products/reaper"><img src="//cdn.shopify.com/reaper-thumb.jpg" alt="Reaper" /></a>
      <a href="/products/reaper">Reaper 6 reviews</a>
      <div>$88.00</div>
      <div>~~$98.00~~</div>

      <a href="/products/alien-egg-mold"><img src="//cdn.shopify.com/egg-thumb.jpg" alt="Alien Egg Mold" /></a>
      <a href="/products/alien-egg-mold">Alien Egg Mold no reviews</a>
      <div>$20.00</div>
    </div>
  `);

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => item.sourceUrl),
    [
      'https://master4fancy.com/products/reaper',
      'https://master4fancy.com/products/alien-egg-mold',
    ],
  );
  assert.equal(result[0]?.name, 'Reaper');
  assert.equal(result[0]?.priceUsd, 88);
  assert.equal(result[1]?.name, 'Alien Egg Mold');
  assert.equal(result[1]?.priceUsd, 20);
});

test('extractListItemsFromHtml fallback deduplicates non-contiguous repeated product anchors', () => {
  const result = extractListItemsFromHtml(`
    <div id="product-grid">
      <a href="/products/reaper"><img src="//cdn.shopify.com/reaper-thumb.jpg" alt="Reaper" /></a>
      <div>$88.00</div>
      <a href="/products/alien-egg-mold">Alien Egg Mold no reviews</a>
      <div>$20.00</div>
      <a href="/products/reaper">Reaper 6 reviews</a>
      <div>~~$98.00~~</div>
    </div>
  `);

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => ({ url: item.sourceUrl, priceUsd: item.priceUsd, originalPriceUsd: item.originalPriceUsd })),
    [
      {
        url: 'https://master4fancy.com/products/reaper',
        priceUsd: 88,
        originalPriceUsd: 98,
      },
      {
        url: 'https://master4fancy.com/products/alien-egg-mold',
        priceUsd: 20,
        originalPriceUsd: null,
      },
    ],
  );
});

test('extractListItemsFromHtml fallback still filters weak merch candidates', () => {
  const result = extractListItemsFromHtml(`
    <div id="product-grid">
      <a href="/products/reaper">Reaper 6 reviews</a>
      <div>$88.00</div>
      <a href="/products/fantasy-play-mat">Fantasy Play Mat no reviews</a>
      <div>$20.00</div>
    </div>
  `);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.sourceUrl, 'https://master4fancy.com/products/reaper');
});

test('extractListItemsFromHtml fallback excludes neutral merch without allowed product signals', () => {
  const result = extractListItemsFromHtml(`
    <div id="product-grid">
      <a href="/products/fantasy-pin">Fantasy Pin no reviews</a>
      <div>$12.00</div>
      <a href="/products/reaper">Reaper 6 reviews</a>
      <div>$88.00</div>
    </div>
  `);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.sourceUrl, 'https://master4fancy.com/products/reaper');
});

test('extractListItemsFromHtml fallback keeps items when nearby descriptive text provides allow-signal', () => {
  const result = extractListItemsFromHtml(`
    <div id="product-grid">
      <a href="/products/eclipse">Eclipse no reviews</a>
      <div>Fantasy dual-density dildo</div>
      <div>$92.00</div>
    </div>
  `);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.sourceUrl, 'https://master4fancy.com/products/eclipse');
  assert.equal(result[0]?.subtitle, 'Fantasy dual-density dildo');
});

test('extractListItemsFromHtml prefers lazy-loaded image sources over placeholder src values', () => {
  const result = extractListItemsFromHtml(`
    <div id="product-grid">
      <div class="grid__item">
        <a href="/products/anubis">
          <img
            data-src="//cdn.shopify.com/anubis-lazy.jpg"
            src="https://master4fancy.com/cdn/shop/files/placeholder.gif"
            srcset="//cdn.shopify.com/anubis-placeholder.jpg 1x"
            alt="ANUBIS"
          />
          <h3>ANUBIS</h3>
        </a>
        <p>Fantasy dual-density dildo</p>
        <span class="price-item">$95.00</span>
      </div>
    </div>
  `);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.coverImage, 'https://cdn.shopify.com/anubis-lazy.jpg');
});

test('mergeUniqueListItems keeps earliest position for duplicate canonical urls', () => {
  const result = mergeUniqueListItems([
    {
      sourceUrl: 'https://master4fancy.com/collections/inventory/products/anubis?variant=1',
      name: 'ANUBIS',
      subtitle: 'Fantasy dual-density dildo',
      coverImage: 'https://cdn.example.com/1.jpg',
      priceUsd: 95,
      originalPriceUsd: 110,
      priceCurrency: 'USD',
      categoryHints: ['fantasy'],
      genderHint: 'unisex',
      stock: 'in_stock',
      listPosition: 5,
    },
    {
      sourceUrl: 'https://master4fancy.com/products/anubis',
      name: 'ANUBIS',
      subtitle: 'Fantasy dual-density dildo',
      coverImage: 'https://cdn.example.com/2.jpg',
      priceUsd: 95,
      originalPriceUsd: 110,
      priceCurrency: 'USD',
      categoryHints: ['dildo'],
      genderHint: 'unisex',
      stock: 'sold_out',
      listPosition: 1,
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.sourceUrl, 'https://master4fancy.com/products/anubis');
  assert.equal(result[0]?.listPosition, 1);
  assert.deepEqual(result[0]?.categoryHints, ['fantasy', 'dildo']);
});

test('resolveCrawlerRuntimeOptions supports debug overrides and skip-cleaner flag', () => {
  assert.deepEqual(
    resolveCrawlerRuntimeOptions({
      MASTER4FANCY_OFFICIAL_MAX_ITEMS: '2',
      MASTER4FANCY_OFFICIAL_LIST_SETTLE_MS: '400',
      MASTER4FANCY_OFFICIAL_PAGE_SETTLE_MS: '500',
      MASTER4FANCY_OFFICIAL_DETAIL_SETTLE_MS: '600',
      MASTER4FANCY_OFFICIAL_DETAIL_DELAY_MS: '0',
      MASTER4FANCY_OFFICIAL_VERBOSE: '0',
    }),
    {
      maxItems: 2,
      listSettleMs: 400,
      pageSettleMs: 500,
      detailSettleMs: 600,
      detailDelayMs: 0,
      verbose: false,
    },
  );

  assert.equal(shouldAutoRunCleaner({}), true);
  assert.equal(shouldAutoRunCleaner({ MASTER4FANCY_OFFICIAL_SKIP_CLEANER: '1' }), false);
});

test('extractPaginationUrlsFromHtml reads unique inventory pagination links', () => {
  const urls = extractPaginationUrlsFromHtml(`
    <ul class="pagination__list list-unstyled">
      <li><a href="/collections/inventory?page=1">1</a></li>
      <li><a href="/collections/inventory?page=2">2</a></li>
      <li><a href="/collections/inventory?page=3">3</a></li>
      <li><a href="/collections/inventory?page=3#next">3 again</a></li>
      <li><a href="/collections/other?page=8">ignore</a></li>
    </ul>
  `);

  assert.deepEqual(urls, [
    'https://master4fancy.com/collections/inventory',
    'https://master4fancy.com/collections/inventory?page=2',
    'https://master4fancy.com/collections/inventory?page=3',
  ]);
});

test('buildReviewBufferItem merges detail fields and keeps includable detail records', () => {
  const row = buildReviewBufferItem(
    {
      sourceUrl: 'https://master4fancy.com/products/anubis',
      name: 'ANUBIS',
      subtitle: 'Fantasy dual-density dildo',
      coverImage: 'https://cdn.shopify.com/anubis-list.jpg',
      priceUsd: 95,
      originalPriceUsd: 110,
      priceCurrency: 'USD',
      categoryHints: ['fantasy'],
      genderHint: 'unisex',
      stock: 'in_stock',
      listPosition: 1,
    },
    {
      title: 'ANUBIS',
      subtitle: 'Fantasy dual-density dildo',
      metaTitle: 'ANUBIS | Master4Fancy',
      metaDescription: 'Body-safe fantasy insertable toy.',
      priceUsd: 99,
      originalPriceUsd: 115,
      coverImage: 'https://cdn.shopify.com/anubis-detail.jpg',
      galleryImages: [
        'https://cdn.shopify.com/anubis-detail.jpg',
        'https://cdn.shopify.com/anubis-side.jpg',
      ],
      rawDescription: 'Body-safe fantasy insertable toy with sculpted ridges.',
    },
  );

  assert.ok(row);
  assert.equal(row?.coverImage, 'https://cdn.shopify.com/anubis-detail.jpg');
  assert.equal(row?.priceUsd, 99);
  assert.deepEqual(row?.detailImageUrls, [
    'https://cdn.shopify.com/anubis-detail.jpg',
    'https://cdn.shopify.com/anubis-side.jpg',
  ]);
  assert.equal(row?.isReviewed, false);
});

test('buildReviewBufferItem keeps series-named inventory rows when detail copy is generic but sourceUrl is valid', () => {
  const row = buildReviewBufferItem(
    {
      sourceUrl: 'https://master4fancy.com/products/anubis-small-2a-soft',
      name: 'ANUBIS Small 2A SOFT',
      subtitle: 'Vendor:',
      coverImage: 'https://cdn.shopify.com/anubis-list.jpg',
      priceUsd: 95,
      originalPriceUsd: 110,
      priceCurrency: 'USD',
      categoryHints: [],
      genderHint: 'unisex',
      stock: 'in_stock',
      listPosition: 1,
    },
    {
      title: 'ANUBIS Small 2A SOFT',
      subtitle: 'Vendor:',
      metaTitle: 'ANUBIS Small 2A SOFT – Master4Fancy四趣',
      metaDescription: 'These items are inventory drops, generally shipped within 72 hours.',
      priceUsd: 95,
      originalPriceUsd: 110,
      coverImage: 'https://cdn.shopify.com/anubis-detail.jpg',
      galleryImages: ['https://cdn.shopify.com/anubis-detail.jpg'],
      rawDescription: 'These items are inventory drops, generally shipped within 72 hours.',
    },
  );

  assert.ok(row);
  assert.equal(row?.name, 'ANUBIS Small 2A SOFT');
});

test('crawlListingPages iterates pagination, deduplicates items, and logs progress', async () => {
  const logs: string[] = [];
  const fetchedUrls: string[] = [];
  const pages = new Map<string, string>([
    [
      'https://master4fancy.com/collections/inventory',
      `
        <div id="product-grid">
          <div class="grid__item">
            <a href="/products/anubis"><h3>ANUBIS</h3></a>
            <p>Fantasy dual-density dildo</p>
            <span class="price-item">$95.00</span>
          </div>
        </div>
        <ul class="pagination__list list-unstyled">
          <li><a href="/collections/inventory?page=1">1</a></li>
          <li><a href="/collections/inventory?page=2">2</a></li>
        </ul>
      `,
    ],
    [
      'https://master4fancy.com/collections/inventory?page=2',
      `
        <div id="product-grid">
          <div class="grid__item">
            <a href="/products/anubis"><h3>ANUBIS</h3></a>
            <p>Fantasy dual-density dildo</p>
            <span class="price-item">$95.00</span>
          </div>
          <div class="grid__item">
            <a href="/products/black-blood-harness"><h3>Black Blood Harness</h3></a>
            <p>Adjustable fantasy harness wear</p>
            <span class="price-item">$65.00</span>
          </div>
        </div>
      `,
    ],
  ]);

  const items = await crawlListingPages({
    runtime: resolveCrawlerRuntimeOptions({ MASTER4FANCY_OFFICIAL_MAX_ITEMS: '10' }),
    fetchPageHtml: async (url) => {
      fetchedUrls.push(url);
      const html = pages.get(url);
      assert.ok(html, `Unexpected URL fetched: ${url}`);
      return html;
    },
    log: (message) => {
      logs.push(message);
    },
  });

  assert.deepEqual(fetchedUrls, [
    'https://master4fancy.com/collections/inventory',
    'https://master4fancy.com/collections/inventory?page=2',
  ]);
  assert.deepEqual(
    items.map((item) => ({ name: item.name, listPosition: item.listPosition })),
    [
      { name: 'ANUBIS', listPosition: 1 },
      { name: 'Black Blood Harness', listPosition: 2 },
    ],
  );
  assert.match(logs.join('\n'), /抓取列表页 1\/2/);
  assert.match(logs.join('\n'), /当前累计唯一商品数: 2/);
});

test('crawlListingPages preserves earlier-page order when later pages contain duplicate series', async () => {
  const pages = new Map<string, string>([
    [
      'https://master4fancy.com/collections/inventory',
      `
        <div id="product-grid">
          <div class="grid__item">
            <a href="/products/anubis-small-2a-soft"><h3>ANUBIS Small 2A SOFT</h3></a>
            <p>Vendor:</p>
            <span class="price-item">$95.00</span>
          </div>
        </div>
        <ul class="pagination__list list-unstyled">
          <li><a href="/collections/inventory?page=1">1</a></li>
          <li><a href="/collections/inventory?page=2">2</a></li>
        </ul>
      `,
    ],
    [
      'https://master4fancy.com/collections/inventory?page=2',
      `
        <div id="product-grid">
          <div class="grid__item">
            <a href="/products/anubis-small-00-40nc-copy"><h3>ANUBIS Small 00-40(NC)</h3></a>
            <p>Sale</p>
            <span class="price-item">$92.00</span>
          </div>
          <div class="grid__item">
            <a href="/products/gem-the-keeper-00-50-one-size-2"><h3>GEM THE KEEPER 00-50 ONE SIZE</h3></a>
            <p>Vendor:</p>
            <span class="price-item">$102.00</span>
          </div>
        </div>
      `,
    ],
  ]);

  const items = await crawlListingPages({
    runtime: resolveCrawlerRuntimeOptions({ MASTER4FANCY_OFFICIAL_MAX_ITEMS: '10' }),
    fetchPageHtml: async (url) => {
      const html = pages.get(url);
      assert.ok(html, `Unexpected URL fetched: ${url}`);
      return html;
    },
    log: () => {},
  });

  assert.deepEqual(
    items.map((item) => ({ name: item.name, listPosition: item.listPosition })),
    [
      { name: 'ANUBIS Small 2A SOFT', listPosition: 1 },
      { name: 'GEM THE KEEPER 00-50 ONE SIZE', listPosition: 2 },
    ],
  );
});

test('crawlListingPages does not let later-page duplicate series jump ahead of earlier unique items', async () => {
  const pages = new Map<string, string>([
    [
      'https://master4fancy.com/collections/inventory',
      `
        <div id="product-grid">
          <div class="grid__item">
            <a href="/products/anubis-small-2a-soft"><h3>ANUBIS Small 2A SOFT</h3></a>
            <p>Vendor:</p>
            <span class="price-item">$95.00</span>
          </div>
          <div class="grid__item">
            <a href="/products/silby-medium-size-2a-soft"><h3>Silby Medium Size 2A SOFT</h3></a>
            <p>Vendor:</p>
            <span class="price-item">$88.00</span>
          </div>
          <div class="grid__item">
            <a href="/products/flash-of-prey-small-00-60-medium-2"><h3>FLASH OF PREY Small 2A SOFT</h3></a>
            <p>Vendor:</p>
            <span class="price-item">$102.00</span>
          </div>
        </div>
        <ul class="pagination__list list-unstyled">
          <li><a href="/collections/inventory?page=1">1</a></li>
          <li><a href="/collections/inventory?page=2">2</a></li>
        </ul>
      `,
    ],
    [
      'https://master4fancy.com/collections/inventory?page=2',
      `
        <div id="product-grid">
          <div class="grid__item">
            <a href="/products/flash-of-prey-small-00-60-medium-%E5%A4%8D%E5%88%B6"><h3>FLASH OF PREY Small 2A SOFT</h3></a>
            <p>Sale</p>
            <span class="price-item">$101.00</span>
          </div>
          <div class="grid__item">
            <a href="/products/gem-the-keeper-00-50-one-size-2"><h3>GEM THE KEEPER 00-50 ONE SIZE</h3></a>
            <p>Vendor:</p>
            <span class="price-item">$99.00</span>
          </div>
        </div>
      `,
    ],
  ]);

  const items = await crawlListingPages({
    runtime: resolveCrawlerRuntimeOptions({ MASTER4FANCY_OFFICIAL_MAX_ITEMS: '10' }),
    fetchPageHtml: async (url) => {
      const html = pages.get(url);
      assert.ok(html, `Unexpected URL fetched: ${url}`);
      return html;
    },
    log: () => {},
  });

  assert.deepEqual(
    items.map((item) => item.name),
    [
      'ANUBIS Small 2A SOFT',
      'Silby Medium Size 2A SOFT',
      'FLASH OF PREY Small 2A SOFT',
      'GEM THE KEEPER 00-50 ONE SIZE',
    ],
  );
});

test('crawlDetailItems writes the review buffer and skips cleaner handoff when disabled', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm4f-crawler-'));
  const bufferPath = path.join(tempDir, 'review-buffer.json');
  const cleanerCalls: string[] = [];

  const rows = await crawlDetailItems({
    items: [
      {
        sourceUrl: 'https://master4fancy.com/products/anubis',
        name: 'ANUBIS',
        subtitle: 'Fantasy dual-density dildo',
        coverImage: 'https://cdn.shopify.com/anubis-list.jpg',
        priceUsd: 95,
        originalPriceUsd: 110,
        priceCurrency: 'USD',
        categoryHints: [],
        genderHint: 'unisex',
        stock: 'in_stock',
        listPosition: 1,
      },
    ],
    runtime: resolveCrawlerRuntimeOptions({ MASTER4FANCY_OFFICIAL_VERBOSE: '1' }),
    fetchDetail: async () => ({
      title: 'ANUBIS',
      subtitle: 'Fantasy dual-density dildo',
      metaTitle: 'ANUBIS | Master4Fancy',
      metaDescription: 'Body-safe fantasy insertable toy.',
      priceUsd: 95,
      originalPriceUsd: 110,
      coverImage: 'https://cdn.shopify.com/anubis-detail.jpg',
      galleryImages: ['https://cdn.shopify.com/anubis-detail.jpg'],
      rawDescription: 'Body-safe fantasy insertable toy.',
    }),
    bufferPath,
    autoRunCleaner: false,
    runCleaner: async () => {
      cleanerCalls.push('called');
    },
    log: () => {},
  });

  assert.equal(rows.length, 1);
  assert.deepEqual(cleanerCalls, []);
  assert.deepEqual(JSON.parse(fs.readFileSync(bufferPath, 'utf8')), rows);
});

test('withClosablePage closes only after async detail work resolves', async () => {
  const events: string[] = [];
  let isClosed = false;

  const result = await withClosablePage(
    {
      close: async () => {
        isClosed = true;
        events.push('close');
      },
    },
    async () => {
      events.push('start');
      await Promise.resolve();
      assert.equal(isClosed, false);
      events.push('resolved');
      return 'ok';
    },
  );

  assert.equal(result, 'ok');
  assert.equal(isClosed, true);
  assert.deepEqual(events, ['start', 'resolved', 'close']);
});

test('buildDetailExtractionScript returns executable browser extraction code', async () => {
  const script = buildDetailExtractionScript();
  const document = {
    title: 'ANUBIS | Master4Fancy',
    querySelector(selector: string) {
      const mapping: Record<string, any> = {
        h1: { textContent: 'ANUBIS' },
        '.product__description, .rte': { textContent: 'Fantasy insertable toy.' },
        '.product__text, .product__subtitle': { textContent: 'Dual-density fantasy dildo' },
        'meta[name="description"]': {
          getAttribute(name: string) {
            return name === 'content' ? 'Body-safe fantasy toy.' : null;
          },
        },
        '.price .price-item--sale, .price__sale .price-item, .price-item--sale': { textContent: '$95.00' },
        '.price .price-item--regular, .price__compare .price-item, .price-item--regular': { textContent: '$110.00' },
      };
      return mapping[selector] ?? null;
    },
    querySelectorAll(selector: string) {
      if (selector === '.product__media img, .product__media-gallery img, .product-gallery img') {
        return [
          {
            getAttribute(name: string) {
              return name === 'src' ? '//cdn.shopify.com/anubis.jpg' : null;
            },
            currentSrc: '',
            src: '',
          },
        ];
      }
      if (selector === '.product__description .MsoNormal, .rte .MsoNormal, .MsoNormal') {
        return [];
      }
      if (selector === '.product__description .MsoNormal img, .rte .MsoNormal img, .MsoNormal img') {
        return [];
      }
      return [];
    },
  };

  const detail = Function('document', `return ${script};`)(document);

  assert.equal(detail.title, 'ANUBIS');
  assert.equal(detail.priceUsd, 95);
  assert.equal(detail.originalPriceUsd, 110);
  assert.equal(detail.coverImage, '//cdn.shopify.com/anubis.jpg');
});

test('buildDetailExtractionScript extracts MsoNormal text and images from product__description blocks', () => {
  const script = buildDetailExtractionScript();
  const makeImage = (attrs: Record<string, string>) => ({
    currentSrc: attrs.currentSrc || '',
    src: attrs.src || '',
    getAttribute(name: string) {
      return attrs[name] ?? null;
    },
  });
  const document = {
    title: 'ANUBIS | Master4Fancy',
    querySelector(selector: string) {
      const mapping: Record<string, any> = {
        h1: { textContent: 'ANUBIS' },
        '.product__description, .rte': { textContent: 'Inventory disclaimer text.' },
        '.product__text, .product__subtitle': { textContent: 'Vendor:' },
        'meta[name="description"]': {
          getAttribute(name: string) {
            return name === 'content' ? 'Body-safe fantasy toy.' : null;
          },
        },
        '.price .price-item--sale, .price__sale .price-item, .price-item--sale': { textContent: '$95.00' },
        '.price .price-item--regular, .price__compare .price-item, .price-item--regular': { textContent: '$110.00' },
      };
      return mapping[selector] ?? null;
    },
    querySelectorAll(selector: string) {
      if (selector === '.product__media img, .product__media-gallery img, .product-gallery img') {
        return [makeImage({ src: '//cdn.shopify.com/anubis.jpg' })];
      }
      if (selector === '.product__description .MsoNormal, .rte .MsoNormal, .MsoNormal') {
        return [
          {
            textContent: 'These items are inventory drops.',
          },
          {
            textContent: 'Toys with a 10% discount.',
          },
        ];
      }
      if (selector === '.product__description .MsoNormal img, .rte .MsoNormal img, .MsoNormal img') {
        return [
          makeImage({
            src: 'https://master4fancy.com/cdn/shop/files/placeholder.gif',
            currentSrc: 'https://cdn.shopify.com/mso-detail-1.jpg',
          }),
        ];
      }
      return [];
    },
  };

  const detail = Function('document', `return ${script};`)(document);

  assert.match(detail.rawDescription, /These items are inventory drops\./);
  assert.match(detail.rawDescription, /Toys with a 10% discount\./);
  assert.deepEqual(detail.descriptionImageUrls, ['https://cdn.shopify.com/mso-detail-1.jpg']);
});

test('buildDetailExtractionScript also extracts non-Mso description images for OCR', () => {
  const script = buildDetailExtractionScript();
  const makeImage = (attrs: Record<string, string>) => ({
    currentSrc: attrs.currentSrc || '',
    src: attrs.src || '',
    getAttribute(name: string) {
      return attrs[name] ?? null;
    },
  });
  const sharedImage = makeImage({
    src: 'https://master4fancy.com/cdn/shop/files/placeholder.gif',
    currentSrc: 'https://cdn.shopify.com/shared-detail.jpg',
  });
  const document = {
    title: 'ANUBIS | Master4Fancy',
    querySelector(selector: string) {
      const mapping: Record<string, any> = {
        h1: { textContent: 'ANUBIS' },
        '.product__description, .rte': { textContent: 'Inventory disclaimer text.' },
        '.product__text, .product__subtitle': { textContent: 'Vendor:' },
        'meta[name="description"]': {
          getAttribute(name: string) {
            return name === 'content' ? 'Body-safe fantasy toy.' : null;
          },
        },
      };
      return mapping[selector] ?? null;
    },
    querySelectorAll(selector: string) {
      if (selector === '.product__media img, .product__media-gallery img, .product-gallery img') {
        return [makeImage({ src: '//cdn.shopify.com/anubis.jpg' })];
      }
      if (selector === '.product__description .MsoNormal, .rte .MsoNormal, .MsoNormal') {
        return [];
      }
      if (selector === '.product__description .MsoNormal img, .rte .MsoNormal img, .MsoNormal img') {
        return [sharedImage];
      }
      if (
        selector === '.product__description img, .rte img'
      ) {
        return [
          sharedImage,
          makeImage({
            src: 'https://master4fancy.com/cdn/shop/files/placeholder.gif',
            'data-src': '//cdn.shopify.com/rte-detail-2.jpg',
          }),
        ];
      }
      return [];
    },
  };

  const detail = Function('document', `return ${script};`)(document);

  assert.deepEqual(detail.descriptionImageUrls, [
    'https://cdn.shopify.com/shared-detail.jpg',
    '//cdn.shopify.com/rte-detail-2.jpg',
  ]);
});

test('buildMaster4FancyRawDescription preserves text and appends OCR supplement when present', () => {
  const result = buildMaster4FancyRawDescription({
    rawDescription: 'Inventory disclaimer text.\nThese items are inventory drops.',
    metaDescription: 'Body-safe fantasy toy.',
    ocrText: '图片识别：尺寸对比图、硬度说明、工艺细节。',
  });

  assert.match(result, /Inventory disclaimer text\./);
  assert.match(result, /These items are inventory drops\./);
  assert.match(result, /\[图文OCR\]/);
  assert.match(result, /图片识别：尺寸对比图、硬度说明、工艺细节。/);
});

test('orchestrateMaster4FancyDetailOcr skips 404 images with concise logging and keeps only reachable urls', async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const originalGlm = process.env.GLM_API_KEY;
  const originalQwen = process.env.QWEN_API_KEY;
  const warnings: string[] = [];

  delete process.env.GLM_API_KEY;
  delete process.env.QWEN_API_KEY;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((value) => String(value)).join(' '));
  };
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('broken-detail.jpg')) {
      return {
        ok: false,
        status: 404,
        headers: new Headers(),
      } as Response;
    }

    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as Response;
  }) as typeof fetch;

  try {
    const result = await orchestrateMaster4FancyDetailOcr(
      [
        'https://cdn.shopify.com/reachable-detail.jpg',
        'https://cdn.shopify.com/broken-detail.jpg',
      ],
      'Silby Medium Size 2A SOFT',
    );

    assert.equal(result.ocrText, '');
    assert.deepEqual(result.reachableImageUrls, ['https://cdn.shopify.com/reachable-detail.jpg']);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] || '', /跳过说明图\(404\)/);
    assert.doesNotMatch(warnings[0] || '', /Error:/);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    if (originalGlm == null) {
      delete process.env.GLM_API_KEY;
    } else {
      process.env.GLM_API_KEY = originalGlm;
    }
    if (originalQwen == null) {
      delete process.env.QWEN_API_KEY;
    } else {
      process.env.QWEN_API_KEY = originalQwen;
    }
  }
});

test('buildDetailExtractionScript prefers lazy-loaded detail images over placeholder src values', () => {
  const script = buildDetailExtractionScript();
  const makeImage = (attrs: Record<string, string>) => ({
    currentSrc: attrs.currentSrc || '',
    src: attrs.src || '',
    getAttribute(name: string) {
      return attrs[name] ?? null;
    },
  });
  const document = {
    title: 'ANUBIS | Master4Fancy',
    querySelector(selector: string) {
      const mapping: Record<string, any> = {
        h1: { textContent: 'ANUBIS' },
        '.product__description, .rte': { textContent: 'Fantasy insertable toy.' },
        '.product__text, .product__subtitle': { textContent: 'Dual-density fantasy dildo' },
        'meta[name="description"]': {
          getAttribute(name: string) {
            return name === 'content' ? 'Body-safe fantasy toy.' : null;
          },
        },
        '.price .price-item--sale, .price__sale .price-item, .price-item--sale': { textContent: '$95.00' },
        '.price .price-item--regular, .price__compare .price-item, .price-item--regular': { textContent: '$110.00' },
      };
      return mapping[selector] ?? null;
    },
    querySelectorAll(selector: string) {
      if (selector === '.product__media img, .product__media-gallery img, .product-gallery img') {
        return [
          makeImage({
            src: 'https://master4fancy.com/cdn/shop/files/placeholder.gif',
            'data-src': '//cdn.shopify.com/anubis-lazy.jpg',
            srcset:
              'https://master4fancy.com/cdn/shop/files/placeholder.gif 1x, //cdn.shopify.com/anubis-srcset.jpg 2x',
          }),
        ];
      }
      return [];
    },
  };

  const detail = Function('document', `return ${script};`)(document);

  assert.equal(detail.coverImage, '//cdn.shopify.com/anubis-lazy.jpg');
  assert.deepEqual(detail.galleryImages, ['//cdn.shopify.com/anubis-lazy.jpg']);
});

test('buildDetailExtractionScript prefers currentSrc over placeholder-first srcset candidates', () => {
  const script = buildDetailExtractionScript();
  const makeImage = (attrs: Record<string, string>) => ({
    currentSrc: attrs.currentSrc || '',
    src: attrs.src || '',
    getAttribute(name: string) {
      return attrs[name] ?? null;
    },
  });
  const document = {
    title: 'ANUBIS | Master4Fancy',
    querySelector(selector: string) {
      const mapping: Record<string, any> = {
        h1: { textContent: 'ANUBIS' },
        '.product__description, .rte': { textContent: 'Fantasy insertable toy.' },
        '.product__text, .product__subtitle': { textContent: 'Dual-density fantasy dildo' },
        'meta[name="description"]': {
          getAttribute(name: string) {
            return name === 'content' ? 'Body-safe fantasy toy.' : null;
          },
        },
        '.price .price-item--sale, .price__sale .price-item, .price-item--sale': { textContent: '$95.00' },
        '.price .price-item--regular, .price__compare .price-item, .price-item--regular': { textContent: '$110.00' },
      };
      return mapping[selector] ?? null;
    },
    querySelectorAll(selector: string) {
      if (selector === '.product__media img, .product__media-gallery img, .product-gallery img') {
        return [
          makeImage({
            currentSrc: '//cdn.shopify.com/anubis-live.jpg',
            src: 'https://master4fancy.com/cdn/shop/files/placeholder.gif',
            srcset:
              'https://master4fancy.com/cdn/shop/files/placeholder.gif 1x, //cdn.shopify.com/anubis-srcset.jpg 2x',
          }),
        ];
      }
      return [];
    },
  };

  const detail = Function('document', `return ${script};`)(document);

  assert.equal(detail.coverImage, '//cdn.shopify.com/anubis-live.jpg');
  assert.deepEqual(detail.galleryImages, ['//cdn.shopify.com/anubis-live.jpg']);
});

test('writeReviewBuffer persists review rows to disk', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm4f-write-'));
  const bufferPath = path.join(tempDir, 'review-buffer.json');
  const rows = [
    {
      sourceUrl: 'https://master4fancy.com/products/anubis',
      name: 'ANUBIS',
      subtitle: 'Fantasy dual-density dildo',
      coverImage: 'https://cdn.shopify.com/anubis-detail.jpg',
      priceUsd: 95,
      originalPriceUsd: 110,
      priceCurrency: 'USD' as const,
      categoryHints: [],
      genderHint: 'unisex' as const,
      stock: 'in_stock' as const,
      listPosition: 1,
      title: 'ANUBIS',
      metaTitle: 'ANUBIS | Master4Fancy',
      metaDescription: 'Body-safe fantasy toy.',
      galleryImages: ['https://cdn.shopify.com/anubis-detail.jpg'],
      detailImageUrls: ['https://cdn.shopify.com/anubis-detail.jpg'],
      rawDescription: 'Body-safe fantasy toy.',
      isReviewed: false as const,
    },
  ];

  writeReviewBuffer(rows, bufferPath);

  assert.deepEqual(JSON.parse(fs.readFileSync(bufferPath, 'utf8')), rows);
});
