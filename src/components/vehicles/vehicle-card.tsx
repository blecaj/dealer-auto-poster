'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from './status-badge';
import type { Vehicle, VehicleStatus } from '@/types/vehicle';
import { Car, Gauge, DollarSign } from 'lucide-react';

interface VehicleCardProps {
  vehicle: Vehicle & {
    vehicle_images?: { id: string; storage_url: string; original_url: string; position: number; is_primary: boolean }[];
  };
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const primaryImage = vehicle.vehicle_images?.find((img) => img.is_primary) || vehicle.vehicle_images?.[0];
  const imageUrl = primaryImage?.storage_url || primaryImage?.original_url;

  return (
    <Link href={`/dashboard/vehicle/${vehicle.id}`}>
      <Card className="overflow-hidden transition-shadow hover:shadow-lg">
        <div className="relative aspect-[16/10] bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Car className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute right-2 top-2">
            <StatusBadge status={vehicle.status as VehicleStatus} />
          </div>
        </div>

        <CardContent className="p-4">
          <h3 className="font-semibold truncate">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h3>
          {vehicle.trim && (
            <p className="text-sm text-muted-foreground truncate">{vehicle.trim}</p>
          )}

          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            {vehicle.price && (
              <span className="flex items-center gap-1 font-medium text-foreground">
                <DollarSign className="h-3 w-3" />
                {Number(vehicle.price).toLocaleString()}
              </span>
            )}
            {vehicle.mileage && (
              <span className="flex items-center gap-1">
                <Gauge className="h-3 w-3" />
                {vehicle.mileage.toLocaleString()} km
              </span>
            )}
          </div>

          <p className="mt-2 text-xs text-muted-foreground font-mono">
            VIN: {vehicle.vin}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
