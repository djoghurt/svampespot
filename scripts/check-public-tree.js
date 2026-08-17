#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const allowed = new Set([
  ".githooks/pre-push",
  ".github/workflows/deploy-field.yml",
  ".gitignore",
  "README.md",
  "field/.nojekyll",
  "field/app.js",
  "field/core.js",
  "field/default-spots.js",
  "field/icon-180.png",
  "field/icon-192.png",
  "field/icon-512.png",
  "field/icon.svg",
  "field/index.html",
  "field/manifest.webmanifest",
  "field/map.js",
  "field/public-land/bornholm.json",
  "field/public-land/eastjylland.json",
  "field/public-land/eastzealand.json",
  "field/public-land/fyn.json",
  "field/public-land/gribskov.json",
  "field/public-land/roldblock.json",
  "field/public-land/silkeborg.json",
  "field/public-land/southjylland.json",
  "field/public-land/tisvilde.json",
  "field/public-land/vendsyssel.json",
  "field/public-land/vestsjaelland.json",
  "field/public-land/westjylland.json",
  "field/rank-display.js",
  "field/spot-mode.js",
  "field/spot-styles.css",
  "field/spots/bornholm.json",
  "field/spots/eastjylland.json",
  "field/spots/eastzealand.json",
  "field/spots/fyn.json",
  "field/spots/gribskov.json",
  "field/spots/regions.json",
  "field/spots/roldblock.json",
  "field/spots/silkeborg.json",
  "field/spots/southjylland.json",
  "field/spots/tisvilde.json",
  "field/spots/vendsyssel.json",
  "field/spots/vestsjaelland.json",
  "field/spots/westjylland.json",
  "field/storage.js",
  "field/styles.css",
  "field/sw.js",
  "field/vendor/images/layers-2x.png",
  "field/vendor/images/layers.png",
  "field/vendor/images/marker-icon-2x.png",
  "field/vendor/images/marker-icon.png",
  "field/vendor/images/marker-shadow.png",
  "field/vendor/leaflet.css",
  "field/vendor/leaflet.js",
  "field/weather.js",
  "scripts/check-public-tree.js"
]);
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);
const unexpected = tracked.filter((file) => !allowed.has(file));
if (unexpected.length) {
  console.error('Blocked: public repository contains unexpected files:');
  unexpected.forEach((file) => console.error('  ' + file));
  process.exit(1);
}
console.log('Public repository allowlist passed (' + tracked.length + ' files).');
