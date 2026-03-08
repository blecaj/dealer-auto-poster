'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import {
  DEFAULT_TITLE_TEMPLATE,
  DEFAULT_TITLE_SUFFIXES,
  DEFAULT_DESCRIPTION_TEMPLATE,
  LOW_KM_THRESHOLD,
} from '@/lib/listing/templates';

export default function SettingsPage() {
  const [titleTemplate, setTitleTemplate] = useState(DEFAULT_TITLE_TEMPLATE);
  const [titleSuffixes, setTitleSuffixes] = useState(DEFAULT_TITLE_SUFFIXES.join(', '));
  const [descriptionTemplate, setDescriptionTemplate] = useState(DEFAULT_DESCRIPTION_TEMPLATE);
  const [lowKmThreshold, setLowKmThreshold] = useState(LOW_KM_THRESHOLD.toString());

  const handleSave = () => {
    // For now, templates are stored in code. In a future version,
    // these would be saved to a settings table in Supabase.
    toast.success('Settings saved (note: template customization will be stored in database in a future update)');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Configure listing templates and application settings.
        </p>
      </div>

      {/* Title Template */}
      <Card>
        <CardHeader>
          <CardTitle>Title Template</CardTitle>
          <CardDescription>
            Configure how listing titles are generated. Use placeholders like {'{year}'}, {'{make}'}, {'{model}'}, {'{trim}'}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Title Format</Label>
            <Input
              value={titleTemplate}
              onChange={(e) => setTitleTemplate(e.target.value)}
              className="mt-1 font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Example output: 2024 Chevrolet Silverado 1500 LT
            </p>
          </div>

          <div>
            <Label>Suffixes (comma-separated)</Label>
            <Input
              value={titleSuffixes}
              onChange={(e) => setTitleSuffixes(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Added to the end of titles with dashes. "Low KM" is auto-added when mileage is below threshold.
            </p>
          </div>

          <div>
            <Label>Low KM Threshold</Label>
            <Input
              type="number"
              value={lowKmThreshold}
              onChange={(e) => setLowKmThreshold(e.target.value)}
              className="mt-1 w-40"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Vehicles below this mileage get "Low KM" in the title.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Description Template */}
      <Card>
        <CardHeader>
          <CardTitle>Description Template</CardTitle>
          <CardDescription>
            Configure the listing description format. Available placeholders: {'{year}'}, {'{make}'}, {'{model}'}, {'{trim}'}, {'{mileage}'}, {'{price}'}, {'{engine}'}, {'{transmission}'}, {'{drivetrain}'}, {'{exterior_color}'}, {'{interior_color}'}, {'{vin}'}, {'{stock_number}'}, {'{description}'}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Description Format</Label>
            <Textarea
              value={descriptionTemplate}
              onChange={(e) => setDescriptionTemplate(e.target.value)}
              rows={16}
              className="mt-1 font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Dealer Info */}
      <Card>
        <CardHeader>
          <CardTitle>Dealer Information</CardTitle>
          <CardDescription>
            Information included in generated listings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Dealer Name</Label>
              <Input value="Woodbine GM" disabled className="mt-1" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value="(416) 743-1810" disabled className="mt-1" />
            </div>
            <div>
              <Label>Address</Label>
              <Input value="360 Rexdale Blvd., Etobicoke, ON M9W 1R7" disabled className="mt-1" />
            </div>
            <div>
              <Label>Source URL</Label>
              <Input
                value="https://www.woodbinegm.com/vehicles/used/"
                disabled
                className="mt-1 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}
