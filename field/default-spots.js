import { validateImportedPackage } from './core.js';

export const REGION_MANIFEST_URL = './spots/regions.json';
export const REGION_DETAIL_ZOOM = 10;

function overviewCenter(region) {
  const centers = region.overview_spots?.map(({ center }) => center)
    .filter((center) => Array.isArray(center) && center.length === 2) || [];
  if (!centers.length) return null;
  return [
    centers.reduce((sum, [longitude]) => sum + longitude, 0) / centers.length,
    centers.reduce((sum, [, latitude]) => sum + latitude, 0) / centers.length,
  ];
}

export function nearestMapRegion(regions, [longitude, latitude]) {
  return regions.reduce((nearest, region) => {
    const center = region.map_center || overviewCenter(region);
    if (!center) return nearest;
    const longitudeScale = Math.cos(latitude * Math.PI / 180);
    const distance = ((center[0] - longitude) * longitudeScale) ** 2
      + (center[1] - latitude) ** 2;
    return !nearest || distance < nearest.distance ? { region, distance } : nearest;
  }, null)?.region || null;
}

export async function loadRegionSpotPackage(region, fetchPackage = fetch) {
  if (!/^[a-z]+$/.test(String(region))) throw new Error('Invalid habitat region');
  const response = await fetchPackage(`./spots/${region}.json`);
  if (!response.ok) throw new Error('Habitat region is not available');
  return validateImportedPackage(await response.json());
}

export async function loadRegionSpotOverview(regions, fetchPackage = fetch) {
  if (!Array.isArray(regions)) throw new Error('Habitat region list is invalid');
  const packages = await Promise.all(regions.map(({ key }) => (
    loadRegionSpotPackage(key, fetchPackage)
  )));
  return packages.flatMap(({ spots }) => spots);
}

export async function loadRegionManifest(fetchPackage = fetch) {
  const response = await fetchPackage(REGION_MANIFEST_URL);
  if (!response.ok) throw new Error('Habitat region list is not available');
  const value = await response.json();
  if (value?.schema_version !== 1 || value.ranking_scope !== 'within_region'
    || !/^[a-z]+$/.test(String(value.default_region)) || !Array.isArray(value.regions)
    || value.regions.some((region) => !/^[a-z]+$/.test(String(region.key))
      || !region.name || !Number.isInteger(region.eligible_cells)
      || region.eligible_cells < 1)) {
    throw new Error('Habitat region list is invalid');
  }
  return value;
}

export async function loadRegionPublicLand(region, fetchPackage = fetch) {
  if (!/^[a-z]+$/.test(String(region))) throw new Error('Invalid habitat region');
  const response = await fetchPackage(`./public-land/${region}.json`);
  if (!response.ok) throw new Error('Public-land boundary is not available');
  const value = await response.json();
  if (value?.type !== 'FeatureCollection' || !Array.isArray(value.features)
    || value.features.some((feature) => feature?.type !== 'Feature'
      || !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type))) {
    throw new Error('Public-land boundary is invalid');
  }
  return value;
}

export function chooseInitialPackage(stored, published) {
  if (!published) return stored;
  if (!stored) return published;
  if (stored.package_type !== 'ranked_spots' || stored.region !== published.region) {
    return stored;
  }
  const storedTime = Date.parse(stored.generated_at || '') || 0;
  const publishedTime = Date.parse(published.generated_at || '') || 0;
  return publishedTime > storedTime || stored.spots?.length !== published.spots?.length
    ? published
    : stored;
}
