import { validateImportedPackage } from './core.js';

export const DEFAULT_SPOT_PACKAGE_URL = './spots/silkeborg.json';

export async function loadDefaultSpotPackage(fetchPackage = fetch) {
  const response = await fetchPackage(DEFAULT_SPOT_PACKAGE_URL);
  if (!response.ok) throw new Error('Default habitat spots are not available');
  return validateImportedPackage(await response.json());
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
