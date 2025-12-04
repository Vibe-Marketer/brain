import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true }); // headless for codespace
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect errors
  const errors = [];
  page.on('pageerror', error => {
    console.log('💥 REACT CRASH:', error.message);
    console.log('Stack:', error.stack);
    errors.push({ message: error.message, stack: error.stack });
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('🔴 CONSOLE ERROR:', msg.text());
    }
  });

  try {
    console.log('🌐 Navigating to http://localhost:8080...');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });

    console.log('⏳ Waiting for page load...');
    await page.waitForTimeout(3000);

    // Take initial screenshot
    await page.screenshot({ path: 'step1-initial.png', fullPage: true });
    console.log('📸 step1-initial.png');

    // Look for date picker button (has calendar icon and date text)
    console.log('🔍 Looking for date picker button...');
    const datePickerButton = page.locator('button:has(svg), button:has-text("Pick a date")').first();

    const buttonCount = await page.locator('button:has(svg)').count();
    console.log(`Found ${buttonCount} buttons with icons`);

    if (await datePickerButton.isVisible({ timeout: 5000 })) {
      console.log('✅ Found date picker button');

      await page.screenshot({ path: 'step2-before-click.png', fullPage: true });
      console.log('📸 step2-before-click.png');

      console.log('🖱️  Clicking date picker button...');
      await datePickerButton.click();

      console.log('⏳ Waiting 2 seconds for calendar to open...');
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'step3-after-click.png', fullPage: true });
      console.log('📸 step3-after-click.png');

      // Check if calendar appeared
      const calendarVisible = await page.locator('[role="grid"]').isVisible().catch(() => false);
      if (calendarVisible) {
        console.log('✅ Calendar appeared successfully');
      } else {
        console.log('❌ Calendar did NOT appear - possible crash!');
      }

      // Check for white screen
      const bodyText = await page.locator('body').textContent();
      if (!bodyText || bodyText.trim().length < 50) {
        console.log('💥 WHITE SCREEN DETECTED!');
      }

    } else {
      console.log('❌ Date picker button not found');
    }

    console.log('\n📊 ERRORS:',errors.length);
    if (errors.length > 0) {
      errors.forEach((err, i) => {
        console.log(`\n${i + 1}. ${err.message}`);
        console.log(err.stack);
      });
    } else {
      console.log('✅ No errors detected');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: 'error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
