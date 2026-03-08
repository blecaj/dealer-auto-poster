import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .select('*, vehicle_images(*)')
      .eq('id', id)
      .single();

    if (error || !vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // Also get posting history
    const { data: history } = await supabase
      .from('posting_history')
      .select('*')
      .eq('vehicle_id', id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ vehicle, history: history || [] });
  } catch (error) {
    console.error('Vehicle detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const body = await request.json();

    // Only allow certain fields to be updated
    const allowedFields = [
      'custom_title',
      'custom_description',
      'status',
      'posted_at',
      'sold_at',
      'removed_at',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ vehicle });
  } catch (error) {
    console.error('Vehicle update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
