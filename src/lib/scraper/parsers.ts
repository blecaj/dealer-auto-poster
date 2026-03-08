import type { Page } from 'playwright-core';
import type { ScrapedVehicleData } from '@/types/vehicle';

interface BasicVehicleInfo {
  url: string;
  title: string;
  price?: string;
  mileage?: string;
  imageUrl?: string;
}

export async function extractVehicleCards(page: Page): Promise<BasicVehicleInfo[]> {
  // Wait for vehicle cards to load
  await page.waitForSelector('a[href*="/vehicles/"]', { timeout: 30000 }).catch(() => null);

  // Try to capture any API responses that contain vehicle data
  const vehicles = await page.evaluate(() => {
    const results: BasicVehicleInfo[] = [];

    // Strategy 1: Look for vehicle card links
    const vehicleLinks = document.querySelectorAll('a[href*="/vehicles/used/"]');
    const seenUrls = new Set<string>();

    vehicleLinks.forEach((link) => {
      const href = (link as HTMLAnchorElement).href;
      // Filter to only individual vehicle pages (URLs with VIN-like patterns)
      if (seenUrls.has(href) || href === window.location.href) return;

      // Look for vehicle detail links (not category pages)
      const el = link as HTMLElement;
      const text = el.textContent || '';

      // Try to extract price from the card
      const priceEl = el.querySelector('[class*="price"], [class*="Price"]');
      const mileageEl = el.querySelector('[class*="mileage"], [class*="odometer"], [class*="km"]');
      const imgEl = el.querySelector('img');

      seenUrls.add(href);
      results.push({
        url: href,
        title: text.trim().substring(0, 200),
        price: priceEl?.textContent?.trim(),
        mileage: mileageEl?.textContent?.trim(),
        imageUrl: imgEl?.src,
      });
    });

    // Strategy 2: Look for structured data in the page
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    scripts.forEach((script) => {
      try {
        const data = JSON.parse(script.textContent || '');
        if (data['@type'] === 'Vehicle' || data['@type'] === 'Car') {
          results.push({
            url: data.url || window.location.href,
            title: data.name || '',
            price: data.offers?.price?.toString(),
          });
        }
      } catch {
        // Ignore parse errors
      }
    });

    return results;
  });

  return vehicles;
}

export async function extractVehicleDetail(page: Page, url: string): Promise<ScrapedVehicleData | null> {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const data = await page.evaluate(() => {
      const getText = (selectors: string[]): string | undefined => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el?.textContent?.trim()) return el.textContent.trim();
        }
        return undefined;
      };

      const getAllText = (el: Element): string => {
        return el.textContent?.trim() || '';
      };

      // Extract vehicle info from the page
      // These selectors target common Convertus Achilles VDP layouts
      const title = getText(['h1', '.vehicle-title', '[class*="vdp-title"]']) || '';

      // Parse title: "2024 Chevrolet Silverado 1500 LT"
      const titleMatch = title.match(/(\d{4})\s+(\w+)\s+(.+)/);
      const year = titleMatch ? parseInt(titleMatch[1]) : 0;
      const make = titleMatch ? titleMatch[2] : '';
      const modelAndTrim = titleMatch ? titleMatch[3] : '';

      // Try to get structured specs
      const specs: Record<string, string> = {};
      const specRows = document.querySelectorAll(
        '[class*="spec"] tr, [class*="detail"] li, [class*="attribute"], dl dt, dl dd'
      );

      // Try dt/dd pairs
      const dts = document.querySelectorAll('dt');
      dts.forEach((dt) => {
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName === 'DD') {
          specs[getAllText(dt).toLowerCase()] = getAllText(dd);
        }
      });

      // Try table rows
      document.querySelectorAll('table tr, [class*="spec"] tr').forEach((row) => {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) {
          specs[getAllText(cells[0]).toLowerCase()] = getAllText(cells[1]);
        }
      });

      // Try labeled elements
      document.querySelectorAll('[class*="label"], [class*="key"]').forEach((label) => {
        const value = label.nextElementSibling;
        if (value) {
          specs[getAllText(label).toLowerCase().replace(':', '')] = getAllText(value);
        }
      });

      // Extract all text content to find specs via regex
      const bodyText = document.body.innerText;

      const findInText = (patterns: RegExp[]): string | undefined => {
        for (const pattern of patterns) {
          const match = bodyText.match(pattern);
          if (match) return match[1].trim();
        }
        return undefined;
      };

      const vin = findInText([
        /VIN[:\s]+([A-HJ-NPR-Z0-9]{17})/i,
        /([A-HJ-NPR-Z0-9]{17})/,
      ]) || specs['vin'] || '';

      const stockNumber = findInText([
        /Stock\s*#?\s*[:\s]+(\S+)/i,
        /Stock\s*Number[:\s]+(\S+)/i,
      ]) || specs['stock'] || specs['stock number'] || specs['stock #'] || '';

      const priceText = getText([
        '[class*="price"]:not([class*="msrp"])',
        '[class*="Price"]:not([class*="msrp"])',
        '.vehicle-price',
      ]);
      const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) : undefined;

      const mileageText = findInText([
        /(?:mileage|odometer|kilometres?|km)[:\s]+([\d,]+)/i,
      ]) || specs['mileage'] || specs['odometer'] || specs['kilometres'];
      const mileage = mileageText ? parseInt(mileageText.replace(/[^0-9]/g, '')) : undefined;

      // Extract images
      const imageUrls: string[] = [];
      const seenImages = new Set<string>();

      // Look for gallery images
      document.querySelectorAll(
        '[class*="gallery"] img, [class*="photo"] img, [class*="media"] img, [class*="carousel"] img, [class*="slider"] img, picture img'
      ).forEach((img) => {
        const src = (img as HTMLImageElement).src || (img as HTMLImageElement).dataset.src || '';
        if (src && !seenImages.has(src) && !src.includes('logo') && !src.includes('placeholder')) {
          seenImages.add(src);
          imageUrls.push(src);
        }
      });

      // Also check for higher-res images in data attributes or srcset
      document.querySelectorAll('img[srcset], img[data-srcset]').forEach((img) => {
        const srcset = (img as HTMLImageElement).srcset || (img as HTMLImageElement).dataset.srcset || '';
        const urls = srcset.split(',').map((s) => s.trim().split(' ')[0]);
        urls.forEach((u) => {
          if (u && !seenImages.has(u) && !u.includes('logo')) {
            seenImages.add(u);
            imageUrls.push(u);
          }
        });
      });

      // If no gallery images found, get all large images
      if (imageUrls.length === 0) {
        document.querySelectorAll('img').forEach((img) => {
          const src = img.src;
          if (
            src &&
            !seenImages.has(src) &&
            !src.includes('logo') &&
            !src.includes('icon') &&
            !src.includes('placeholder') &&
            (img.naturalWidth > 200 || img.width > 200)
          ) {
            seenImages.add(src);
            imageUrls.push(src);
          }
        });
      }

      // Get description
      const description = getText([
        '[class*="description"]',
        '[class*="comment"]',
        '[class*="dealer-notes"]',
      ]);

      return {
        vin,
        year,
        make,
        model: modelAndTrim,
        trim: specs['trim'] || undefined,
        body_style: specs['body style'] || specs['body type'] || specs['body'] || undefined,
        exterior_color: specs['exterior colour'] || specs['exterior color'] || specs['colour'] || undefined,
        interior_color: specs['interior colour'] || specs['interior color'] || undefined,
        transmission: specs['transmission'] || undefined,
        drivetrain: specs['drivetrain'] || specs['drive type'] || undefined,
        engine: specs['engine'] || undefined,
        fuel_type: specs['fuel type'] || specs['fuel'] || undefined,
        mileage,
        price,
        original_url: window.location.href,
        description,
        stock_number: stockNumber,
        image_urls: imageUrls,
      };
    });

    if (!data || !data.vin || !data.year) return null;

    return data as ScrapedVehicleData;
  } catch (error) {
    console.error(`Failed to scrape vehicle detail at ${url}:`, error);
    return null;
  }
}

export async function interceptApiResponses(page: Page): Promise<ScrapedVehicleData[]> {
  const capturedData: ScrapedVehicleData[] = [];

  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    if (contentType.includes('application/json')) {
      try {
        const data = await response.json();
        // Check if response contains vehicle data
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.vin && item.year && item.make) {
              capturedData.push(mapApiResponseToVehicle(item, url));
            }
          }
        } else if (data.results && Array.isArray(data.results)) {
          for (const item of data.results) {
            if (item.vin && item.year && item.make) {
              capturedData.push(mapApiResponseToVehicle(item, url));
            }
          }
        } else if (data.vehicles && Array.isArray(data.vehicles)) {
          for (const item of data.vehicles) {
            if (item.vin && item.year && item.make) {
              capturedData.push(mapApiResponseToVehicle(item, url));
            }
          }
        }
      } catch {
        // Not JSON or parse error
      }
    }
  });

  return capturedData;
}

function mapApiResponseToVehicle(item: Record<string, unknown>, sourceUrl: string): ScrapedVehicleData {
  const imageUrls: string[] = [];

  // Handle various image field formats
  const images = item.images || item.photos || item.media || [];
  if (Array.isArray(images)) {
    for (const img of images) {
      if (typeof img === 'string') {
        imageUrls.push(img);
      } else if (typeof img === 'object' && img !== null) {
        const imgObj = img as Record<string, unknown>;
        const url = imgObj.url || imgObj.src || imgObj.uri || imgObj.large || imgObj.original;
        if (typeof url === 'string') imageUrls.push(url);
      }
    }
  }

  return {
    vin: String(item.vin || ''),
    year: Number(item.year || 0),
    make: String(item.make || ''),
    model: String(item.model || ''),
    trim: item.trim ? String(item.trim) : undefined,
    body_style: item.body_style ? String(item.body_style) : undefined,
    exterior_color: (item.exterior_color || item.exteriorColor) ? String(item.exterior_color || item.exteriorColor) : undefined,
    interior_color: (item.interior_color || item.interiorColor) ? String(item.interior_color || item.interiorColor) : undefined,
    transmission: item.transmission ? String(item.transmission) : undefined,
    drivetrain: item.drivetrain ? String(item.drivetrain) : undefined,
    engine: item.engine ? String(item.engine) : undefined,
    fuel_type: (item.fuel_type || item.fuelType) ? String(item.fuel_type || item.fuelType) : undefined,
    mileage: item.mileage ? Number(item.mileage) : undefined,
    price: item.price ? Number(item.price) : undefined,
    original_url: (item.url || item.vdp_url) ? String(item.url || item.vdp_url) : sourceUrl,
    description: item.description ? String(item.description) : undefined,
    stock_number: (item.stock_number || item.stockNumber) ? String(item.stock_number || item.stockNumber) : undefined,
    image_urls: imageUrls,
    raw_data: item,
  };
}
