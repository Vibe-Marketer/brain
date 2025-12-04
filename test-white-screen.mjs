import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Collect ALL console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      console.log('🔴 BROWSER ERROR:', text);
    }
  });

  // Collect page errors (React crashes)
  const pageErrors = [];
  page.on('pageerror', error => {
    console.log('💥 PAGE CRASH:', error.message);
    console.log('Stack:', error.stack);
    pageErrors.push({
      message: error.message,
      stack: error.stack
    });
  });

  try {
    console.log('🌐 Navigating to http://localhost:8080...');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 15000 });

    console.log('⏳ Waiting 5 seconds for page to fully load...');
    await page.waitForTimeout(5000);

    // Take screenshot before interaction
    await page.screenshot({ path: 'before-click.png', fullPage: true });
    console.log('📸 Screenshot saved: before-click.png');

    // Check what's visible on page
    const pageText = await page.locator('body').textContent();
    console.log('📄 Page contains:', pageText.substring(0, 200) + '...');

    console.log('🔍 Looking for table with transcripts...');
    const tableExists = await page.locator('table').count();
    console.log(`Found ${tableExists} table(s)`);

    if (tableExists > 0) {
      const rowCount = await page.locator('table tbody tr').count();
      console.log(`Found ${rowCount} row(s) in table`);

      if (rowCount > 0) {
        console.log('🔍 Looking for first checkbox...');
        const checkboxes = await page.locator('input[type="checkbox"]').all();
        console.log(`Found ${checkboxes.length} checkbox(es) total`);

        if (checkboxes.length > 1) {
          // First checkbox is usually "select all", second is first row
          const firstRowCheckbox = checkboxes[1];

          console.log('✅ Found first row checkbox, clicking to select transcript...');
          await firstRowCheckbox.click();

          console.log('⏳ Waiting 3 seconds to see if crash occurs...');
          await page.waitForTimeout(3000);

          // Take screenshot after click
          await page.screenshot({ path: 'after-click.png', fullPage: true });
          console.log('📸 Screenshot saved: after-click.png');

          // Check if page is still functional
          const bodyTextAfter = await page.locator('body').textContent();
          if (!bodyTextAfter || bodyTextAfter.trim().length < 100) {
            console.log('💥 WHITE SCREEN DETECTED - page body is nearly empty!');
          } else {
            console.log('✅ Page still has content after selection');
          }
        } else {
          console.log('⚠️  Only found select-all checkbox, no row checkboxes');
        }
      } else {
        console.log('⚠️  Table is empty - no transcript rows to select');
        console.log('💡 This is likely because you need to sync transcripts first');
      }
    } else {
      console.log('⚠️  No table found on page');
    }

    console.log('\n📊 RESULTS:');
    console.log(`Console messages: ${consoleMessages.length}`);
    console.log(`Page errors: ${pageErrors.length}`);

    if (pageErrors.length > 0) {
      console.log('\n🔥 PAGE ERRORS DETECTED:');
      pageErrors.forEach((err, i) => {
        console.log(`\n${i + 1}. ${err.message}`);
        console.log('Stack trace:');
        console.log(err.stack);
      });
    }

    if (consoleMessages.filter(m => m.includes('[error]')).length > 0) {
      console.log('\n🔥 CONSOLE ERRORS:');
      consoleMessages.filter(m => m.includes('[error]')).forEach(msg => {
        console.log(msg);
      });
    }

    if (pageErrors.length === 0 && consoleMessages.filter(m => m.includes('[error]')).length === 0) {
      console.log('✅ NO ERRORS DETECTED');
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
    await page.screenshot({ path: 'error-state.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
