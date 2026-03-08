import { Badge } from '@/components/ui/badge';
import type { VehicleStatus } from '@/types/vehicle';

const statusConfig: Record<VehicleStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'outline' },
  posted: { label: 'Posted', variant: 'default' },
  sold: { label: 'Sold', variant: 'secondary' },
  removed: { label: 'Removed', variant: 'destructive' },
  archived: { label: 'Archived', variant: 'secondary' },
};

export function StatusBadge({ status }: { status: VehicleStatus }) {
  const config = statusConfig[status] || statusConfig.pending;

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
