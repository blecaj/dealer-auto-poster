import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createImageZip } from '@/lib/marketplace/export';
import { fetchGalleryImages } from '@/lib/scraper/gallery';
import { downloadAndStoreImages } from '@/lib/scraper/image-downloader';
import type { Vehicle, VehicleImage } from '@/types/vehicle';

export const maxDuration = 120;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();

    if (vehicleError || !vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    let { data: images } = await supabase
      .from('vehicle_images')
      .select('*')
      .eq('vehicle_id', id)
      .order('position', { ascending: true });

    // If we only have 0-1 images, try to fetch gallery via Browserless
    if (!images || images.length <= 1) {
      try {
        const galleryUrls = await fetchGalleryImages(vehicle.original_url);
        if (galleryUrls.length > 1) {
          // Download and store the new images
          const stored = await downloadAndStoreImages(id, vehicle.vin, galleryUrls);

          // Clear old images and insert new ones
          await supabase.from('vehicle_images').delete().eq('vehicle_id', id);
          const imageRecords = galleryUrls.map((url, i) => {
            const storedImage = stored.find((s) => s.position === i);
            return {
              vehicle_id: id,
              original_url: url,
              storage_path: storedImage?.storage_path || null,
              storage_url: storedImage?.storage_url || null,
              position: i,
              is_primary: i === 0,
              downloaded: !!storedImage,
            };
          });
          await supabase.from('vehicle_images').insert(imageRecords);

          // Re-fetch updated images
          const { data: updatedImages } = await supabase
            .from('vehicle_images')
            .select('*')
            .eq('vehicle_id', id)
            .order('position', { ascending: true });
          images = updatedImages;
        }
      } catch (error) {
        console.error('Gallery fetch failed, using existing images:', error);
      }
    }

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'No images found' }, { status: 404 });
    }

    const zipBuffer = await createImageZip(
      vehicle as unknown as Vehicle,
      images as unknown as VehicleImage[]
    );

    const filename = `${vehicle.year}_${vehicle.make}_${vehicle.model}_photos.zip`.replace(
      /\s+/g,
      '_'
    );

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Image ZIP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
