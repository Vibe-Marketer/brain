const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5176');
  await page.waitForTimeout(2000);
  const logs = await page.evaluate(() => {
    return localStorage.getItem('debug_messages');
  });
  console.log(logs || "NO LOGS FOUND");
  await browser.close();
})();
