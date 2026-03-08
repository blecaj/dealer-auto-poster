'use client';

import { useState } from 'react';
import { useScrapeStatus, useTriggerScrape } from '@/hooks/use-scrape-status';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { RefreshCw, Loader2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ScrapePage() {
  const [isTriggering, setIsTriggering] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading } = useScrapeStatus(isTriggering);
  const triggerScrape = useTriggerScrape();

  const handleTriggerScrape = async () => {
    try {
      setIsTriggering(true);
      await triggerScrape();
      toast.success('Scrape started! This may take a few minutes.');
      queryClient.invalidateQueries({ queryKey: ['scrape-status'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to trigger scrape');
      setIsTriggering(false);
    }
  };

  // Stop polling once the latest running scrape completes
  const latestRunning = data?.latestRunning;
  if (isTriggering && !latestRunning) {
    // Scrape finished
    setTimeout(() => {
      setIsTriggering(false);
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    }, 2000);
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-blue-500">Running</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventory Scrape</h2>
          <p className="text-muted-foreground">
            Sync vehicle inventory from the dealership website.
          </p>
        </div>

        <Button
          onClick={handleTriggerScrape}
          disabled={isTriggering || !!latestRunning}
        >
          {isTriggering || latestRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scraping...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Now
            </>
          )}
        </Button>
      </div>

      {/* Current Status */}
      {latestRunning && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardContent className="flex items-center gap-4 p-4">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <div>
              <p className="font-medium">Scrape in progress</p>
              <p className="text-sm text-muted-foreground">
                Started {formatDistanceToNow(new Date(latestRunning.started_at), { addSuffix: true })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">Daily at 6:00 AM</p>
            <p className="text-xs text-muted-foreground">Automatic via Vercel Cron</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Source</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">Woodbine GM</p>
            <p className="text-xs text-muted-foreground">Used vehicle inventory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Scrape</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.runs?.[0] ? (
              <>
                <p className="text-lg font-bold">
                  {formatDistanceToNow(new Date(data.runs[0].started_at), { addSuffix: true })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.runs[0].vehicles_found} found, {data.runs[0].vehicles_new} new
                </p>
              </>
            ) : (
              <p className="text-lg font-bold text-muted-foreground">Never</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scrape History */}
      <Card>
        <CardHeader>
          <CardTitle>Scrape History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : data?.runs && data.runs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Found</TableHead>
                  <TableHead>New</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Removed</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>{getStatusBadge(run.status)}</TableCell>
                    <TableCell className="capitalize">{run.trigger_type}</TableCell>
                    <TableCell>{run.vehicles_found}</TableCell>
                    <TableCell>{run.vehicles_new}</TableCell>
                    <TableCell>{run.vehicles_updated}</TableCell>
                    <TableCell>{run.vehicles_removed}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {run.completed_at
                        ? `${Math.round(
                            (new Date(run.completed_at).getTime() -
                              new Date(run.started_at).getTime()) /
                              1000
                          )}s`
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">
              No scrape runs yet. Click "Sync Now" to start your first scrape.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
