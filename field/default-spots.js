import { validateImportedPackage } from './core.js';

export const DEFAULT_SPOT_PACKAGE_URL = './spots/silkeborg.json';

export async function loadDefaultSpotPackage(fetchPackage = fetch) {
  const response = await fetchPackage(DEFAULT_SPOT_PACKAGE_URL);
  if (!response.ok) throw new Error('Default habitat spots are not available');
  return validateImportedPackage(await response.json());
}
