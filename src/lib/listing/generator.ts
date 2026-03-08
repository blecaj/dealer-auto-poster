import type { Vehicle } from '@/types/vehicle';
import {
  DEFAULT_TITLE_TEMPLATE,
  DEFAULT_TITLE_SUFFIXES,
  LOW_KM_THRESHOLD,
  DEFAULT_DESCRIPTION_TEMPLATE,
} from './templates';

function replacePlaceholders(template: string, vehicle: Vehicle): string {
  const replacements: Record<string, string> = {
    '{year}': vehicle.year?.toString() ?? '',
    '{make}': vehicle.make ?? '',
    '{model}': vehicle.model ?? '',
    '{trim}': vehicle.trim ?? '',
    '{mileage}': vehicle.mileage?.toLocaleString() ?? 'N/A',
    '{price}': vehicle.price ? `$${Number(vehicle.price).toLocaleString()}` : 'Contact for pricing',
    '{engine}': vehicle.engine ?? 'N/A',
    '{transmission}': vehicle.transmission ?? 'N/A',
    '{drivetrain}': vehicle.drivetrain ?? 'N/A',
    '{exterior_color}': vehicle.exterior_color ?? 'N/A',
    '{interior_color}': vehicle.interior_color ?? 'N/A',
    '{vin}': vehicle.vin ?? '',
    '{stock_number}': vehicle.stock_number ?? 'N/A',
    '{description}': vehicle.description ?? '',
    '{body_style}': vehicle.body_style ?? '',
    '{fuel_type}': vehicle.fuel_type ?? '',
  };

  let result = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, value);
  }

  // Clean up lines with only "N/A" values
  result = result
    .split('\n')
    .filter((line) => !line.match(/^- .+: N\/A$/))
    .join('\n');

  return result.trim();
}

export function generateTitle(
  vehicle: Vehicle,
  template: string = DEFAULT_TITLE_TEMPLATE,
  suffixes: string[] = DEFAULT_TITLE_SUFFIXES
): string {
  let title = replacePlaceholders(template, vehicle).trim();

  // Remove trailing dash if trim is empty
  title = title.replace(/\s+-\s*$/, '').replace(/\s+/g, ' ').trim();

  const allSuffixes: string[] = [];
  if (vehicle.mileage && vehicle.mileage < LOW_KM_THRESHOLD) {
    allSuffixes.push('Low KM');
  }
  allSuffixes.push(...suffixes);

  if (allSuffixes.length > 0) {
    title += ' - ' + allSuffixes.join(' - ');
  }

  return title;
}

export function generateDescription(
  vehicle: Vehicle,
  template: string = DEFAULT_DESCRIPTION_TEMPLATE
): string {
  return replacePlaceholders(template, vehicle);
}

export function getDisplayTitle(vehicle: Vehicle): string {
  return vehicle.custom_title || vehicle.generated_title || generateTitle(vehicle);
}

export function getDisplayDescription(vehicle: Vehicle): string {
  return vehicle.custom_description || vehicle.generated_description || generateDescription(vehicle);
}
