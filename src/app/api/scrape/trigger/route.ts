import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { runScrape } from '@/lib/scraper';

export const maxDuration = 300; // 5 minutes for Pro plan

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();

    // Check for existing running scrape
    const { data: running } = await supabase
      .from('scrape_runs')
      .select('id')
      .eq('status', 'running')
      .single();

    if (running) {
      return NextResponse.json(
        { error: 'A scrape is already in progress', runId: running.id },
        { status: 409 }
      );
    }

    // Determine trigger type
    const body = await request.json().catch(() => ({}));
    const triggerType = body.trigger_type || 'manual';

    // Create scrape run record
    const { data: run, error } = await supabase
      .from('scrape_runs')
      .insert({
        status: 'running',
        trigger_type: triggerType,
      })
      .select('id')
      .single();

    if (error || !run) {
      return NextResponse.json(
        { error: 'Failed to create scrape run' },
        { status: 500 }
      );
    }

    // Run the scrape (async, don't await in response)
    runScrape(run.id).catch((err) => {
      console.error('Scrape failed:', err);
    });

    return NextResponse.json({ success: true, runId: run.id });
  } catch (error) {
    console.error('Scrape trigger error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
