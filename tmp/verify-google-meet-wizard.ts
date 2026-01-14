import { chromium } from 'playwright';

async function verifyGoogleMeetWizard() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Step 1: Navigate to login page...');
    await page.goto('http://localhost:8080/login');
    await page.waitForLoadState('networkidle');

    console.log('Step 2: Log in...');
    await page.fill('input[type="email"]', 'a@vibeos.com');
    await page.fill('input[type="password"]', 'Naegele1');
    await page.click('button[type="submit"]');

    console.log('Step 3: Wait for navigation...');
    await page.waitForURL('**/transcripts**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    console.log('Step 4: Navigate to sync tab...');
    await page.goto('http://localhost:8080/transcripts?tab=sync');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('Step 5: Click Add Integration button...');
    // Look for the Add Integration button
    const addButton = page.getByRole('button', { name: /add integration/i });
    await addButton.waitFor({ state: 'visible', timeout: 5000 });
    await addButton.click();
    await page.waitForTimeout(500);

    console.log('Step 6: Click Google Meet in dropdown...');
    // Click on Google Meet option
    const googleMeetOption = page.getByRole('menuitem', { name: /google meet/i });
    await googleMeetOption.waitFor({ state: 'visible', timeout: 3000 });
    await googleMeetOption.click();
    await page.waitForTimeout(1000);

    console.log('Step 7: Take screenshot of step 1...');
    await page.screenshot({ path: 'tmp/google-meet-wizard-step1.png', fullPage: true });

    // Check step indicators
    const stepIndicators = await page.locator('[data-slot="step"]').count();
    console.log(`Number of steps in wizard: ${stepIndicators}`);

    console.log('Step 8: Click Next button...');
    const nextButton = page.getByRole('button', { name: /next/i });
    await nextButton.waitFor({ state: 'visible', timeout: 3000 });
    await nextButton.click();
    await page.waitForTimeout(1000);

    console.log('Step 9: Take screenshot of step 2 (Review & Connect)...');
    await page.screenshot({ path: 'tmp/google-meet-wizard-step2.png', fullPage: true });

    // Verify step 2 content
    console.log('\n=== VERIFICATION RESULTS ===');

    // Check for "Review & Connect" text
    const reviewConnectText = await page.getByText('Review & Connect').count();
    console.log(`"Review & Connect" text found: ${reviewConnectText > 0 ? 'YES' : 'NO'}`);

    // Check for requirements checkbox
    const checkbox = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkbox.count();
    console.log(`Checkbox found: ${checkboxCount > 0 ? 'YES' : 'NO'}`);

    // Check for Connect button
    const connectButton = page.getByRole('button', { name: /connect with google/i });
    const connectButtonVisible = await connectButton.isVisible().catch(() => false);
    console.log(`Connect button visible: ${connectButtonVisible ? 'YES' : 'NO'}`);

    if (connectButtonVisible) {
      // Check if button is disabled
      const isDisabled = await connectButton.isDisabled();
      console.log(`Connect button disabled (before checkbox): ${isDisabled ? 'YES' : 'NO'}`);

      // Check the checkbox
      if (checkboxCount > 0) {
        console.log('\nStep 10: Checking the checkbox...');
        await checkbox.first().check();
        await page.waitForTimeout(500);

        // Check if button is now enabled
        const isDisabledAfter = await connectButton.isDisabled();
        console.log(`Connect button disabled (after checkbox): ${isDisabledAfter ? 'YES' : 'NO'}`);

        await page.screenshot({ path: 'tmp/google-meet-wizard-step2-checked.png', fullPage: true });
      }
    }

    console.log('\n=== SCREENSHOTS SAVED ===');
    console.log('- tmp/google-meet-wizard-step1.png');
    console.log('- tmp/google-meet-wizard-step2.png');
    console.log('- tmp/google-meet-wizard-step2-checked.png');

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'tmp/google-meet-wizard-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

verifyGoogleMeetWizard();
