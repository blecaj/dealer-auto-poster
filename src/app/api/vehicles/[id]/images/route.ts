import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createImageZip } from '@/lib/marketplace/export';
import type { Vehicle, VehicleImage } from '@/types/vehicle';

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

    const { data: images, error: imagesError } = await supabase
      .from('vehicle_images')
      .select('*')
      .eq('vehicle_id', id)
      .order('position', { ascending: true });

    if (imagesError || !images || images.length === 0) {
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
