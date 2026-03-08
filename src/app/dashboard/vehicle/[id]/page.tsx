'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useVehicle, useUpdateVehicle, useVehicleAction } from '@/hooks/use-vehicles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/vehicles/status-badge';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  Check,
  Send,
  Ban,
  DollarSign,
  RotateCcw,
  Car,
  Loader2,
} from 'lucide-react';
import type { Vehicle, VehicleStatus, VehicleImage, PostingHistory } from '@/types/vehicle';

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useVehicle(id);
  const updateVehicle = useUpdateVehicle();
  const vehicleAction = useVehicleAction();

  const [isEditing, setIsEditing] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.vehicle) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
        <p>Vehicle not found</p>
        <Button variant="ghost" onClick={() => router.push('/dashboard')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to inventory
        </Button>
      </div>
    );
  }

  const vehicle: Vehicle = data.vehicle;
  const images: VehicleImage[] = data.vehicle.vehicle_images || [];
  const history: PostingHistory[] = data.history || [];

  const displayTitle = vehicle.custom_title || vehicle.generated_title || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const displayDescription = vehicle.custom_description || vehicle.generated_description || '';

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleSaveEdit = async () => {
    await updateVehicle.mutateAsync({
      id: vehicle.id,
      updates: {
        custom_title: customTitle || null,
        custom_description: customDescription || null,
      } as Partial<Vehicle>,
    });
    setIsEditing(false);
    toast.success('Listing updated');
  };

  const handleAction = async (action: 'posted' | 'reposted' | 'removed' | 'sold') => {
    await vehicleAction.mutateAsync({ id: vehicle.id, action });
    toast.success(`Vehicle marked as ${action}`);
  };

  const handleDownloadImages = () => {
    window.open(`/api/vehicles/${vehicle.id}/images`, '_blank');
  };

  const handlePostToFB = () => {
    window.open('https://www.facebook.com/marketplace/create/vehicle', '_blank');
    toast.info('Facebook Marketplace opened. Use the copy buttons to fill in the listing.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h2>
          <p className="text-muted-foreground">{vehicle.trim}</p>
        </div>
        <StatusBadge status={vehicle.status as VehicleStatus} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: Images + Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Image Gallery */}
          <Card>
            <CardContent className="p-4">
              <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-muted">
                {images.length > 0 ? (
                  <img
                    src={images[selectedImage]?.storage_url || images[selectedImage]?.original_url}
                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Car className="h-16 w-16 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              {images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                  {images
                    .sort((a, b) => a.position - b.position)
                    .map((image, i) => (
                      <button
                        key={image.id}
                        onClick={() => setSelectedImage(i)}
                        className={`flex-shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                          i === selectedImage ? 'border-primary' : 'border-transparent'
                        }`}
                      >
                        <img
                          src={image.storage_url || image.original_url}
                          alt={`Photo ${i + 1}`}
                          className="h-16 w-24 object-cover"
                        />
                      </button>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vehicle Specs */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">VIN</span>
                  <p className="font-mono font-medium">{vehicle.vin}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Stock #</span>
                  <p className="font-medium">{vehicle.stock_number || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Price</span>
                  <p className="font-medium">
                    {vehicle.price ? `$${Number(vehicle.price).toLocaleString()}` : 'Contact for pricing'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Mileage</span>
                  <p className="font-medium">
                    {vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Engine</span>
                  <p className="font-medium">{vehicle.engine || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Transmission</span>
                  <p className="font-medium">{vehicle.transmission || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Drivetrain</span>
                  <p className="font-medium">{vehicle.drivetrain || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Exterior Color</span>
                  <p className="font-medium">{vehicle.exterior_color || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Interior Color</span>
                  <p className="font-medium">{vehicle.interior_color || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Body Style</span>
                  <p className="font-medium">{vehicle.body_style || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fuel Type</span>
                  <p className="font-medium">{vehicle.fuel_type || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Source</span>
                  <a
                    href={vehicle.original_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline font-medium"
                  >
                    Dealer Page <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {vehicle.description && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <span className="text-sm text-muted-foreground">Dealer Description</span>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{vehicle.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Listing + Actions */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={handlePostToFB}>
                <Send className="mr-2 h-4 w-4" />
                Post to FB Marketplace
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleDownloadImages}
                disabled={images.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Images ({images.length})
              </Button>

              <Separator />

              <div className="grid grid-cols-2 gap-2">
                {vehicle.status !== 'posted' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction('posted')}
                    disabled={vehicleAction.isPending}
                  >
                    <Check className="mr-1 h-3 w-3" /> Mark Posted
                  </Button>
                )}
                {vehicle.status === 'posted' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction('reposted')}
                    disabled={vehicleAction.isPending}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" /> Repost
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction('sold')}
                  disabled={vehicleAction.isPending}
                >
                  <DollarSign className="mr-1 h-3 w-3" /> Mark Sold
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleAction('removed')}
                  disabled={vehicleAction.isPending}
                >
                  <Ban className="mr-1 h-3 w-3" /> Remove
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Listing Preview / Edit */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Listing</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (isEditing) {
                    handleSaveEdit();
                  } else {
                    setCustomTitle(vehicle.custom_title || vehicle.generated_title || '');
                    setCustomDescription(vehicle.custom_description || vehicle.generated_description || '');
                    setIsEditing(true);
                  }
                }}
              >
                {isEditing ? 'Save' : 'Edit'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      rows={12}
                      className="mt-1"
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground">Title</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(displayTitle, 'Title')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="mt-1 font-medium">{displayTitle}</p>
                  </div>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground">Description</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(displayDescription, 'Description')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{displayDescription}</p>
                  </div>
                  <Separator />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      copyToClipboard(`${displayTitle}\n\n${displayDescription}`, 'Full listing')
                    }
                  >
                    <Copy className="mr-2 h-3 w-3" /> Copy Full Listing
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Posting History */}
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Posting History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {history.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between text-sm">
                      <div>
                        <Badge variant="outline" className="text-xs">
                          {entry.action}
                        </Badge>
                        <span className="ml-2 text-muted-foreground">{entry.platform}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
