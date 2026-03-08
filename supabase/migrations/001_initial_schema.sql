-- Vehicle status enum
CREATE TYPE vehicle_status AS ENUM ('pending', 'posted', 'sold', 'removed', 'archived');
CREATE TYPE scrape_status AS ENUM ('running', 'completed', 'failed');

-- Core vehicle inventory table
CREATE TABLE vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vin VARCHAR(17) UNIQUE NOT NULL,
  year INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  trim VARCHAR(200),
  body_style VARCHAR(100),
  exterior_color VARCHAR(100),
  interior_color VARCHAR(100),
  transmission VARCHAR(100),
  drivetrain VARCHAR(50),
  engine VARCHAR(200),
  fuel_type VARCHAR(50),
  mileage INTEGER,
  price DECIMAL(10,2),
  original_url TEXT NOT NULL,
  description TEXT,
  generated_title TEXT,
  generated_description TEXT,
  custom_title TEXT,
  custom_description TEXT,
  status vehicle_status DEFAULT 'pending',
  first_scraped_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  stock_number VARCHAR(50),
  dealer_id VARCHAR(50) DEFAULT '20230908163724338',
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicle images
CREATE TABLE vehicle_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  storage_path TEXT,
  storage_url TEXT,
  position INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  downloaded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scrape run history
CREATE TABLE scrape_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status scrape_status DEFAULT 'running',
  trigger_type VARCHAR(20) DEFAULT 'manual',
  vehicles_found INTEGER DEFAULT 0,
  vehicles_new INTEGER DEFAULT 0,
  vehicles_updated INTEGER DEFAULT 0,
  vehicles_removed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Posting history
CREATE TABLE posting_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  platform VARCHAR(50) DEFAULT 'facebook_marketplace',
  action VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_vin ON vehicles(vin);
CREATE INDEX idx_vehicles_last_seen ON vehicles(last_seen_at);
CREATE INDEX idx_vehicle_images_vehicle_id ON vehicle_images(vehicle_id);
CREATE INDEX idx_posting_history_vehicle_id ON posting_history(vehicle_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE posting_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users full access on vehicles"
  ON vehicles FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access on vehicle_images"
  ON vehicle_images FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access on scrape_runs"
  ON scrape_runs FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access on posting_history"
  ON posting_history FOR ALL USING (auth.role() = 'authenticated');

-- Create storage bucket for vehicle images
INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-images', 'vehicle-images', true);

CREATE POLICY "Public read access on vehicle images"
  ON storage.objects FOR SELECT USING (bucket_id = 'vehicle-images');

CREATE POLICY "Authenticated upload to vehicle images"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'vehicle-images' AND auth.role() = 'authenticated');

CREATE POLICY "Service role full access on vehicle images"
  ON storage.objects FOR ALL USING (bucket_id = 'vehicle-images');
