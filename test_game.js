const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page1 = await browser.newPage();
  const page2 = await browser.newPage();

  page1.on('console', msg => console.log('PAGE 1 LOG:', msg.text()));
  page2.on('console', msg => console.log('PAGE 2 LOG:', msg.text()));

  await page1.goto('http://localhost:4200');

  // Actually we need to start the app first
  await browser.close();
})();
