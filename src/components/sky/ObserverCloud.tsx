import { layerNames, type Nowcast } from '@/lib/sky';

const metres = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function formatElevation(elevation: number) {
  return `${metres.format(elevation)} m`;
}

export function mostlyBelow(weight?: number) {
  return weight !== undefined && weight < 0.5;
}

function countedPercent(weight: number) {
  const rounded = Math.round(weight * 100);
  if (rounded === 0) return '<1%';
  if (rounded === 100) return '>99%';
  return `${rounded}%`;
}

export function LayerWeightTag({ weight }: { weight?: number }) {
  if (weight === undefined || weight === 1) return null;
  const below = mostlyBelow(weight);
  return (
    <small className="layer-weight">
      {below && 'below site'}
      {weight > 0 && `${below ? ' · ' : ''}${countedPercent(weight)} counted`}
    </small>
  );
}

export function ObserverCloud({
  site,
}: {
  site: NonNullable<Nowcast['site_elevation']>;
}) {
  const weights = site.layer_weights;
  const notes = layerNames.flatMap((layer) => {
    const weight = weights[layer];
    if (weight === 0) return `${layer} cloud below the site ignored`;
    if (weight < 1) return `${countedPercent(weight)} of ${layer} cloud counted`;
    return [];
  });
  const counted = layerNames.filter((layer) => weights[layer] === 1);
  if (notes.length && counted.length)
    notes.push(`${counted.join(' and ')} cloud fully counted`);
  return (
    <p className="observer-cloud">
      Counting cloud above {formatElevation(site.elevation_m)} ·{' '}
      {notes.length ? notes.join(' · ') : 'all layers counted'}
    </p>
  );
}
