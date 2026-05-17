import test from 'node:test';
import assert from 'node:assert/strict';
import { extractListItems, shouldKeepArcwaveCandidate } from './crawler.ts';

test('shouldKeepArcwaveCandidate keeps male toys and filters accessories', () => {
  assert.equal(
    shouldKeepArcwaveCandidate({
      name: 'Arcwave Ion Pleasure Air Stroker',
      subtitle: 'Pleasure Air Stroker',
    }),
    true,
  );

  assert.equal(
    shouldKeepArcwaveCandidate({
      name: 'Arcwave Replacement Charging Cable',
      subtitle: 'Accessory',
    }),
    false,
  );

  assert.equal(
    shouldKeepArcwaveCandidate({
      name: 'Arcwave Perk',
      subtitle: '',
      categoryHints: ['Sex Toys for Men'],
    }),
    true,
  );

  assert.equal(
    shouldKeepArcwaveCandidate({
      name: 'Dream Team Set',
      subtitle: '',
      categoryHints: ['Sex Toy Sets'],
    }),
    true,
  );
});

test('extractListItems parses cards inside .product__items.row', () => {
  const items = extractListItems(`
    <ol class="product__items row">
      <a class="product__photo photo"
         href="https://www.arcwave.com/us/ion"
         data-name="Arcwave Ion Pleasure Air Stroker"
         data-price="199"
         data-position="1"
         data-category="Male Toys|Stroker"
         data-dimension10="In stock"
         data-image="https://www.arcwave.com/media/ion.jpg"></a>
      <a class="product__photo photo"
         href="https://www.arcwave.com/us/replacement-charging-cable"
         data-name="Arcwave Replacement Charging Cable"
         data-price="19.99"
         data-position="2"
         data-category="Accessories"
         data-dimension10="In stock"></a>
    </ol>
  `);

  assert.equal(items.length, 1);
  assert.equal(items[0]?.name, 'Arcwave Ion Pleasure Air Stroker');
  assert.equal(items[0]?.priceSourceAmount, 199);
  assert.equal(items[0]?.genderHint, 'male');
});
