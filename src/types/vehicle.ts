export type VehicleStatus = 'pending' | 'posted' | 'sold' | 'removed' | 'archived';
export type ScrapeStatus = 'running' | 'completed' | 'failed';

export interface Vehicle {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  body_style: string | null;
  exterior_color: string | null;
  interior_color: string | null;
  transmission: string | null;
  drivetrain: string | null;
  engine: string | null;
  fuel_type: string | null;
  mileage: number | null;
  price: number | null;
  original_url: string;
  description: string | null;
  generated_title: string | null;
  generated_description: string | null;
  custom_title: string | null;
  custom_description: string | null;
  status: VehicleStatus;
  first_scraped_at: string;
  last_seen_at: string;
  posted_at: string | null;
  sold_at: string | null;
  removed_at: string | null;
  stock_number: string | null;
  dealer_id: string;
  raw_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  images?: VehicleImage[];
}

export interface VehicleImage {
  id: string;
  vehicle_id: string;
  original_url: string;
  storage_path: string | null;
  storage_url: string | null;
  position: number;
  is_primary: boolean;
  downloaded: boolean;
  created_at: string;
}

export interface ScrapeRun {
  id: string;
  status: ScrapeStatus;
  trigger_type: string;
  vehicles_found: number;
  vehicles_new: number;
  vehicles_updated: number;
  vehicles_removed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface PostingHistory {
  id: string;
  vehicle_id: string;
  platform: string;
  action: string;
  notes: string | null;
  created_at: string;
}

export interface ScrapedVehicleData {
  vin: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  body_style?: string;
  exterior_color?: string;
  interior_color?: string;
  transmission?: string;
  drivetrain?: string;
  engine?: string;
  fuel_type?: string;
  mileage?: number;
  price?: number;
  original_url: string;
  description?: string;
  stock_number?: string;
  image_urls: string[];
  raw_data?: Record<string, unknown>;
}
