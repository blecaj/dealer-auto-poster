import { createServiceClient } from '@/lib/supabase/server';
import { fetchSitemapUrls, fetchVehiclePage } from './parsers';
import { downloadAndStoreImages } from './image-downloader';
import { generateTitle, generateDescription } from '@/lib/listing/generator';
import type { ScrapedVehicleData, Vehicle } from '@/types/vehicle';

const SITEMAP_URL = 'https://www.woodbinegm.com/used-vehicle-1-sitemap.xml';

export async function runScrape(runId: string): Promise<{
  found: number;
  new_count: number;
  updated: number;
  removed: number;
}> {
  const supabase = createServiceClient();

  try {
    // Step 1: Fetch vehicle URLs from sitemap (instant, no browser)
    console.log('Fetching vehicle URLs from sitemap...');
    const vehicleUrls = await fetchSitemapUrls(SITEMAP_URL);
    console.log(`Found ${vehicleUrls.length} vehicle URLs in sitemap`);

    // Step 2: Fetch each VDP page and parse JSON-LD structured data
    const scrapedVehicles: ScrapedVehicleData[] = [];

    for (const url of vehicleUrls) {
      try {
        const vehicle = await fetchVehiclePage(url);
        if (vehicle && vehicle.vin) {
          scrapedVehicles.push(vehicle);
        }
      } catch (error) {
        console.error(`Failed to scrape ${url}:`, error);
      }

      // Brief pause to be respectful to the server
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`Scraped ${scrapedVehicles.length} vehicles total`);

    // Step 3: Process and upsert vehicles
    const stats = await processScrapedVehicles(supabase, scrapedVehicles);

    // Step 4: Update scrape run record
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
  vehicles: ScrapedVehicleData[]
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
