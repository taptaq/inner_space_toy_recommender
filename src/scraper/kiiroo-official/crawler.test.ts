import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {
  buildKiirooRawDescription,
  collectAccordionTexts,
  crawlListingPages,
  extractDetailFromHtml,
  extractDetailFromShopifyProduct,
  extractListItemsFromHtml,
  extractListItemsFromShopifyJson,
  extractRelevantDetailTextFromHtml,
  isShopifyErrorPage,
  shouldKeepKiirooCandidate,
} from './crawler.ts';

test('shouldKeepKiirooCandidate keeps male masturbators and rejects obvious accessory rows', () => {
  assert.equal(
    shouldKeepKiirooCandidate({
      name: 'KEON',
      subtitle: 'Interactive male masturbator machine',
      categoryHints: ['male masturbator'],
    }),
    true,
  );

  assert.equal(
    shouldKeepKiirooCandidate({
      name: 'Feel Stroker',
      subtitle: 'Manual sleeve stroker for male pleasure',
      categoryHints: ['stroker'],
    }),
    true,
  );

  assert.equal(
    shouldKeepKiirooCandidate({
      name: 'Charging Cable',
      subtitle: 'USB charging accessory',
    }),
    false,
  );
});

test('shouldKeepKiirooCandidate keeps real products even when detail text mentions accessories', () => {
  assert.equal(
    shouldKeepKiirooCandidate({
      name: 'Keon by Kiiroo',
      subtitle: 'Interactive Masturbator',
      rawDescription:
        'Keon is a male automatic masturbator with hands-free motion and real-time sync. Included in the box: USB charging cable. Compatible with the PowerShot Compatible Stroker Case and Keon Table Clamp.',
      categoryHints: ['Interactive Masturbator'],
    }),
    true,
  );
});

test('extractListItemsFromHtml parses #ProductGridContainer and filters accessory rows', () => {
  const result = extractListItemsFromHtml(`
    <div id="ProductGridContainer">
      <div class="grid__item">
        <a href="/products/keon"><img src="//cdn.shopify.com/keon.jpg" alt="KEON" /></a>
        <h3>KEON</h3>
        <p>Interactive male masturbator machine.</p>
        <span class="price-item price-item--sale">$199.00</span>
        <span class="price-item price-item--regular">$219.00</span>
      </div>
      <div class="grid__item">
        <a href="/products/feel-stroker"><img src="//cdn.shopify.com/feel.jpg" alt="Feel Stroker" /></a>
        <h3>Feel Stroker</h3>
        <p>Textured sleeve stroker.</p>
        <span class="price-item">$49.00</span>
      </div>
      <div class="grid__item">
        <a href="/products/charging-cable"><img src="//cdn.shopify.com/cable.jpg" alt="Charging Cable" /></a>
        <h3>Charging Cable</h3>
        <p>USB charging accessory.</p>
        <span class="price-item">$19.00</span>
      </div>
    </div>
  `);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://www.kiiroo.com/products/keon',
    name: 'KEON',
    subtitle: 'Interactive male masturbator machine.',
    coverImage: 'https://cdn.shopify.com/keon.jpg',
    priceUsd: 199,
    originalPriceUsd: 219,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'male',
    listPosition: 1,
  });
  assert.deepEqual(result[1], {
    sourceUrl: 'https://www.kiiroo.com/products/feel-stroker',
    name: 'Feel Stroker',
    subtitle: 'Textured sleeve stroker.',
    coverImage: 'https://cdn.shopify.com/feel.jpg',
    priceUsd: 49,
    originalPriceUsd: null,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'male',
    listPosition: 2,
  });
});

test('extractListItemsFromShopifyJson keeps male masturbator rows and preserves JSON order', () => {
  const result = extractListItemsFromShopifyJson({
    products: [
      {
        title: 'KEON',
        handle: 'keon',
        product_type: 'Male Masturbator',
        body_html: '<p>Interactive male masturbator machine.</p>',
        tags: ['app', 'interactive', 'masturbator'],
        variants: [{ price: '199.00', compare_at_price: '219.00' }],
        images: [{ src: '//cdn.shopify.com/keon.jpg' }],
      },
      {
        title: 'Charging Cable',
        handle: 'charging-cable',
        product_type: 'Accessory',
        body_html: '<p>USB charging accessory.</p>',
        tags: ['accessory', 'charger'],
        variants: [{ price: '19.00', compare_at_price: null }],
        images: [{ src: '//cdn.shopify.com/cable.jpg' }],
      },
      {
        title: 'Feel Connect',
        handle: 'feel-connect',
        product_type: 'Interactive Stroker',
        body_html: '<p>App-connected stroker with sync support.</p>',
        tags: ['stroker', 'interactive', 'app'],
        variants: [{ price: '89.00', compare_at_price: null }],
        images: [{ src: '//cdn.shopify.com/connect.jpg' }],
      },
    ],
  });

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => ({ name: item.name, listPosition: item.listPosition })),
    [
      { name: 'KEON', listPosition: 1 },
      { name: 'Feel Connect', listPosition: 3 },
    ],
  );
});

test('crawlListingPages falls back to Shopify JSON when collection HTML is a Shopify error page', async () => {
  const result = await crawlListingPages({
    maxItems: 10,
    fetchCollectionHtml: async () => `
      <html>
        <head><title>Something went wrong</title></head>
        <body><main><h1>Something went wrong</h1><p>Shopify storefront error.</p></main></body>
      </html>
    `,
    fetchCollectionJsonPage: async (page) =>
      page === 1
        ? {
            products: [
              {
                title: 'Titan',
                handle: 'titan',
                product_type: 'Interactive Masturbator',
                body_html: '<p>Interactive stroker with app sync.</p>',
                tags: ['app', 'interactive', 'masturbator'],
                variants: [{ price: '129.00', compare_at_price: null }],
                images: [{ src: '//cdn.shopify.com/titan.jpg' }],
              },
            ],
          }
        : { products: [] },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, 'Titan');
  assert.equal(result[0]?.sourceUrl, 'https://www.kiiroo.com/products/titan');
});

test('crawlListingPages extracts ShopifyAnalytics meta products when collection HTML cards are incomplete', async () => {
  const result = await crawlListingPages({
    maxItems: 10,
    fetchCollectionHtml: async () => `
      <html>
        <body>
          <script>
            var meta = {"products":[
              {
                "handle":"keon",
                "type":"Interactive Masturbator",
                "variants":[{"price":24900,"name":"Keon by Kiiroo"}]
              },
              {
                "handle":"powerblow",
                "type":"Blowjob Machine",
                "variants":[{"price":11900,"name":"Powerblow by Kiiroo"}]
              }
            ]};
          </script>
        </body>
      </html>
    `,
    fetchCollectionJsonPage: async () => ({ products: [] }),
  });

  assert.deepEqual(
    result.map((item) => ({ name: item.name, sourceUrl: item.sourceUrl, priceUsd: item.priceUsd })),
    [
      {
        name: 'Keon by Kiiroo',
        sourceUrl: 'https://www.kiiroo.com/products/keon',
        priceUsd: 249,
      },
      {
        name: 'Powerblow by Kiiroo',
        sourceUrl: 'https://www.kiiroo.com/products/powerblow',
        priceUsd: 119,
      },
    ],
  );
});

test('isShopifyErrorPage detects storefront error pages', () => {
  assert.equal(isShopifyErrorPage('<html><body>Something went wrong Shopify</body></html>'), true);
  assert.equal(isShopifyErrorPage('<html><body><h1>KEON</h1></body></html>'), false);
});

test('collectAccordionTexts expands accordion content on a detail page', async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(`
      <html>
        <body>
          <button class="accordion" aria-expanded="false" onclick="
            document.getElementById('specs').style.display='block';
            this.setAttribute('aria-expanded', 'true');
          ">Specifications</button>
          <div id="specs" style="display:none">
            <p>Interactive app sync</p>
            <p>Stroker sleeve</p>
          </div>
          <details class="accordion">
            <summary>Materials</summary>
            <div><p>Body-safe silicone sleeve</p></div>
          </details>
        </body>
      </html>
    `);

    const text = await collectAccordionTexts(page);
    assert.match(text, /interactive app sync/i);
    assert.match(text, /stroker sleeve/i);
    assert.match(text, /body-safe silicone sleeve/i);
  } finally {
    await browser.close();
  }
});

test('extractRelevantDetailTextFromHtml and extractDetailFromHtml merge rte and accordion text', () => {
  const html = `
    <html>
      <head>
        <title>KEON Interactive Masturbator</title>
        <meta name="description" content="App-controlled interactive male masturbator." />
      </head>
      <body>
        <main id="MainContent">
          <h1>KEON</h1>
          <div class="rte">
            <p>Hands-free interactive male masturbator machine.</p>
            <p>Syncs with app content and long-distance partners.</p>
          </div>
          <span class="price-item price-item--sale">$199.00</span>
          <span class="price-item price-item--regular">$219.00</span>
          <img src="//cdn.shopify.com/keon-1.jpg" alt="KEON" />
        </main>
      </body>
    </html>
  `;

  const accordionText = 'Specifications\nInteractive app sync\nBody-safe sleeve';
  const relevantText = extractRelevantDetailTextFromHtml(html, accordionText);
  assert.match(relevantText, /hands-free interactive male masturbator machine/i);
  assert.match(relevantText, /interactive app sync/i);

  const detail = extractDetailFromHtml(html, accordionText);
  assert.equal(detail.title, 'KEON');
  assert.equal(detail.coverImage, 'https://cdn.shopify.com/keon-1.jpg');
  assert.equal(detail.priceUsd, 199);
  assert.equal(detail.originalPriceUsd, 219);
  assert.match(detail.rawDescription, /syncs with app content/i);
  assert.match(detail.rawDescription, /body-safe sleeve/i);
});

test('buildKiirooRawDescription deduplicates repeated text segments', () => {
  assert.equal(
    buildKiirooRawDescription(['KEON', 'Interactive app sync', 'Interactive app sync', 'Body-safe sleeve']),
    'KEON\nInteractive app sync\nBody-safe sleeve',
  );
});

test('extractDetailFromShopifyProduct falls back to Shopify description field when body_html is absent', () => {
  const detail = extractDetailFromShopifyProduct({
    title: 'Feel Connect',
    description: '<p>App connected male stroker for synced sessions.</p>',
    variants: [{ price: '89.00', compare_at_price: '99.00' }],
    images: [{ src: '//cdn.shopify.com/connect.jpg', alt: 'Feel Connect' }],
  });

  assert.equal(detail.title, 'Feel Connect');
  assert.equal(detail.priceUsd, 89);
  assert.equal(detail.originalPriceUsd, 99);
  assert.match(detail.rawDescription, /app connected male stroker/i);
});
