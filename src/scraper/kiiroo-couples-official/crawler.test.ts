import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crawlListingPages,
  extractListItemsFromHtml,
  extractListItemsFromShopifyJson,
  shouldKeepKiirooCouplesCandidate,
} from './crawler.ts';

test('shouldKeepKiirooCouplesCandidate keeps shared-play products and rejects obvious accessories', () => {
  assert.equal(
    shouldKeepKiirooCouplesCandidate({
      name: 'Fuse',
      subtitle: 'Interactive dual-stimulation vibrator for couples',
      categoryHints: ['vibrator', 'couples'],
    }),
    true,
  );

  assert.equal(
    shouldKeepKiirooCouplesCandidate({
      name: 'KEON',
      subtitle: 'Interactive stroker for partner sync',
      categoryHints: ['interactive', 'couples'],
    }),
    true,
  );

  assert.equal(
    shouldKeepKiirooCouplesCandidate({
      name: 'Charging Cable',
      subtitle: 'USB charging accessory',
    }),
    false,
  );
});

test('shouldKeepKiirooCouplesCandidate keeps real products even when detail text mentions accessories', () => {
  assert.equal(
    shouldKeepKiirooCouplesCandidate({
      name: 'ProWand & Keon & FeelStroker',
      subtitle: 'Combo Pack',
      rawDescription:
        'A couples combo pack for shared pleasure with synced motion. Includes a USB charging cable and works with optional mounts and compatible cases.',
      categoryHints: ['Combo Pack'],
    }),
    true,
  );
});

test('extractListItemsFromHtml parses couples collection items and marks them as unisex', () => {
  const result = extractListItemsFromHtml(`
    <div id="ProductGridContainer">
      <div class="grid__item">
        <a href="/products/fuse"><img src="//cdn.shopify.com/fuse.jpg" alt="Fuse" /></a>
        <h3>Fuse</h3>
        <p>Interactive dual-stimulation vibrator for couples.</p>
        <span class="price-item price-item--sale">$149.00</span>
        <span class="price-item price-item--regular">$169.00</span>
      </div>
      <div class="grid__item">
        <a href="/products/keon"><img src="//cdn.shopify.com/keon.jpg" alt="KEON" /></a>
        <h3>KEON</h3>
        <p>Interactive stroker for partner sync.</p>
        <span class="price-item">$199.00</span>
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
    sourceUrl: 'https://www.kiiroo.com/products/fuse',
    name: 'Fuse',
    subtitle: 'Interactive dual-stimulation vibrator for couples.',
    coverImage: 'https://cdn.shopify.com/fuse.jpg',
    priceUsd: 149,
    originalPriceUsd: 169,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'unisex',
    listPosition: 1,
  });
  assert.deepEqual(result[1], {
    sourceUrl: 'https://www.kiiroo.com/products/keon',
    name: 'KEON',
    subtitle: 'Interactive stroker for partner sync.',
    coverImage: 'https://cdn.shopify.com/keon.jpg',
    priceUsd: 199,
    originalPriceUsd: null,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'unisex',
    listPosition: 2,
  });
});

test('extractListItemsFromShopifyJson keeps couples rows and preserves JSON order', () => {
  const result = extractListItemsFromShopifyJson({
    products: [
      {
        title: 'Fuse',
        handle: 'fuse',
        product_type: 'Couples Vibrator',
        body_html: '<p>Interactive dual-stimulation vibrator for couples.</p>',
        tags: ['interactive', 'couples', 'vibrator'],
        variants: [{ price: '149.00', compare_at_price: '169.00' }],
        images: [{ src: '//cdn.shopify.com/fuse.jpg' }],
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
        title: 'KEON',
        handle: 'keon',
        product_type: 'Interactive Stroker',
        body_html: '<p>Interactive stroker for partner sync.</p>',
        tags: ['interactive', 'partner', 'stroker'],
        variants: [{ price: '199.00', compare_at_price: null }],
        images: [{ src: '//cdn.shopify.com/keon.jpg' }],
      },
    ],
  });

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => ({ name: item.name, listPosition: item.listPosition })),
    [
      { name: 'Fuse', listPosition: 1 },
      { name: 'KEON', listPosition: 3 },
    ],
  );
});

test('crawlListingPages falls back to Shopify JSON for couples collection', async () => {
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
                title: 'Fuse',
                handle: 'fuse',
                product_type: 'Couples Vibrator',
                body_html: '<p>Interactive dual-stimulation vibrator for couples.</p>',
                tags: ['interactive', 'couples', 'vibrator'],
                variants: [{ price: '149.00', compare_at_price: null }],
                images: [{ src: '//cdn.shopify.com/fuse.jpg' }],
              },
            ],
          }
        : { products: [] },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, 'Fuse');
  assert.equal(result[0]?.sourceUrl, 'https://www.kiiroo.com/products/fuse');
});

test('crawlListingPages extracts combo-pack couples rows from ShopifyAnalytics meta products', async () => {
  const result = await crawlListingPages({
    maxItems: 10,
    fetchCollectionHtml: async () => `
      <html>
        <body>
          <script>
            var meta = {"products":[
              {
                "handle":"luxus",
                "type":"Couples Vibrator",
                "variants":[{"price":14900,"name":"Luxus™"}]
              },
              {
                "handle":"spot-prowand",
                "type":"Combo Pack",
                "variants":[{"price":17900,"name":"Spot & ProWand"}]
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
        name: 'Luxus™',
        sourceUrl: 'https://www.kiiroo.com/products/luxus',
        priceUsd: 149,
      },
      {
        name: 'Spot & ProWand',
        sourceUrl: 'https://www.kiiroo.com/products/spot-prowand',
        priceUsd: 179,
      },
    ],
  );
});

test('crawlListingPages prefers Shopify meta titles over marketing copy from couples collection HTML cards', async () => {
  const result = await crawlListingPages({
    maxItems: 10,
    fetchCollectionHtml: async () => `
      <html>
        <body>
          <div id="ProductGridContainer">
            <div class="grid__item">
              <a href="/products/prowand-keon-feelstroker">
                <img src="//cdn.shopify.com/prowand-keon.jpg" alt="marketing alt" />
              </a>
              <h3>ProWand pink vibrator, Keon masturbator, and FeelStroker mid brown</h3>
            </div>
            <div class="grid__item">
              <a href="/products/spot-pearl3">
                <img src="//cdn.shopify.com/spot-pearl3.jpg" alt="marketing alt" />
              </a>
              <h3>Spot, the egg vibrator, and Pearl three pink, the G-spot vibrator</h3>
            </div>
          </div>
          <script>
            var meta = {"products":[
              {
                "handle":"prowand-keon-feelstroker",
                "type":"Couple Set",
                "variants":[{"price":31300,"name":"ProWand & Keon & FeelStroker"}]
              },
              {
                "handle":"spot-pearl3",
                "type":"Couple Set",
                "variants":[{"price":21400,"name":"Spot & Pearl3"}]
              }
            ]};
          </script>
        </body>
      </html>
    `,
    fetchCollectionJsonPage: async () => ({ products: [] }),
  });

  assert.deepEqual(
    result.map((item) => ({ name: item.name, sourceUrl: item.sourceUrl })),
    [
      {
        name: 'ProWand & Keon & FeelStroker',
        sourceUrl: 'https://www.kiiroo.com/products/prowand-keon-feelstroker',
      },
      {
        name: 'Spot & Pearl3',
        sourceUrl: 'https://www.kiiroo.com/products/spot-pearl3',
      },
    ],
  );
});
