import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractLeloPriceTextFromHtml,
} from './crawler.ts';

test('extractLeloPriceTextFromHtml prefers schema product offer price', () => {
  const html = `
    <script type="application/ld+json" id="schema_product">
      {
        "@context":"https://schema.org/",
        "@type":"Product",
        "name":"GIGI™ 3",
        "offers":{
          "@type":"Offer",
          "priceCurrency":"USD",
          "price":"159.000000"
        }
      }
    </script>
  `;

  assert.equal(extractLeloPriceTextFromHtml(html), 'USD 159.000000');
});

test('extractLeloPriceTextFromHtml falls back to ecommerce payload price', () => {
  const html = `
    <script>
      window.dataLayer = [{
        "event":"view_item",
        "ecommerce":{
          "currency":"USD",
          "items":[{"item_name":"SONA™ 3","price":127.2}]
        }
      }];
    </script>
  `;

  assert.equal(extractLeloPriceTextFromHtml(html), 'USD 127.2');
});
