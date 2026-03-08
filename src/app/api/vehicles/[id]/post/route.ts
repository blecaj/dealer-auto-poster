import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const body = await request.json().catch(() => ({}));

    const action = body.action || 'posted'; // posted, reposted, removed, sold
    const platform = body.platform || 'facebook_marketplace';
    const notes = body.notes || null;

    // Update vehicle status
    const statusMap: Record<string, string> = {
      posted: 'posted',
      reposted: 'posted',
      removed: 'removed',
      sold: 'sold',
    };

    const timestampMap: Record<string, string> = {
      posted: 'posted_at',
      reposted: 'posted_at',
      removed: 'removed_at',
      sold: 'sold_at',
    };

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: statusMap[action] || 'pending',
    };

    if (timestampMap[action]) {
      updates[timestampMap[action]] = now;
    }

    const { error: updateError } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Record in posting history
    const { error: historyError } = await supabase
      .from('posting_history')
      .insert({
        vehicle_id: id,
        platform,
        action,
        notes,
      });

    if (historyError) {
      console.error('Failed to record posting history:', historyError);
    }

    return NextResponse.json({ success: true, action, status: statusMap[action] });
  } catch (error) {
    console.error('Vehicle post error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
