import type { ScrapedVehicleData } from '@/types/vehicle';

/**
 * Fetch the used vehicle sitemap and extract all individual vehicle URLs.
 */
export async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const response = await fetch(sitemapUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status}`);
  }

  const xml = await response.text();
  const urls: string[] = [];

  // Parse <loc> tags from sitemap XML
  const locRegex = /<loc>(.*?)<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1].trim();
    // Only include individual vehicle pages (with sale_class=used), skip the listing page
    if (url.includes('sale_class=used') && url !== sitemapUrl) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * Fetch a single vehicle detail page (VDP) and extract data from JSON-LD + HTML.
 * No browser needed — uses plain fetch() + regex parsing.
 */
export async function fetchVehiclePage(url: string): Promise<ScrapedVehicleData | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Extract JSON-LD structured data
    const jsonLd = extractJsonLd(html);
    if (!jsonLd || !jsonLd.vehicleIdentificationNumber) {
      console.warn(`No JSON-LD vehicle data found at ${url}`);
      return null;
    }

    // Parse year/make/model from URL pattern:
    // /vehicles/2024/bmw/m2/etobicoke/on/69240256/
    const urlMatch = url.match(/\/vehicles\/(\d{4})\/([^/]+)\/([^/]+)\//);
    const urlYear = urlMatch ? parseInt(urlMatch[1]) : 0;
    const urlMake = urlMatch ? decodeURIComponent(urlMatch[2]).replace(/-/g, ' ') : '';
    const urlModel = urlMatch ? decodeURIComponent(urlMatch[3]).replace(/-/g, ' ') : '';

    // Extract from JSON-LD, with URL fallbacks
    const year = parseInt(jsonLd.vehicleModelDate) || urlYear;
    const make = capitalize(jsonLd.brand?.name || urlMake);
    const model = jsonLd.model || capitalize(urlModel);
    const name = jsonLd.name || `${year} ${make} ${model}`;

    // Try to extract trim from the name (after year make model)
    const trimMatch = name.match(new RegExp(`${year}\\s+${make}\\s+${model}\\s+(.+)`, 'i'));
    const trim = trimMatch ? trimMatch[1].trim() : undefined;

    // Get price
    const price = jsonLd.offers?.price ? parseFloat(jsonLd.offers.price) : undefined;

    // Get mileage
    const mileage = jsonLd.mileageFromOdometer?.value
      ? parseInt(jsonLd.mileageFromOdometer.value)
      : undefined;

    // Images: get from JSON-LD + meta tags
    const imageUrls = extractAllImages(html, jsonLd);

    // Try to extract additional specs from HTML via regex
    const specs = extractSpecsFromHtml(html);

    const vehicle: ScrapedVehicleData = {
      vin: jsonLd.vehicleIdentificationNumber,
      year,
      make,
      model,
      trim,
      body_style: jsonLd.bodyType || specs.body_style,
      exterior_color: jsonLd.color || specs.exterior_color,
      interior_color: specs.interior_color,
      transmission: jsonLd.vehicleTransmission || specs.transmission,
      drivetrain: jsonLd.driveWheelConfiguration || specs.drivetrain,
      engine: jsonLd.vehicleEngine?.description || specs.engine,
      fuel_type: jsonLd.fuelType || specs.fuel_type,
      mileage,
      price,
      original_url: url,
      description: jsonLd.description || specs.description,
      stock_number: specs.stock_number,
      image_urls: imageUrls,
      raw_data: jsonLd,
    };

    return vehicle;
  } catch (error) {
    console.error(`Failed to scrape vehicle at ${url}:`, error);
    return null;
  }
}

/**
 * Extract JSON-LD data of type "Vehicle" from HTML.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJsonLd(html: string): Record<string, any> | null {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);

      // Could be a single object or an array
      if (data['@type'] === 'Vehicle' || data['@type'] === 'Car') {
        return data;
      }

      // Check @graph array
      if (data['@graph'] && Array.isArray(data['@graph'])) {
        for (const item of data['@graph']) {
          if (item['@type'] === 'Vehicle' || item['@type'] === 'Car') {
            return item;
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return null;
}

/**
 * Extract all image URLs from the page (JSON-LD + og:image + meta tags).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAllImages(html: string, jsonLd: Record<string, any>): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  const addImage = (url: string) => {
    if (url && !seen.has(url) && !url.includes('logo') && !url.includes('placeholder')) {
      seen.add(url);
      images.push(url);
    }
  };

  // From JSON-LD
  if (jsonLd.image) {
    if (typeof jsonLd.image === 'string') {
      addImage(jsonLd.image);
    } else if (Array.isArray(jsonLd.image)) {
      jsonLd.image.forEach((img: string | { url?: string }) => {
        if (typeof img === 'string') addImage(img);
        else if (img.url) addImage(img.url);
      });
    }
  }

  // From og:image meta tag
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogImageMatch) addImage(ogImageMatch[1]);

  // From twitter:image meta tag
  const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
  if (twitterImageMatch) addImage(twitterImageMatch[1]);

  // Look for autotradercdn image URLs anywhere in the HTML
  const cdnRegex = /https?:\/\/[^"'\s]*autotradercdn\.ca\/photos\/[^"'\s]+/g;
  let cdnMatch;
  while ((cdnMatch = cdnRegex.exec(html)) !== null) {
    addImage(cdnMatch[0]);
  }

  // Look for cdn-convertus image URLs
  const convertusRegex = /https?:\/\/[^"'\s]*cdn-convertus\.com\/uploads\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi;
  let convertusMatch;
  while ((convertusMatch = convertusRegex.exec(html)) !== null) {
    addImage(convertusMatch[0]);
  }

  return images;
}

/**
 * Try to extract vehicle specs from raw HTML using regex patterns.
 */
function extractSpecsFromHtml(html: string): Record<string, string | undefined> {
  const find = (patterns: RegExp[]): string | undefined => {
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) return match[1].trim();
    }
    return undefined;
  };

  return {
    stock_number: find([
      /Stock\s*(?:#|Number|No\.?)\s*[:]\s*([A-Za-z0-9-]+)/i,
      /data-stock[^"]*"([^"]+)"/i,
    ]),
    exterior_color: find([
      /Exterior\s*(?:Colour|Color)\s*[:]\s*([^<\n]+)/i,
    ]),
    interior_color: find([
      /Interior\s*(?:Colour|Color)\s*[:]\s*([^<\n]+)/i,
    ]),
    transmission: find([
      /Transmission\s*[:]\s*([^<\n]+)/i,
    ]),
    drivetrain: find([
      /Drivetrain\s*[:]\s*([^<\n]+)/i,
      /Drive\s*Type\s*[:]\s*([^<\n]+)/i,
    ]),
    engine: find([
      /Engine\s*[:]\s*([^<\n]+)/i,
    ]),
    fuel_type: find([
      /Fuel\s*(?:Type)?\s*[:]\s*([^<\n]+)/i,
    ]),
    body_style: find([
      /Body\s*(?:Style|Type)\s*[:]\s*([^<\n]+)/i,
    ]),
    description: find([
      /class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\//i,
      /class="[^"]*dealer-notes[^"]*"[^>]*>([\s\S]*?)<\//i,
    ]),
  };
}

function capitalize(str: string): string {
  return str
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
