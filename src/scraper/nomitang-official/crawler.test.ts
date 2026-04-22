import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import * as crawler from './crawler.ts';

test('detail extraction script executes inside the page context', async () => {
  const buildDetailExtractionScript = (crawler as Record<string, unknown>).buildDetailExtractionScript;
  assert.equal(typeof buildDetailExtractionScript, 'function');

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(`
      <html>
        <head>
          <title>USB Charging Cable</title>
          <meta name="description" content="Rechargeable accessory for compatible products" />
          <meta property="og:description" content="Rechargeable accessory for compatible products" />
          <meta property="og:image" content="https://www.nomitang.com/images/cable-main.jpg" />
        </head>
        <body>
          <h1>USB Charging Cable</h1>
          <div class="product-detail-price">$9.99</div>
          <div class="product-detail-ordernumber">NT-AC-001</div>
          <div class="product-detail-description">
            Rechargeable accessory for compatible products. Quiet charging and reliable waterproof sealing for travel.
          </div>
          <img src="https://www.nomitang.com/images/cable-main.jpg" />
          <img src="https://www.nomitang.com/images/cable-side.jpg" />
        </body>
      </html>
    `);

    const detail = (await page.evaluate((buildDetailExtractionScript as () => string)())) as {
      title: string;
      productCode: string;
      coverImage: string;
      priceUsd: number | null;
    };
    assert.equal(detail.title, 'USB Charging Cable');
    assert.equal(detail.productCode, 'NT-AC-001');
    assert.equal(detail.coverImage, 'https://www.nomitang.com/images/cable-main.jpg');
    assert.equal(detail.priceUsd, 9.99);
  } finally {
    await browser.close();
  }
});
