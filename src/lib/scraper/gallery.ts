import { chromium } from 'playwright-core';

/**
 * Fetch all gallery images for a vehicle using Browserless.io.
 * This is used on-demand when a user wants to download images for a specific vehicle.
 * Falls back to the primary image if Browserless is unavailable.
 */
export async function fetchGalleryImages(vehicleUrl: string): Promise<string[]> {
  const wsUrl = process.env.BROWSERLESS_WS_URL;

  if (!wsUrl) {
    console.warn('BROWSERLESS_WS_URL not set, cannot fetch gallery images');
    return [];
  }

  let browser;
  try {
    browser = await chromium.connect(wsUrl);
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    await page.goto(vehicleUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Extract all vehicle images from the rendered page
    const images = await page.evaluate(() => {
      const imageUrls: string[] = [];
      const seen = new Set<string>();

      // Look for gallery/carousel/slider images
      const selectors = [
        '[class*="gallery"] img',
        '[class*="photo"] img',
        '[class*="media"] img',
        '[class*="carousel"] img',
        '[class*="slider"] img',
        '[class*="swiper"] img',
        '[class*="lightbox"] img',
        'picture img',
        '[data-src]',
      ];

      for (const selector of selectors) {
        document.querySelectorAll(selector).forEach((el) => {
          const img = el as HTMLImageElement;
          const src = img.src || img.dataset.src || img.dataset.lazySrc || '';
          if (
            src &&
            !seen.has(src) &&
            !src.includes('logo') &&
            !src.includes('icon') &&
            !src.includes('placeholder') &&
            !src.includes('wp-content/themes')
          ) {
            seen.add(src);
            imageUrls.push(src);
          }
        });
      }

      // Also grab srcset high-res images
      document.querySelectorAll('img[srcset]').forEach((img) => {
        const srcset = (img as HTMLImageElement).srcset;
        const urls = srcset.split(',').map((s) => s.trim().split(' ')[0]);
        for (const u of urls) {
          if (u && !seen.has(u) && !u.includes('logo') && !u.includes('icon')) {
            seen.add(u);
            imageUrls.push(u);
          }
        }
      });

      // If still no images, get all reasonably-sized images
      if (imageUrls.length === 0) {
        document.querySelectorAll('img').forEach((img) => {
          const src = img.src;
          if (
            src &&
            !seen.has(src) &&
            !src.includes('logo') &&
            !src.includes('icon') &&
            !src.includes('placeholder') &&
            !src.includes('wp-content/themes') &&
            (img.naturalWidth > 200 || img.width > 200 || src.includes('autotradercdn'))
          ) {
            seen.add(src);
            imageUrls.push(src);
          }
        });
      }

      return imageUrls;
    });

    await browser.close();
    return images;
  } catch (error) {
    if (browser) await browser.close();
    console.error('Failed to fetch gallery images:', error);
    return [];
  }
}
