import JSZip from 'jszip';
import type { Vehicle, VehicleImage } from '@/types/vehicle';
import { getDisplayTitle, getDisplayDescription } from '@/lib/listing/generator';

export function formatListingForClipboard(vehicle: Vehicle): {
  title: string;
  description: string;
  fullText: string;
} {
  const title = getDisplayTitle(vehicle);
  const description = getDisplayDescription(vehicle);
  const fullText = `${title}\n\n${description}`;

  return { title, description, fullText };
}

export async function createImageZip(
  vehicle: Vehicle,
  images: VehicleImage[]
): Promise<Uint8Array> {
  const zip = new JSZip();
  const folderName = `${vehicle.year}_${vehicle.make}_${vehicle.model}_${vehicle.vin}`.replace(/\s+/g, '_');
  const folder = zip.folder(folderName)!;

  for (const image of images) {
    const imageUrl = image.storage_url || image.original_url;
    if (!imageUrl) continue;

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) continue;

      const buffer = await response.arrayBuffer();
      const extension = imageUrl.match(/\.(jpg|jpeg|png|webp)/) ? imageUrl.match(/\.(jpg|jpeg|png|webp)/)![1] : 'jpg';
      const filename = `${String(image.position + 1).padStart(2, '0')}_${image.is_primary ? 'primary_' : ''}photo.${extension}`;

      folder.file(filename, buffer);
    } catch (error) {
      console.error(`Failed to add image to ZIP: ${imageUrl}`, error);
    }
  }

  const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
  return zipBuffer;
}
