import test from 'node:test';
import assert from 'node:assert/strict';
import { extractUsdPriceFromLeloHtml } from './backfill-lelo-missing-prices.ts';

test('extractUsdPriceFromLeloHtml prefers schema product offer price', () => {
  const html = `
    <script type="application/ld+json" id="schema_product">
      {
        "@context":"https://schema.org/",
        "@type":"Product",
        "offers":{"@type":"Offer","priceCurrency":"USD","price":"159.000000"}
      }
    </script>
  `;

  assert.equal(extractUsdPriceFromLeloHtml(html), 159);
});

test('extractUsdPriceFromLeloHtml falls back to ecommerce payload price', () => {
  const html = `
    <script>
      window.dataLayer = [{
        "event":"view_item",
        "ecommerce":{"currency":"USD","items":[{"price":127.2}]}
      }];
    </script>
  `;

  assert.equal(extractUsdPriceFromLeloHtml(html), 127.2);
});

test('extractUsdPriceFromLeloHtml returns null when no USD price signal exists', () => {
  assert.equal(extractUsdPriceFromLeloHtml('<html><body>No price here</body></html>'), null);
});
