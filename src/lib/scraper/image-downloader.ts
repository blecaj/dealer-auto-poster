import { createServiceClient } from '@/lib/supabase/server';

const BUCKET_NAME = 'vehicle-images';

export async function downloadAndStoreImages(
  vehicleId: string,
  vin: string,
  imageUrls: string[]
): Promise<{ storage_path: string; storage_url: string; position: number }[]> {
  const supabase = createServiceClient();
  const results: { storage_path: string; storage_url: string; position: number }[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const imageUrl = imageUrls[i];
      const response = await fetch(imageUrl);

      if (!response.ok) continue;

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      const storagePath = `${vin}/${String(i + 1).padStart(3, '0')}.${extension}`;

      const buffer = await response.arrayBuffer();

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        console.error(`Failed to upload image ${i} for ${vin}:`, error.message);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);

      results.push({
        storage_path: storagePath,
        storage_url: urlData.publicUrl,
        position: i,
      });
    } catch (error) {
      console.error(`Failed to download image ${i} for ${vin}:`, error);
    }
  }

  return results;
}
