import { chromium, type Browser, type Page } from 'playwright-core';

export async function connectBrowser(): Promise<Browser> {
  const wsUrl = process.env.BROWSERLESS_WS_URL;

  if (!wsUrl) {
    throw new Error('BROWSERLESS_WS_URL environment variable is not set');
  }

  const browser = await chromium.connect(wsUrl);
  return browser;
}

export async function createPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();
  return page;
}

export async function handleInfiniteScroll(page: Page, maxScrolls: number = 50): Promise<void> {
  let previousHeight = 0;
  let scrollCount = 0;

  while (scrollCount < maxScrolls) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);

    if (currentHeight === previousHeight) {
      // Try one more scroll with a longer wait to be sure
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(3000);
      const finalHeight = await page.evaluate(() => document.body.scrollHeight);
      if (finalHeight === currentHeight) break;
    }

    previousHeight = currentHeight;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    scrollCount++;
  }
}
