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
  "field/spot-mode.js",
  "field/spot-styles.css",
  "field/spots/silkeborg.json",
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
