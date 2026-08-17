import {
  activateReplacementPair,
  bearingDegrees,
  createFieldResult,
  distanceMeters,
  formatDistance,
  formatTimer,
  validateImportedPackage,
} from './core.js';
import {
  chooseInitialPackage,
  loadRegionManifest,
  loadRegionPublicLand,
  loadRegionSpotPackage,
  nearestMapRegion,
  REGION_DETAIL_ZOOM,
} from './default-spots.js?v=2026-08-17-14';
import { createFieldMap } from './map.js?v=2026-08-17-14';
import { createSpotMode } from './spot-mode.js?v=2026-08-17-14';
import { loadPhoto, loadState, savePhoto, saveState } from './storage.js';

const element = (id) => document.getElementById(id);
const ui = {
  empty: element('emptyState'), visit: element('visitState'), input: element('packageInput'),
  importButton: element('importButton'), progress: element('progress'), title: element('visitTitle'),
  status: element('visitStatus'), apple: element('appleMaps'), google: element('googleMaps'),
  timer: element('timer'), start: element('startVisit'), finish: element('finishVisit'),
  replace: element('replacePair'), replaceDialog: element('replacementDialog'),
  replaceForm: element('replacementForm'), closeReplacement: element('closeReplacement'),
  previous: element('previousVisit'), next: element('nextVisit'), export: element('exportResults'),
  locate: element('locate'), bearing: element('bearing'), distance: element('distance'),
  needle: element('needle'), dialog: element('resultDialog'), form: element('resultForm'),
  closeDialog: element('closeDialog'), toast: element('toast'),
};
const fieldMap = createFieldMap(element('map'));
const state = {
  package: null,
  results: [],
  exclusions: [],
  index: 0,
  active: null,
  position: null,
  track: [],
  watchId: null,
  timerId: null,
  regionManifest: null,
  publicLand: null,
  overviewSpots: null,
  regionPackages: new Map(),
  publicLands: new Map(),
};
let regionRequest = 0;

const spotMode = createSpotMode({
  detailZoom: REGION_DETAIL_ZOOM,
  fieldMap,
  packageInput: ui.input,
  onSelectionChanged: () => updateInstrument(),
  onRegionChanged: switchRegion,
  showToast,
});

const currentVisit = () => state.package?.visits?.[state.index] || null;
const completedIds = () => new Set(state.results.map((result) => result.visit_id));
function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('visible');
  setTimeout(() => ui.toast.classList.remove('visible'), 2600);
}
function updateInstrument() {
  const visit = currentVisit();
  const target = spotMode.currentCenter() || visit?.approach_point;
  if (!target || !state.position) {
    ui.bearing.textContent = '—';
    ui.distance.textContent = 'Location off';
    ui.needle.style.transform = 'rotate(0deg)';
    return;
  }
  const distance = distanceMeters(state.position, target);
  const bearing = bearingDegrees(state.position, target);
  ui.bearing.textContent = String(Math.round(bearing)).padStart(3, '0') + '°';
  ui.distance.textContent = formatDistance(distance);
  ui.needle.style.transform = 'rotate(' + bearing + 'deg)';
}
function updatePosition(position) {
  state.position = [position.coords.longitude, position.coords.latitude];
  fieldMap.showLocation(state.position, position.coords.accuracy);
  if (state.active) {
    state.track.push([
      state.position[0], state.position[1], new Date(position.timestamp).toISOString(),
    ]);
  }
  updateInstrument();
}
function requestLocation(watch = false) {
  if (!navigator.geolocation) return showToast('Location is not available on this device.');
  navigator.geolocation.getCurrentPosition(updatePosition, () => {
    showToast('Allow location access to show distance and direction.');
  }, { enableHighAccuracy: true, timeout: 15000 });
  if (watch && state.watchId == null) {
    state.watchId = navigator.geolocation.watchPosition(updatePosition, () => {}, {
      enableHighAccuracy: true, maximumAge: 5000,
    });
  }
}
function navigationLinks(visit) {
  const destination = visit.approach_point[1] + ',' + visit.approach_point[0];
  ui.apple.href = 'https://maps.apple.com/?daddr=' + destination + '&dirflg=d';
  ui.google.href = 'https://www.google.com/maps/dir/?api=1&destination=' + destination
    + '&travelmode=driving';
}
function tick() {
  if (!state.active) {
    ui.timer.textContent = formatTimer((state.package?.minutes_per_visit || 30) * 60);
    return;
  }
  const elapsed = Math.floor((Date.now() - state.active.started_at) / 1000);
  const remaining = state.active.duration_seconds - elapsed;
  ui.timer.textContent = formatTimer(remaining);
  if (remaining <= 0) {
    ui.status.textContent = 'Time complete';
    ui.finish.classList.add('attention');
  }
}
function render() {
  const hasPackage = Boolean(state.package);
  ui.empty.hidden = hasPackage;
  const hasSpots = state.package?.package_type === 'ranked_spots';
  ui.visit.hidden = !hasPackage || hasSpots;
  if (!hasPackage) return;
  if (hasSpots) {
    const regionInfo = state.regionManifest?.regions.find(
      ({ key }) => key === state.package.region,
    ) || null;
    spotMode.setRegions(state.regionManifest?.regions || []);
    spotMode.activate(state.package, {
      overviewSpots: state.overviewSpots,
      publicLand: state.publicLand,
      regionInfo,
    });
    updateInstrument();
    return;
  }
  spotMode.deactivate();
  const visit = currentVisit();
  const complete = completedIds().has(visit.visit_id);
  const pairStarted = state.results.some(({ pair_id: pairId }) => pairId === visit.pair_id);
  const hasReplacement = state.package.replacement_pairs?.some(
    ({ region }) => region === visit.region,
  );
  ui.progress.textContent = 'Visit ' + (state.index + 1) + ' of ' + state.package.visits.length
    + ' · ' + state.results.length + ' saved';
  ui.title.textContent = visit.region === 'silkeborg' ? 'Silkeborg cell' : 'Rold cell';
  ui.status.textContent = complete ? 'Saved' : state.active ? 'Searching' : 'Not started';
  ui.start.disabled = complete || Boolean(state.active);
  ui.finish.disabled = complete || !state.active;
  ui.replace.disabled = complete || Boolean(state.active) || pairStarted || !hasReplacement;
  ui.previous.disabled = state.index === 0 || Boolean(state.active);
  ui.next.disabled = state.index >= state.package.visits.length - 1 || Boolean(state.active);
  navigationLinks(visit);
  fieldMap.showVisit(visit);
  updateInstrument();
  tick();
}
async function importPackage(file) {
  const parsed = validateImportedPackage(JSON.parse(await file.text()));
  state.package = parsed;
  state.results = [];
  state.exclusions = [];
  state.active = null;
  state.index = 0;
  state.publicLand = null;
  if (parsed.package_type === 'ranked_spots') {
    try {
      state.publicLand = await loadRegionPublicLand(parsed.region);
    } catch {
      // Imported packages remain usable without the optional reference outline.
    }
  }
  await saveState('package', parsed);
  await saveState('results', []);
  await saveState('exclusions', []);
  await saveState('active', null);
  render();
  showToast(parsed.package_type === 'ranked_spots'
    ? parsed.spots.length + ' habitat spots imported.'
    : parsed.visits.length + ' blinded visits imported.');
}

async function switchRegion(region, spotId = null, options = {}) {
  const { automatic = false, fitRegion = true } = options;
  const regionInfo = state.regionManifest?.regions.find(({ key }) => key === region);
  if (!regionInfo) return;
  const request = ++regionRequest;
  if (region === state.package?.region) {
    spotMode.showRegionDetail(spotId, fitRegion);
    return;
  }
  try {
    const [publishedPackage, publicLand] = await Promise.all([
      state.regionPackages.get(region) || loadRegionSpotPackage(region),
      state.publicLands.get(region) || loadRegionPublicLand(region),
    ]);
    if (request !== regionRequest) return;
    state.regionPackages.set(region, publishedPackage);
    state.publicLands.set(region, publicLand);
    state.package = publishedPackage;
    state.publicLand = publicLand;
    await saveState('package', publishedPackage);
    render();
    spotMode.showRegionDetail(spotId, fitRegion);
    if (!automatic) {
      showToast(`${regionInfo.name} loaded · ${regionInfo.eligible_cells} ranked areas.`);
    }
  } catch (error) {
    showToast(error.message);
  }
}

async function updateMapDetail({ zoom, center }) {
  if (state.package?.package_type !== 'ranked_spots'
    || !state.regionManifest?.regions.length) return;
  if (zoom < REGION_DETAIL_ZOOM) {
    regionRequest++;
    spotMode.showOverview(false);
    return;
  }
  const region = nearestMapRegion(state.regionManifest.regions, center);
  if (region) {
    await switchRegion(region.key, null, { automatic: true, fitRegion: false });
  }
}

async function loadDenmarkOverview() {
  if (!state.regionManifest?.regions.length) return;
  state.overviewSpots = state.regionManifest.regions.flatMap(
    (region) => region.overview_spots || [],
  );
  const totalAreas = state.regionManifest.regions.reduce(
    (sum, region) => sum + region.eligible_cells,
    0,
  );
  render();
  showToast(
    `${state.regionManifest.regions.length} regions ready · ${totalAreas} total areas.`,
  );
}
async function startVisit() {
  const visit = currentVisit();
  state.active = {
    visit_id: visit.visit_id,
    started_at: Date.now(),
    duration_seconds: (state.package.minutes_per_visit || 30) * 60,
  };
  state.track = [];
  await saveState('active', state.active);
  requestLocation(true);
  clearInterval(state.timerId);
  state.timerId = setInterval(tick, 1000);
  render();
}
function stopTracking() {
  if (state.watchId != null) navigator.geolocation.clearWatch(state.watchId);
  state.watchId = null;
  clearInterval(state.timerId);
  state.timerId = null;
}
function openResult() {
  ui.form.reset();
  ui.dialog.showModal();
}
async function saveResult(event) {
  event.preventDefault();
  const visit = currentVisit();
  const data = new FormData(ui.form);
  const photo = data.get('photo');
  const result = createFieldResult(visit, {
    detected: data.get('detected') === 'yes',
    cluster_count: data.get('clusters'),
    exploratory_species: data.getAll('species'),
    dominant_tree: data.get('tree'),
    moss_cover: data.get('moss'),
    wetness: data.get('wetness'),
    weather: data.get('weather'),
    deviations: data.get('deviations'),
    track: state.track,
    photo_name: photo?.size ? photo.name : null,
    started_at: new Date(state.active.started_at).toISOString(),
    search_duration_seconds: Math.floor((Date.now() - state.active.started_at) / 1000),
    allotted_duration_seconds: state.active.duration_seconds,
  });
  state.results = state.results.filter((item) => item.visit_id !== visit.visit_id);
  state.results.push(result);
  if (photo?.size) await savePhoto(visit.visit_id, photo);
  state.active = null;
  state.track = [];
  await saveState('results', state.results);
  await saveState('active', null);
  stopTracking();
  ui.dialog.close();
  const next = state.package.visits.findIndex(
    (candidate) => !completedIds().has(candidate.visit_id),
  );
  if (next >= 0) state.index = next;
  render();
  showToast('Result saved on this phone.');
}
async function replacePair(event) {
  event.preventDefault();
  const data = new FormData(ui.replaceForm);
  const output = activateReplacementPair(
    state.package, currentVisit().visit_id, data.get('reason'), new Date().toISOString(),
  );
  state.package = output.fieldPackage;
  state.exclusions.push(output.exclusion);
  state.index = state.package.visits.findIndex(
    ({ pair_id: pairId }) => pairId === output.exclusion.replacement_pair_id,
  );
  await saveState('package', state.package);
  await saveState('exclusions', state.exclusions);
  ui.replaceDialog.close();
  ui.replaceForm.reset();
  render();
  showToast('Replacement pair activated and reason recorded.');
}
function downloadFile(file) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
async function exportResults() {
  const body = {
    schema_version: 1,
    evaluation_id: state.package.evaluation_id,
    exported_at: new Date().toISOString(),
    results: state.results,
    exclusions: state.exclusions,
  };
  const files = [new File(
    [JSON.stringify(body, null, 2)],
    'svampespot-field-results.json',
    { type: 'application/json' },
  )];
  for (const result of state.results) {
    if (!result.photo_name) continue;
    const photo = await loadPhoto(result.visit_id);
    if (photo) files.push(new File([photo], result.visit_id + '-' + result.photo_name, {
      type: photo.type || 'image/jpeg',
    }));
  }
  if (navigator.canShare?.({ files })) {
    await navigator.share({ title: 'Svampespot field results', files });
  } else {
    files.forEach(downloadFile);
  }
}
async function initialize() {
  const storedPackage = await loadState('package') || null;
  try {
    state.regionManifest = await loadRegionManifest();
  } catch {
    // A stored or manually imported package can still work without the region list.
  }
  const preferredRegion = storedPackage?.package_type === 'ranked_spots'
    && state.regionManifest?.regions.some(({ key }) => key === storedPackage.region)
    ? storedPackage.region
    : state.regionManifest?.default_region || 'silkeborg';
  let publishedPackage = null;
  try {
    [publishedPackage, state.publicLand] = await Promise.all([
      loadRegionSpotPackage(preferredRegion),
      loadRegionPublicLand(preferredRegion),
    ]);
  } catch {
    // Keep the stored package or import screen when the public package is unavailable.
  }
  state.package = chooseInitialPackage(storedPackage, publishedPackage);
  if (publishedPackage) state.regionPackages.set(preferredRegion, publishedPackage);
  if (state.publicLand) state.publicLands.set(preferredRegion, state.publicLand);
  if (state.package && state.package !== storedPackage) {
    await saveState('package', state.package);
  }
  state.results = await loadState('results') || [];
  state.exclusions = await loadState('exclusions') || [];
  state.active = await loadState('active') || null;
  if (state.active && state.package?.package_type !== 'ranked_spots') {
    state.index = Math.max(0, state.package?.visits.findIndex(
      ({ visit_id: visitId }) => visitId === state.active.visit_id,
    ) || 0);
    requestLocation(true);
    state.timerId = setInterval(tick, 1000);
  }
  if (state.package?.package_type === 'ranked_spots'
    && state.regionManifest?.regions.length) {
    await loadDenmarkOverview().catch(() => {
      render();
      showToast('Some regions could not be loaded. The selected region still works.');
    });
  } else {
    render();
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=2026-08-17-14', {
      updateViaCache: 'none',
    }).then((registration) => registration.update()).catch(() => {});
  }
}

fieldMap.onViewChanged((view) => {
  updateMapDetail(view).catch(() => {
    showToast('Could not load nearby map detail. The Denmark overview still works.');
  });
});

ui.importButton.addEventListener('click', () => ui.input.click());
ui.input.addEventListener('change', () => ui.input.files[0] && importPackage(ui.input.files[0])
  .catch((error) => showToast(error.message)));
ui.locate.addEventListener('click', () => requestLocation(false));
ui.start.addEventListener('click', startVisit);
ui.finish.addEventListener('click', openResult);
ui.replace.addEventListener('click', () => ui.replaceDialog.showModal());
ui.replaceForm.addEventListener('submit', replacePair);
ui.closeReplacement.addEventListener('click', () => ui.replaceDialog.close());
ui.form.addEventListener('submit', saveResult);
ui.closeDialog.addEventListener('click', () => ui.dialog.close());
ui.previous.addEventListener('click', () => { state.index--; render(); });
ui.next.addEventListener('click', () => { state.index++; render(); });
ui.export.addEventListener('click', () => exportResults().catch(
  () => showToast('Export failed. Try again while the app is open.'),
));
initialize().catch((error) => showToast(error.message));
