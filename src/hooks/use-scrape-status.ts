'use client';

import { useQuery } from '@tanstack/react-query';
import type { ScrapeRun } from '@/types/vehicle';

interface ScrapeStatusResponse {
  runs: ScrapeRun[];
  latestRunning: ScrapeRun | null;
}

export function useScrapeStatus(polling = false) {
  return useQuery<ScrapeStatusResponse>({
    queryKey: ['scrape-status'],
    queryFn: async () => {
      const res = await fetch('/api/scrape/status');
      if (!res.ok) throw new Error('Failed to fetch scrape status');
      return res.json();
    },
    refetchInterval: polling ? 5000 : false,
  });
}

export function useTriggerScrape() {
  return async () => {
    const res = await fetch('/api/scrape/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger_type: 'manual' }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to trigger scrape');
    }
    return res.json();
  };
}
