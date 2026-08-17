import { fetchRainHistory } from './weather.js';
import { formatRankSummary, formatRegionEvidence, rankTierLabel } from './rank-display.js';

const element = (id) => document.getElementById(id);

export function createSpotMode({
  fieldMap, packageInput, onSelectionChanged, onRegionChanged, showToast,
}) {
  const ui = {
    state: element('spotState'), mode: element('modeLabel'), progress: element('spotProgress'),
    title: element('spotTitle'), rank: element('spotRank'), evidence: element('spotEvidence'),
    rainLabel: element('rainLabel'),
    rain7: element('rain7'), rain30: element('rain30'), lastRain: element('lastRain'),
    apple: element('spotAppleMaps'), google: element('spotGoogleMaps'),
    previous: element('previousSpot'), next: element('nextSpot'), all: element('showAllSpots'),
    change: element('changePackage'), region: element('regionSelect'),
    regionEvidence: element('regionEvidence'),
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
    ui.evidence.textContent = 'Relative habitat rank within this region · not a probability';
    ui.regionEvidence.textContent = formatRegionEvidence(regionInfo?.evidence);
    ui.region.value = spotPackage.region;
    const mapSpots = overviewSpots?.length ? overviewSpots : spotPackage.spots;
    ui.all.textContent = overviewSpots?.length
      ? `Show all regions · ${overviewSpots.length} areas`
      : `Show all ${total} areas`;
    ui.previous.disabled = index === 0;
    ui.next.disabled = index === spotPackage.spots.length - 1;
    navigationLinks(spot);
    fieldMap.showSpots(mapSpots, spot.spot_id, selectSpot, fitAll, publicLand);
    fitAll = false;
    updateWeather(spot);
  }

  function activate(value, context = {}) {
    active = true;
    publicLand = context.publicLand || null;
    regionInfo = context.regionInfo || null;
    overviewSpots = context.overviewSpots || null;
    if (spotPackage !== value) {
      spotPackage = value;
      index = 0;
      fitAll = !overviewSpots;
      weather.clear();
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
    ui.region.replaceChildren(...regions.map((region) => {
      const option = document.createElement('option');
      option.value = region.key;
      option.textContent = `${region.name} · ${region.eligible_cells}`;
      return option;
    }));
  }

  function setRegionLoading(loading) {
    ui.region.disabled = loading;
  }

  function restoreRegionSelection() {
    if (spotPackage) ui.region.value = spotPackage.region;
  }

  ui.previous.addEventListener('click', () => selectSpot(spotPackage.spots[index - 1].spot_id));
  ui.next.addEventListener('click', () => selectSpot(spotPackage.spots[index + 1].spot_id));
  ui.all.addEventListener('click', () => { fitAll = true; render(); });
  ui.change.addEventListener('click', () => packageInput.click());
  ui.region.addEventListener('change', () => onRegionChanged(ui.region.value));

  return {
    activate, deactivate, currentCenter, restoreRegionSelection, selectSpot,
    setRegionLoading, setRegions,
  };
}
