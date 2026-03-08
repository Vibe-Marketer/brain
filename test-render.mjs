import puppeteer from 'puppeteer';
const browser = await puppeteer.launch();
const page = await browser.newPage();

page.on('console', msg => console.log('PAGE LOG:', msg.text()));
page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

await page.goto('http://localhost:3003', { waitUntil: 'networkidle0' });
console.log('DOM CONTENT:', await page.$eval('#root', el => el.innerHTML));
await browser.close();
