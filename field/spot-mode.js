import { fetchRainHistory } from './weather.js';
import {
  formatRankSummary, formatRegionEvidence, rankTierLabel,
} from './rank-display.js?v=2026-08-17-13';

const element = (id) => document.getElementById(id);

export function createSpotMode({
  detailZoom, fieldMap, packageInput, onSelectionChanged, onRegionChanged, showToast,
}) {
  const ui = {
    state: element('spotState'), mode: element('modeLabel'), progress: element('spotProgress'),
    title: element('spotTitle'), rank: element('spotRank'), evidence: element('spotEvidence'),
    rainLabel: element('rainLabel'),
    rain7: element('rain7'), rain30: element('rain30'), lastRain: element('lastRain'),
    apple: element('spotAppleMaps'), google: element('spotGoogleMaps'),
    previous: element('previousSpot'), next: element('nextSpot'), all: element('showAllSpots'),
    change: element('changePackage'), regionEvidence: element('regionEvidence'),
  };
  let spotPackage = null;
  let index = 0;
  let fitAll = true;
  let active = false;
  let weatherRequest = 0;
  let publicLand = null;
  let regionInfo = null;
  let regions = [];
  let overviewSpots = null;
  let mapSpots = null;
  let overviewMode = false;
  let focusSelected = true;
  const weather = new Map();

  const currentSpot = () => spotPackage?.spots[index] || null;
  const currentCenter = () => active ? currentSpot()?.center || null : null;

  function navigationLinks(spot) {
    const destination = spot.center[1] + ',' + spot.center[0];
    ui.apple.href = 'https://maps.apple.com/?daddr=' + destination + '&dirflg=d';
    ui.google.href = 'https://www.google.com/maps/dir/?api=1&destination=' + destination
      + '&travelmode=driving';
  }

  function showWeather(summary) {
    ui.rainLabel.textContent = summary.label;
    ui.rain7.textContent = summary.rain_7d_mm + ' mm';
    ui.rain30.textContent = summary.rain_30d_mm + ' mm';
    ui.lastRain.textContent = summary.days_since_5mm_rain == null
      ? 'None in 30 days'
      : summary.days_since_5mm_rain + ' days ago';
  }

  async function updateWeather(spot) {
    const request = ++weatherRequest;
    ui.rainLabel.textContent = 'Checking recent rain…';
    ui.rain7.textContent = '—';
    ui.rain30.textContent = '—';
    ui.lastRain.textContent = '—';
    try {
      const summary = weather.get(spot.spot_id) || await fetchRainHistory(spot.center);
      weather.set(spot.spot_id, summary);
      if (request === weatherRequest && currentSpot()?.spot_id === spot.spot_id) {
        showWeather(summary);
      }
    } catch {
      if (request === weatherRequest) {
        ui.rainLabel.textContent = 'Rain history unavailable';
        showToast('Could not load local rain history. Habitat spots still work.');
      }
    }
  }

  function selectSpot(spotId) {
    const nextIndex = spotPackage.spots.findIndex(({ spot_id: id }) => id === spotId);
    if (nextIndex < 0) {
      const overviewSpot = overviewSpots?.find(({ spot_id: id }) => id === spotId);
      if (overviewSpot?.region && overviewSpot.region !== spotPackage.region) {
        onRegionChanged(overviewSpot.region, spotId);
      }
      return;
    }
    overviewMode = false;
    mapSpots = spotPackage.spots;
    focusSelected = true;
    index = nextIndex;
    fitAll = false;
    render();
    onSelectionChanged();
  }

  function render() {
    const spot = currentSpot();
    if (!spot) return;
    const total = spotPackage.ranking?.total_eligible || spotPackage.spots.length;
    ui.progress.textContent = formatRankSummary(spot, total);
    ui.title.textContent = spot.forest_name || regionInfo?.name || 'Forest area';
    ui.rank.textContent = rankTierLabel(spot.rank_tier);
    ui.evidence.textContent = overviewSpots?.length && overviewMode
      ? '12-region overview · zoom in to reveal every ranked area nearby'
      : overviewSpots?.length
        ? 'All areas in selected region · ranks within region'
      : 'Relative habitat rank within this region · not a probability';
    ui.regionEvidence.textContent = formatRegionEvidence(regionInfo?.evidence);
    const totalAreas = regions.reduce((sum, region) => sum + region.eligible_cells, 0);
    ui.all.textContent = overviewSpots?.length && overviewMode
      ? `Zoom into ${regionInfo?.name || 'selected region'}`
      : overviewSpots?.length
        ? `Show Denmark overview · ${totalAreas} areas`
      : `Show all ${total} areas`;
    ui.previous.disabled = index === 0;
    ui.next.disabled = index === spotPackage.spots.length - 1;
    navigationLinks(spot);
    fieldMap.showSpots(
      mapSpots || spotPackage.spots,
      spot.spot_id,
      selectSpot,
      fitAll,
      overviewMode ? null : publicLand,
      focusSelected,
      overviewMode ? null : detailZoom,
    );
    fitAll = false;
    updateWeather(spot);
  }

  function activate(value, context = {}) {
    const wasActive = active;
    active = true;
    publicLand = context.publicLand || null;
    regionInfo = context.regionInfo || null;
    const nextOverview = context.overviewSpots || null;
    const packageChanged = spotPackage !== value;
    const overviewChanged = overviewSpots !== nextOverview;
    overviewSpots = nextOverview;
    if (packageChanged) {
      spotPackage = value;
      index = 0;
      if (!wasActive) overviewMode = Boolean(overviewSpots?.length);
      fitAll = overviewMode || !overviewSpots;
      weather.clear();
    }
    if (packageChanged || overviewChanged) {
      mapSpots = overviewMode ? overviewSpots : value.spots;
    }
    ui.state.hidden = false;
    ui.mode.textContent = 'Habitat scout';
    render();
  }

  function deactivate() {
    active = false;
    ui.state.hidden = true;
    ui.mode.textContent = 'Field pilot';
  }

  function setRegions(values) {
    if (regions === values) return;
    regions = values;
  }

  function showRegionDetail(spotId = null, fitRegion = true) {
    if (!overviewMode && !spotId && !fitRegion) return;
    overviewMode = false;
    mapSpots = spotPackage.spots;
    fitAll = fitRegion && !spotId;
    focusSelected = Boolean(spotId);
    render();
    if (spotId) selectSpot(spotId);
  }

  function showOverview(fitDenmark = false) {
    if (overviewMode && !fitDenmark) return;
    overviewMode = true;
    mapSpots = overviewSpots;
    fitAll = fitDenmark;
    focusSelected = false;
    render();
  }

  ui.previous.addEventListener('click', () => selectSpot(spotPackage.spots[index - 1].spot_id));
  ui.next.addEventListener('click', () => selectSpot(spotPackage.spots[index + 1].spot_id));
  ui.all.addEventListener('click', () => {
    if (overviewSpots?.length) {
      overviewMode = !overviewMode;
      mapSpots = overviewMode ? overviewSpots : spotPackage.spots;
    }
    fitAll = true;
    focusSelected = false;
    render();
  });
  ui.change.addEventListener('click', () => packageInput.click());

  return {
    activate, deactivate, currentCenter, selectSpot,
    showOverview, showRegionDetail,
    setRegions,
  };
}
