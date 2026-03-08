'use client';

import { useState } from 'react';
import { useVehicles } from '@/hooks/use-vehicles';
import { VehicleFilters } from '@/components/vehicles/vehicle-filters';
import { VehicleGrid } from '@/components/vehicles/vehicle-grid';

export default function DashboardPage() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useVehicles({ status, search, page });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Vehicle Inventory</h2>
        <p className="text-muted-foreground">
          Manage your dealership vehicle listings and marketplace postings.
        </p>
      </div>

      <VehicleFilters
        status={status}
        search={search}
        onStatusChange={(s) => {
          setStatus(s);
          setPage(1);
        }}
        onSearchChange={(s) => {
          setSearch(s);
          setPage(1);
        }}
      />

      <VehicleGrid
        vehicles={data?.vehicles || []}
        isLoading={isLoading}
        page={page}
        totalPages={data?.totalPages || 1}
        total={data?.total || 0}
        onPageChange={setPage}
      />
    </div>
  );
}
