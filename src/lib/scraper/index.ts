import { createServiceClient } from '@/lib/supabase/server';
import { connectBrowser, createPage, handleInfiniteScroll } from './browser';
import { extractVehicleCards, extractVehicleDetail, interceptApiResponses } from './parsers';
import { downloadAndStoreImages } from './image-downloader';
import { generateTitle, generateDescription } from '@/lib/listing/generator';
import type { ScrapedVehicleData, Vehicle } from '@/types/vehicle';

const TARGET_URL =
  process.env.TARGET_DEALER_URL ||
  'https://www.woodbinegm.com/vehicles/used/?st=make,asc&view=grid&sc=used';

export async function runScrape(runId: string): Promise<{
  found: number;
  new_count: number;
  updated: number;
  removed: number;
}> {
  const supabase = createServiceClient();
  let browser;

  try {
    browser = await connectBrowser();
    const page = await createPage(browser);

    // Set up API interception to try to catch the inventory API
    const apiVehicles = await interceptApiResponses(page);

    // Navigate to listing page
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    let scrapedVehicles: ScrapedVehicleData[] = [];

    // If we caught API data, use it (much more reliable)
    if (apiVehicles.length > 0) {
      console.log(`Captured ${apiVehicles.length} vehicles from API interception`);
      scrapedVehicles = apiVehicles;
    } else {
      // Fall back to DOM scraping
      console.log('No API data captured, falling back to DOM scraping');

      // Handle infinite scroll to load all vehicles
      await handleInfiniteScroll(page);

      // Extract vehicle card links
      const vehicleCards = await extractVehicleCards(page);
      console.log(`Found ${vehicleCards.length} vehicle cards`);

      // Visit each vehicle detail page
      for (const card of vehicleCards) {
        if (!card.url) continue;

        const detail = await extractVehicleDetail(page, card.url);
        if (detail && detail.vin) {
          scrapedVehicles.push(detail);
        }

        // Brief pause between requests to be respectful
        await page.waitForTimeout(1000);
      }
    }

    await browser.close();
    browser = undefined;

    console.log(`Scraped ${scrapedVehicles.length} vehicles total`);

    // Process and upsert vehicles
    const stats = await processScrapedVehicles(supabase, scrapedVehicles, runId);

    // Update scrape run
    await supabase
      .from('scrape_runs')
      .update({
        status: 'completed',
        vehicles_found: stats.found,
        vehicles_new: stats.new_count,
        vehicles_updated: stats.updated,
        vehicles_removed: stats.removed,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return stats;
  } catch (error) {
    if (browser) await browser.close();

    const errorMessage = error instanceof Error ? error.message : String(error);

    await supabase
      .from('scrape_runs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    throw error;
  }
}

async function processScrapedVehicles(
  supabase: ReturnType<typeof createServiceClient>,
  vehicles: ScrapedVehicleData[],
  runId: string
): Promise<{ found: number; new_count: number; updated: number; removed: number }> {
  const now = new Date().toISOString();
  let newCount = 0;
  let updatedCount = 0;

  const scrapedVins = new Set<string>();

  for (const vehicle of vehicles) {
    if (!vehicle.vin) continue;
    scrapedVins.add(vehicle.vin);

    // Check if vehicle already exists
    const { data: existing } = await supabase
      .from('vehicles')
      .select('id, vin, price, status')
      .eq('vin', vehicle.vin)
      .single();

    if (existing) {
      // Update existing vehicle
      await supabase
        .from('vehicles')
        .update({
          last_seen_at: now,
          price: vehicle.price || undefined,
          mileage: vehicle.mileage || undefined,
          description: vehicle.description || undefined,
          original_url: vehicle.original_url,
          raw_data: vehicle.raw_data || null,
        })
        .eq('id', existing.id);

      // Update images if we have new ones
      if (vehicle.image_urls.length > 0) {
        await updateVehicleImages(supabase, existing.id, vehicle.vin, vehicle.image_urls);
      }

      updatedCount++;
    } else {
      // Insert new vehicle
      const vehicleRecord = {
        vin: vehicle.vin,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim || null,
        body_style: vehicle.body_style || null,
        exterior_color: vehicle.exterior_color || null,
        interior_color: vehicle.interior_color || null,
        transmission: vehicle.transmission || null,
        drivetrain: vehicle.drivetrain || null,
        engine: vehicle.engine || null,
        fuel_type: vehicle.fuel_type || null,
        mileage: vehicle.mileage || null,
        price: vehicle.price || null,
        original_url: vehicle.original_url,
        description: vehicle.description || null,
        stock_number: vehicle.stock_number || null,
        status: 'pending' as const,
        first_scraped_at: now,
        last_seen_at: now,
        raw_data: vehicle.raw_data || null,
      };

      const { data: newVehicle, error } = await supabase
        .from('vehicles')
        .insert(vehicleRecord)
        .select('id')
        .single();

      if (error) {
        console.error(`Failed to insert vehicle ${vehicle.vin}:`, error.message);
        continue;
      }

      // Generate listing title and description
      const fullVehicle = { ...vehicleRecord, id: newVehicle.id } as unknown as Vehicle;
      const title = generateTitle(fullVehicle);
      const description = generateDescription(fullVehicle);

      await supabase
        .from('vehicles')
        .update({
          generated_title: title,
          generated_description: description,
        })
        .eq('id', newVehicle.id);

      // Download and store images
      if (vehicle.image_urls.length > 0) {
        await updateVehicleImages(supabase, newVehicle.id, vehicle.vin, vehicle.image_urls);
      }

      newCount++;
    }
  }

  // Mark vehicles not seen in this scrape as potentially removed
  const { data: allActive } = await supabase
    .from('vehicles')
    .select('id, vin')
    .in('status', ['pending', 'posted']);

  let removedCount = 0;
  if (allActive) {
    for (const v of allActive) {
      if (!scrapedVins.has(v.vin)) {
        await supabase
          .from('vehicles')
          .update({ status: 'removed', removed_at: now })
          .eq('id', v.id);
        removedCount++;
      }
    }
  }

  return {
    found: vehicles.length,
    new_count: newCount,
    updated: updatedCount,
    removed: removedCount,
  };
}

async function updateVehicleImages(
  supabase: ReturnType<typeof createServiceClient>,
  vehicleId: string,
  vin: string,
  imageUrls: string[]
): Promise<void> {
  // Download images and upload to Supabase Storage
  const stored = await downloadAndStoreImages(vehicleId, vin, imageUrls);

  // Remove old images for this vehicle
  await supabase.from('vehicle_images').delete().eq('vehicle_id', vehicleId);

  // Insert new image records
  const imageRecords = imageUrls.map((url, i) => {
    const storedImage = stored.find((s) => s.position === i);
    return {
      vehicle_id: vehicleId,
      original_url: url,
      storage_path: storedImage?.storage_path || null,
      storage_url: storedImage?.storage_url || null,
      position: i,
      is_primary: i === 0,
      downloaded: !!storedImage,
    };
  });

  if (imageRecords.length > 0) {
    await supabase.from('vehicle_images').insert(imageRecords);
  }
}
