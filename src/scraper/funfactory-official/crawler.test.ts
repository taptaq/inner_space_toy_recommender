import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanFunFactoryProductName,
  crawlCollectionPages,
  extractDetailTextFromHtmlBySelectors,
  extractPaginationUrls,
  extractDetailFromHtml,
  extractDetailFromShopifyProduct,
  extractListItemsFromHtml,
  extractListItemsFromShopifyJson,
  normalizeProductUrl,
  normalizeShopifyMoneyValue,
  sanitizeFunFactoryDetailText,
  shouldKeepFunFactoryCandidate,
} from './crawler.ts';

test('cleanFunFactoryProductName strips FUN FACTORY marketing suffixes', () => {
  assert.equal(
    cleanFunFactoryProductName('Auflegevibrator LAYA III online kaufen ❤️ | FUN FACTORY'),
    'Auflegevibrator LAYA III',
  );
  assert.equal(
    cleanFunFactoryProductName('Rabbitvibrator AMORINO ❤️ | FUN FACTORY'),
    'Rabbitvibrator AMORINO',
  );
  assert.equal(
    cleanFunFactoryProductName('DARLING DEVIL von FUN FACTORY | Rabbit Vibrator'),
    'DARLING DEVIL | Rabbit Vibrator',
  );
});

test('normalizeProductUrl normalizes collection product links', () => {
  assert.equal(
    normalizeProductUrl('/products/bootie-fem'),
    'https://www.funfactory.com/products/bootie-fem',
  );
  assert.equal(
    normalizeProductUrl('https://www.funfactory.com/products/bootie-fem?variant=123'),
    'https://www.funfactory.com/products/bootie-fem',
  );
});

test('shouldKeepFunFactoryCandidate keeps sex toy products and filters gift-card-like rows', () => {
  assert.equal(
    shouldKeepFunFactoryCandidate({
      name: 'BOOTIE FEM',
      subtitle: 'Anal toy with ergonomic shape',
      rawDescription: 'Body-safe silicone toy',
    }),
    true,
  );

  assert.equal(
    shouldKeepFunFactoryCandidate({
      name: 'Gift Card',
      subtitle: 'Accessories',
      rawDescription: 'Digital card',
    }),
    false,
  );
});

test('extractListItemsFromHtml parses product cards inside #product-grid', () => {
  const result = extractListItemsFromHtml(`
    <div id="product-grid">
      <div class="card-wrapper">
        <a href="/products/bootie-fem">
          <img src="//cdn.funfactory.com/bootie.jpg" alt="BOOTIE FEM" />
          <h3>BOOTIE FEM</h3>
        </a>
        <div class="card-information">
          <p>Anal toy with ergonomic shape</p>
          <span class="price">€59.90</span>
        </div>
      </div>
      <div class="card-wrapper">
        <a href="/products/gift-card">
          <img src="//cdn.funfactory.com/gift.jpg" alt="Gift Card" />
          <h3>Gift Card</h3>
        </a>
        <div class="card-information">
          <p>Accessories</p>
          <span class="price">€20.00</span>
        </div>
      </div>
    </div>
  `);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://www.funfactory.com/products/bootie-fem',
    name: 'BOOTIE FEM',
    subtitle: 'Anal toy with ergonomic shape',
    coverImage: 'https://cdn.funfactory.com/bootie.jpg',
    priceSourceAmount: 59.9,
    originalPriceSourceAmount: null,
    priceCurrency: 'EUR',
    categoryHints: [],
    genderHint: 'unisex',
    listPosition: 1,
  });
});

test('extractDetailFromHtml only collects the requested detail zones', () => {
  const detail = extractDetailFromHtml(
    `
      <html>
        <head>
          <title>BOOTIE FEM</title>
          <meta name="description" content="Slim anal toy by Fun Factory" />
        </head>
        <body>
          <div class="product__info-container">
            <h1>BOOTIE FEM</h1>
            <div class="price">€59.90</div>
            <p>Body-safe silicone anal toy.</p>
          </div>
          <div class="image-with-text__grid">
            <p>Ergonomic curve for comfortable insertion.</p>
          </div>
          <div class="product-description">
            <p>Deep body-safe stimulation for solo or partner play.</p>
          </div>
          <div class="multicolumn-card__info">
            <p>Rechargeable and discreet design.</p>
          </div>
          <ul>
            <li class="icon-list-item">Medical-grade silicone</li>
            <li class="icon-list-item">Waterproof</li>
          </ul>
          <footer>
            <p>Shipping and returns</p>
          </footer>
        </body>
      </html>
    `,
    'https://www.funfactory.com/products/bootie-fem',
  );

  assert.equal(detail.title, 'BOOTIE FEM');
  assert.equal(detail.priceSourceAmount, 59.9);
  assert.equal(detail.priceCurrency, 'EUR');
  assert.match(detail.rawDescription, /Body-safe silicone anal toy\./);
  assert.match(detail.rawDescription, /Ergonomic curve for comfortable insertion\./);
  assert.match(detail.rawDescription, /Deep body-safe stimulation for solo or partner play\./);
  assert.match(detail.rawDescription, /Rechargeable and discreet design\./);
  assert.match(detail.rawDescription, /Medical-grade silicone/);
  assert.doesNotMatch(detail.rawDescription, /Shipping and returns/);
});

test('extractDetailTextFromHtmlBySelectors collects nested detail blocks more reliably', () => {
  const text = extractDetailTextFromHtmlBySelectors(`
    <div class="product-description">
      <div>
        <p>Primary feature copy</p>
        <div class="multicolumn-card__info">
          <p>Secondary feature copy</p>
        </div>
      </div>
    </div>
  `);

  assert.match(text, /Primary feature copy/);
  assert.match(text, /Secondary feature copy/);
});

test('extractDetailTextFromHtmlBySelectors also reads product__description blocks', () => {
  const text = extractDetailTextFromHtmlBySelectors(`
    <div class="product__description rte quick-add-hidden">
      <h2>VERWÖHNT DICH AUF GANZER LINIE</h2>
      <ul>
        <li>Ergonomischer Auflegevibrator zur sinnlichen Klitorisstimulation</li>
        <li>Wasserdicht (IPX7) & wiederaufladbar (USB-C)</li>
      </ul>
    </div>
  `);

  assert.match(text, /VERWÖHNT DICH AUF GANZER LINIE/);
  assert.match(text, /Ergonomischer Auflegevibrator/);
  assert.match(text, /Wasserdicht/);
});

test('sanitizeFunFactoryDetailText removes quantity and checkout noise', () => {
  const text = sanitizeFunFactoryDetailText(`
    _collection:vibratoren
    Menge
    Verringere die Menge für LAYA III
    In den Warenkorb legen
    Verfügbarkeit für Abholungen konnte nicht geladen werden
    Wasserdicht (IPX7)
    Klitoris
    class="product__info-container"
  `);

  assert.doesNotMatch(text, /Menge/);
  assert.doesNotMatch(text, /In den Warenkorb/);
  assert.doesNotMatch(text, /class=/);
  assert.match(text, /Wasserdicht/);
  assert.match(text, /Klitoris/);
});

test('extractPaginationUrls collects unique collection page links from .pagination', () => {
  const urls = extractPaginationUrls(`
    <nav class="pagination">
      <a href="/collections/alle-sextoys?page=1">1</a>
      <a href="/collections/alle-sextoys?page=2">2</a>
      <a href="/collections/alle-sextoys?page=3">3</a>
      <a href="/collections/alle-sextoys?page=2">2 again</a>
    </nav>
  `);

  assert.deepEqual(urls, [
    'https://www.funfactory.com/collections/alle-sextoys?page=1',
    'https://www.funfactory.com/collections/alle-sextoys?page=2',
    'https://www.funfactory.com/collections/alle-sextoys?page=3',
  ]);
});

test('extractListItemsFromShopifyJson parses Shopify collection payload', () => {
  const result = extractListItemsFromShopifyJson({
    products: [
      {
        title: 'BOOTIE',
        handle: 'bootie',
        product_type: 'Analplug',
        body_html: '<p>100% silicone anal toy</p>',
        tags: ['Buttplug', 'Anal'],
        variants: [{ price: '11.95', compare_at_price: '0.00' }],
        images: [{ src: '//cdn.funfactory.com/bootie.jpg' }],
      },
      {
        title: 'Gift Card',
        handle: 'gift-card',
        product_type: 'Accessories',
        body_html: '<p>Digital card</p>',
        variants: [{ price: '20.00', compare_at_price: null }],
        images: [{ src: '//cdn.funfactory.com/gift.jpg' }],
      },
    ],
  });

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://www.funfactory.com/products/bootie',
    name: 'BOOTIE',
    subtitle: 'Analplug',
    coverImage: 'https://cdn.funfactory.com/bootie.jpg',
    priceSourceAmount: 11.95,
    originalPriceSourceAmount: null,
    priceCurrency: 'EUR',
    categoryHints: ['Analplug', 'Buttplug', 'Anal'],
    genderHint: 'unisex',
    listPosition: 1,
  });
});

test('extractListItemsFromShopifyJson normalizes cent-based numeric prices', () => {
  const result = extractListItemsFromShopifyJson({
    products: [
      {
        title: 'LAYA III',
        handle: 'laya-iii',
        product_type: 'Auflegevibrator',
        body_html: '<p>air pulse vibrator</p>',
        tags: ['Vibrator'],
        variants: [{ price: 3295, compare_at_price: 4295 }],
        images: [{ src: '//cdn.funfactory.com/laya.jpg' }],
      },
    ],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.priceSourceAmount, 32.95);
  assert.equal(result[0]?.originalPriceSourceAmount, 42.95);
});

test('extractDetailFromShopifyProduct keeps canonical title and decimal EUR price', () => {
  const detail = extractDetailFromShopifyProduct({
    title: 'Auflegevibrator LAYA III online kaufen ❤️ | FUN FACTORY',
    handle: 'laya-iii',
    product_type: 'Auflegevibrator',
    body_html: '<h2>VERWÖHNT DICH AUF GANZER LINIE</h2><ul><li>Wasserdicht (IPX7)</li></ul>',
    tags: ['_collection:vibratoren', '_label_BESTSELLER', 'Klitoral'],
    variants: [{ price: '32.95', compare_at_price: '0.00' }],
    images: [{ src: '//cdn.funfactory.com/laya.jpg' }],
  });

  assert.equal(detail.title, 'Auflegevibrator LAYA III');
  assert.equal(detail.subtitle, 'Auflegevibrator');
  assert.equal(detail.priceSourceAmount, 32.95);
  assert.equal(detail.originalPriceSourceAmount, null);
  assert.equal(detail.priceCurrency, 'EUR');
  assert.match(detail.rawDescription, /VERWÖHNT DICH AUF GANZER LINIE/);
  assert.doesNotMatch(detail.rawDescription, /_collection:/);
  assert.doesNotMatch(detail.rawDescription, /_label_/);
});

test('normalizeShopifyMoneyValue converts cent-based integers into decimal prices', () => {
  assert.equal(normalizeShopifyMoneyValue(4295), 42.95);
  assert.equal(normalizeShopifyMoneyValue('6995'), 69.95);
  assert.equal(normalizeShopifyMoneyValue('32.95'), 32.95);
  assert.equal(normalizeShopifyMoneyValue('0.00'), 0);
  assert.equal(normalizeShopifyMoneyValue(null), null);
});

test('crawlCollectionPages falls back to Shopify JSON when DOM cards are missing', async () => {
  const result = await crawlCollectionPages({
    maxItems: 10,
    fetchCollectionHtml: async () => '<html><body><div id="product-grid"></div></body></html>',
    fetchCollectionJsonPage: async (page) =>
      page === 1
        ? {
            products: [
              {
                title: 'MANTA',
                handle: 'manta',
                product_type: 'Premium Penisvibrator',
                body_html: '<p>Powerful vibration</p>',
                tags: ['Vibrierend', 'Men toy'],
                variants: [{ price: '48.95', compare_at_price: null }],
                images: [{ src: '//cdn.funfactory.com/manta.jpg' }],
              },
            ],
          }
        : { products: [] },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, 'MANTA');
  assert.equal(result[0]?.sourceUrl, 'https://www.funfactory.com/products/manta');
});

test('crawlCollectionPages follows .pagination HTML pages in addition to JSON', async () => {
  const result = await crawlCollectionPages({
    maxItems: 10,
    fetchCollectionHtml: async (url) => {
      if (String(url).includes('page=2')) {
        return `
          <div id="product-grid">
            <div class="card-wrapper">
              <a href="/products/bootie">
                <img src="//cdn.funfactory.com/bootie.jpg" alt="BOOTIE" />
                <h3>BOOTIE</h3>
              </a>
              <div class="card-information">
                <p>Analplug</p>
                <span class="price">€11.95</span>
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div id="product-grid"></div>
        <nav class="pagination">
          <a href="/collections/alle-sextoys?page=2">2</a>
        </nav>
      `;
    },
    fetchCollectionJsonPage: async () => ({ products: [] }),
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, 'BOOTIE');
  assert.equal(result[0]?.sourceUrl, 'https://www.funfactory.com/products/bootie');
});
