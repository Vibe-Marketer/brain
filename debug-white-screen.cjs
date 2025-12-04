// Quick debug script to reproduce white screen issue
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Collect console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('❌ BROWSER ERROR:', msg.text());
    }
  });

  // Collect page errors
  page.on('pageerror', error => {
    console.log('❌ PAGE ERROR:', error.message);
    errors.push(error.message);
  });

  try {
    console.log('🌐 Navigating to http://localhost:8080...');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });

    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(2000);

    console.log('🔍 Looking for transcripts tab...');
    const transcriptsTab = await page.locator('text=Transcripts').first();
    if (await transcriptsTab.isVisible()) {
      console.log('✅ Found transcripts tab, clicking...');
      await transcriptsTab.click();
      await page.waitForTimeout(1000);
    }

    console.log('🔍 Looking for transcript rows in table...');
    const firstRow = await page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      console.log('✅ Found transcript row, clicking to select...');
      await firstRow.click();
      await page.waitForTimeout(2000);

      console.log('📸 Taking screenshot after click...');
      await page.screenshot({ path: 'debug-after-select.png', fullPage: true });
    } else {
      console.log('⚠️  No transcript rows found in table');
    }

    console.log('\n📊 Summary:');
    console.log(`Total errors: ${errors.length}`);
    if (errors.length > 0) {
      console.log('\n🔥 ERRORS FOUND:');
      errors.forEach((err, i) => console.log(`${i + 1}. ${err}`));
    } else {
      console.log('✅ No errors detected');
    }

  } catch (error) {
    console.error('❌ Script error:', error.message);
  } finally {
    await browser.close();
  }
})();
