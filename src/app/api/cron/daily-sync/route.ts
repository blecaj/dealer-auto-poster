import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { runScrape } from '@/lib/scraper';

export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    // Verify cron secret (Vercel sends this automatically)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Check for existing running scrape
    const { data: running } = await supabase
      .from('scrape_runs')
      .select('id')
      .eq('status', 'running')
      .single();

    if (running) {
      return NextResponse.json({ message: 'Scrape already in progress', runId: running.id });
    }

    // Create scrape run
    const { data: run, error } = await supabase
      .from('scrape_runs')
      .insert({
        status: 'running',
        trigger_type: 'cron',
      })
      .select('id')
      .single();

    if (error || !run) {
      return NextResponse.json({ error: 'Failed to create scrape run' }, { status: 500 });
    }

    // Run scrape
    const stats = await runScrape(run.id);

    return NextResponse.json({
      success: true,
      runId: run.id,
      stats,
    });
  } catch (error) {
    console.error('Cron daily sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
