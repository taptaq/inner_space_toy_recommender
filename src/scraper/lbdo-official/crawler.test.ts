import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crawlCollectionPages,
  extractDetailFromHtml,
  extractDetailFromShopifyProduct,
  extractListItemsFromHtml,
  extractListItemsFromShopifyJson,
  shouldKeepLbdoCandidate,
} from './crawler.ts';

test('shouldKeepLbdoCandidate keeps products and filters charging cables', () => {
  assert.equal(
    shouldKeepLbdoCandidate({
      name: 'Pulse Duo',
      subtitle: 'Bundle',
      categoryHints: ['Bundle'],
    }),
    true,
  );

  assert.equal(
    shouldKeepLbdoCandidate({
      name: 'Loop Replacement Charging Cable',
      subtitle: 'Charger',
      categoryHints: ['Charger'],
    }),
    false,
  );
});

test('extractListItemsFromHtml parses cards inside .collection__products', () => {
  const result = extractListItemsFromHtml(`
    <div class="collection__products">
      <div class="product-item">
        <a href="/products/pulse-duo" aria-label="Pulse Duo">
          <img src="//cdn.shopify.com/pulse.jpg" alt="" />
        </a>
        <h3>Pulse Duo</h3>
        <p>Bundle</p>
        <span class="price">$237.96</span>
      </div>
      <div class="product-item">
        <a href="/products/loop-charging-cable" aria-label="Loop Replacement Charging Cable">
          <img src="//cdn.shopify.com/cable.jpg" alt="" />
        </a>
        <h3>Loop Replacement Charging Cable</h3>
        <p>Charger</p>
        <span class="price">$15.00</span>
      </div>
    </div>
  `);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://us.lbdo.com/products/pulse-duo',
    name: 'Pulse Duo',
    subtitle: 'Bundle',
    coverImage: 'https://cdn.shopify.com/pulse.jpg',
    priceSourceAmount: 237.96,
    originalPriceSourceAmount: null,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'unisex',
    listPosition: 1,
  });
});

test('extractListItemsFromShopifyJson preserves USD prices and filters charging cables', () => {
  const result = extractListItemsFromShopifyJson({
    products: [
      {
        title: 'Pulse Duo',
        handle: 'pulse-duo',
        product_type: 'Bundle',
        body_html: '<p>Couples bundle.</p>',
        tags: [],
        variants: [{ price: '237.96', compare_at_price: '279.95' }],
        images: [{ src: '//cdn.shopify.com/pulse.jpg' }],
      },
      {
        title: 'Loop Replacement Charging Cable',
        handle: 'loop-charging-cable',
        product_type: 'Charger',
        body_html: '<p>Replacement charging cable.</p>',
        variants: [{ price: '15.00', compare_at_price: null }],
        images: [{ src: '//cdn.shopify.com/cable.jpg' }],
      },
    ],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.priceCurrency, 'USD');
  assert.equal(result[0]?.name, 'Pulse Duo');
});

test('extractDetailFromHtml prefers accordion content over page noise', () => {
  const detail = extractDetailFromHtml(`
    <html>
      <head>
        <title>Body Duo | LBDO</title>
        <meta name="description" content="Connection essentials." />
      </head>
      <body>
        <div class="accordion">
          <button class="accordion__label"><h3>What\\'s included</h3></button>
          <div class="accordion__content">
            <p>1 x Flow Water-Based Personal Lubricant</p>
            <p>1 x Melt Massage Candle</p>
          </div>
        </div>
        <div class="accordion">
          <button class="accordion__label"><h3>Why you\\'ll love it</h3></button>
          <div class="accordion__content">
            <p>Designed to bring relaxation and ease to your intimate moments.</p>
          </div>
        </div>
        <div class="accordion">
          <button class="accordion__label"><h3>Shipping</h3></button>
          <div class="accordion__content">
            <p>FREE SHIPPING on order above $100.</p>
          </div>
        </div>
      </body>
    </html>
  `);

  assert.match(detail.rawDescription, /1 x Flow Water-Based Personal Lubricant/i);
  assert.match(detail.rawDescription, /Designed to bring relaxation and ease/i);
  assert.doesNotMatch(detail.rawDescription, /FREE SHIPPING on order above \$100/i);
});

test('extractDetailFromShopifyProduct preserves USD source amounts', () => {
  const detail = extractDetailFromShopifyProduct({
    title: 'Pulse Duo',
    handle: 'pulse-duo',
    product_type: 'Bundle',
    body_html: '<p>Couples bundle.</p>',
    variants: [{ price: '237.96', compare_at_price: '279.95' }],
    images: [{ src: '//cdn.shopify.com/pulse.jpg' }],
  });

  assert.equal(detail.priceSourceAmount, 237.96);
  assert.equal(detail.originalPriceSourceAmount, 279.95);
  assert.equal(detail.priceCurrency, 'USD');
});

test('crawlCollectionPages falls back to Shopify JSON when HTML is incomplete', async () => {
  const result = await crawlCollectionPages({
    maxItems: 10,
    fetchCollectionHtml: async () => '<html><body><div class="collection__products"></div></body></html>',
    fetchCollectionJsonPage: async (page) =>
      page === 1
        ? {
            products: [
              {
                title: 'Body Duo',
                handle: 'body-duo',
                product_type: 'Bundle',
                body_html: '<p>Connection essentials.</p>',
                tags: [],
                variants: [{ price: '51.00', compare_at_price: '60.00' }],
                images: [{ src: '//cdn.shopify.com/bodyduo.jpg' }],
              },
            ],
          }
        : { products: [] },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, 'Body Duo');
  assert.equal(result[0]?.sourceUrl, 'https://us.lbdo.com/products/body-duo');
});
