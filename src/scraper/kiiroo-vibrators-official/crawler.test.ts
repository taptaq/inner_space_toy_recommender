import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {
  buildKiirooVibratorsRawDescription,
  collectAccordionTexts,
  crawlListingPages,
  extractDetailFromHtml,
  extractDetailFromShopifyProduct,
  extractListItemsFromHtml,
  extractListItemsFromShopifyJson,
  extractRelevantDetailTextFromHtml,
  isShopifyErrorPage,
  shouldKeepKiirooVibratorsCandidate,
} from './crawler.ts';

test('shouldKeepKiirooVibratorsCandidate keeps female vibrators and rejects obvious accessory rows', () => {
  assert.equal(
    shouldKeepKiirooVibratorsCandidate({
      name: 'Pearl 2',
      subtitle: 'App-controlled clitoral vibrator',
      categoryHints: ['vibrator'],
    }),
    true,
  );

  assert.equal(
    shouldKeepKiirooVibratorsCandidate({
      name: 'Cliona',
      subtitle: 'Clitoral suction stimulator',
      categoryHints: ['suction'],
    }),
    true,
  );

  assert.equal(
    shouldKeepKiirooVibratorsCandidate({
      name: 'Charging Cable',
      subtitle: 'USB charging accessory',
    }),
    false,
  );
});

test('shouldKeepKiirooVibratorsCandidate keeps real products even when detail text mentions accessories', () => {
  assert.equal(
    shouldKeepKiirooVibratorsCandidate({
      name: 'ProWand by Kiiroo',
      subtitle: 'Wand Vibrator',
      rawDescription:
        'ProWand is a wand vibrator built for connected pleasure. Included in the box: USB charging cable. Pairs with accessories and partner setups.',
      categoryHints: ['Wand Vibrator'],
    }),
    true,
  );
});

test('extractListItemsFromHtml parses #ProductGridContainer and filters accessory rows', () => {
  const result = extractListItemsFromHtml(`
    <div id="ProductGridContainer">
      <div class="grid__item">
        <a href="/products/pearl-2"><img src="//cdn.shopify.com/pearl2.jpg" alt="Pearl 2" /></a>
        <h3>Pearl 2</h3>
        <p>App-controlled clitoral vibrator.</p>
        <span class="price-item price-item--sale">$89.00</span>
        <span class="price-item price-item--regular">$99.00</span>
      </div>
      <div class="grid__item">
        <a href="/products/cliona"><img src="//cdn.shopify.com/cliona.jpg" alt="Cliona" /></a>
        <h3>Cliona</h3>
        <p>Clitoral suction stimulator.</p>
        <span class="price-item">$119.00</span>
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
    sourceUrl: 'https://www.kiiroo.com/products/pearl-2',
    name: 'Pearl 2',
    subtitle: 'App-controlled clitoral vibrator.',
    coverImage: 'https://cdn.shopify.com/pearl2.jpg',
    priceUsd: 89,
    originalPriceUsd: 99,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'female',
    listPosition: 1,
  });
  assert.deepEqual(result[1], {
    sourceUrl: 'https://www.kiiroo.com/products/cliona',
    name: 'Cliona',
    subtitle: 'Clitoral suction stimulator.',
    coverImage: 'https://cdn.shopify.com/cliona.jpg',
    priceUsd: 119,
    originalPriceUsd: null,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'female',
    listPosition: 2,
  });
});

test('extractListItemsFromShopifyJson keeps vibrator rows and preserves JSON order', () => {
  const result = extractListItemsFromShopifyJson({
    products: [
      {
        title: 'Pearl 2',
        handle: 'pearl-2',
        product_type: 'Clitoral Vibrator',
        body_html: '<p>App-controlled clitoral vibrator.</p>',
        tags: ['app', 'vibrator', 'clitoral'],
        variants: [{ price: '89.00', compare_at_price: '99.00' }],
        images: [{ src: '//cdn.shopify.com/pearl2.jpg' }],
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
        title: 'Cliona',
        handle: 'cliona',
        product_type: 'Suction Vibrator',
        body_html: '<p>Clitoral suction stimulator with app sync.</p>',
        tags: ['suction', 'clitoral', 'app'],
        variants: [{ price: '119.00', compare_at_price: null }],
        images: [{ src: '//cdn.shopify.com/cliona.jpg' }],
      },
    ],
  });

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => ({ name: item.name, listPosition: item.listPosition })),
    [
      { name: 'Pearl 2', listPosition: 1 },
      { name: 'Cliona', listPosition: 3 },
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
                title: 'OhMiBod Pearl',
                handle: 'ohmibod-pearl',
                product_type: 'Wearable Vibrator',
                body_html: '<p>Wearable vibrator with remote app support.</p>',
                tags: ['vibrator', 'wearable', 'app'],
                variants: [{ price: '129.00', compare_at_price: null }],
                images: [{ src: '//cdn.shopify.com/pearl.jpg' }],
              },
            ],
          }
        : { products: [] },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, 'OhMiBod Pearl');
  assert.equal(result[0]?.sourceUrl, 'https://www.kiiroo.com/products/ohmibod-pearl');
});

test('crawlListingPages extracts ShopifyAnalytics meta products for vibrator collection pages', async () => {
  const result = await crawlListingPages({
    maxItems: 10,
    fetchCollectionHtml: async () => `
      <html>
        <body>
          <script>
            var meta = {"products":[
              {
                "handle":"spot",
                "type":"Vibrator",
                "variants":[{"price":10900,"name":"Spot by Kiiroo"}]
              },
              {
                "handle":"ohmibod-lumen-powered-by-kiiroo",
                "type":"Vibrator",
                "variants":[{"price":8900,"name":"Lumen"}]
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
        name: 'Spot by Kiiroo',
        sourceUrl: 'https://www.kiiroo.com/products/spot',
        priceUsd: 109,
      },
      {
        name: 'Lumen',
        sourceUrl: 'https://www.kiiroo.com/products/ohmibod-lumen-powered-by-kiiroo',
        priceUsd: 89,
      },
    ],
  );
});

test('isShopifyErrorPage detects storefront error pages', () => {
  assert.equal(isShopifyErrorPage('<html><body>Something went wrong Shopify</body></html>'), true);
  assert.equal(isShopifyErrorPage('<html><body><h1>Pearl 2</h1></body></html>'), false);
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
            <p>App-controlled vibrations</p>
            <p>Body-safe silicone</p>
          </div>
          <details class="accordion">
            <summary>Materials</summary>
            <div><p>Rechargeable waterproof design</p></div>
          </details>
        </body>
      </html>
    `);

    const text = await collectAccordionTexts(page);
    assert.match(text, /app-controlled vibrations/i);
    assert.match(text, /body-safe silicone/i);
    assert.match(text, /rechargeable waterproof design/i);
  } finally {
    await browser.close();
  }
});

test('extractRelevantDetailTextFromHtml and extractDetailFromHtml merge rte and accordion text', () => {
  const html = `
    <html>
      <head>
        <title>Pearl 2 App Controlled Vibrator</title>
        <meta name="description" content="App-controlled clitoral vibrator." />
      </head>
      <body>
        <main id="MainContent">
          <h1>Pearl 2</h1>
          <div class="rte">
            <p>App-controlled clitoral vibrator with deep rumbly vibes.</p>
            <p>Perfect for solo or partner sessions.</p>
          </div>
          <span class="price-item price-item--sale">$89.00</span>
          <span class="price-item price-item--regular">$99.00</span>
          <img src="//cdn.shopify.com/pearl2-1.jpg" alt="Pearl 2" />
        </main>
      </body>
    </html>
  `;

  const accordionText = 'Specifications\nRechargeable waterproof design\nBody-safe silicone';
  const relevantText = extractRelevantDetailTextFromHtml(html, accordionText);
  assert.match(relevantText, /app-controlled clitoral vibrator/i);
  assert.match(relevantText, /rechargeable waterproof design/i);

  const detail = extractDetailFromHtml(html, accordionText);
  assert.equal(detail.title, 'Pearl 2');
  assert.equal(detail.coverImage, 'https://cdn.shopify.com/pearl2-1.jpg');
  assert.equal(detail.priceUsd, 89);
  assert.equal(detail.originalPriceUsd, 99);
  assert.match(detail.rawDescription, /deep rumbly vibes/i);
  assert.match(detail.rawDescription, /body-safe silicone/i);
});

test('buildKiirooVibratorsRawDescription deduplicates repeated text segments', () => {
  assert.equal(
    buildKiirooVibratorsRawDescription(['Pearl 2', 'App controlled', 'App controlled', 'Waterproof']),
    'Pearl 2\nApp controlled\nWaterproof',
  );
});

test('extractDetailFromShopifyProduct falls back to Shopify description field when body_html is absent', () => {
  const detail = extractDetailFromShopifyProduct({
    title: 'Cliona',
    description: '<p>Clitoral suction stimulator with app sync.</p>',
    variants: [{ price: '119.00', compare_at_price: '129.00' }],
    images: [{ src: '//cdn.shopify.com/cliona.jpg', alt: 'Cliona' }],
  });

  assert.equal(detail.title, 'Cliona');
  assert.equal(detail.priceUsd, 119);
  assert.equal(detail.originalPriceUsd, 129);
  assert.match(detail.rawDescription, /clitoral suction stimulator/i);
});
