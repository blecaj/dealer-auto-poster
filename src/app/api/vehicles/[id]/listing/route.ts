import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { formatListingForClipboard } from '@/lib/marketplace/export';
import type { Vehicle } from '@/types/vehicle';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    const listing = formatListingForClipboard(vehicle as unknown as Vehicle);

    return NextResponse.json(listing);
  } catch (error) {
    console.error('Listing generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
