'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Vehicle, VehicleStatus } from '@/types/vehicle';

interface VehiclesResponse {
  vehicles: (Vehicle & { vehicle_images: { id: string; storage_url: string; original_url: string; position: number; is_primary: boolean }[] })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useVehicles(params: {
  status?: string;
  search?: string;
  page?: number;
}) {
  const queryString = new URLSearchParams();
  if (params.status) queryString.set('status', params.status);
  if (params.search) queryString.set('search', params.search);
  if (params.page) queryString.set('page', params.page.toString());

  return useQuery<VehiclesResponse>({
    queryKey: ['vehicles', params],
    queryFn: async () => {
      const res = await fetch(`/api/vehicles?${queryString}`);
      if (!res.ok) throw new Error('Failed to fetch vehicles');
      return res.json();
    },
  });
}

export function useVehicle(id: string) {
  return useQuery({
    queryKey: ['vehicle', id],
    queryFn: async () => {
      const res = await fetch(`/api/vehicles/${id}`);
      if (!res.ok) throw new Error('Failed to fetch vehicle');
      return res.json();
    },
    enabled: !!id,
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Vehicle> }) => {
      const res = await fetch(`/api/vehicles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update vehicle');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle', variables.id] });
    },
  });
}

export function useVehicleAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      action,
      platform,
      notes,
    }: {
      id: string;
      action: 'posted' | 'reposted' | 'removed' | 'sold';
      platform?: string;
      notes?: string;
    }) => {
      const res = await fetch(`/api/vehicles/${id}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, platform, notes }),
      });
      if (!res.ok) throw new Error('Failed to perform action');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle', variables.id] });
    },
  });
}
