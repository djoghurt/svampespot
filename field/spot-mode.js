import {
  fetchRainGrid, fetchRainHistory, nearestWeatherSample, weatherGridPoints,
} from './weather.js?v=2026-08-18-02';
import {
  DEFAULT_MAP_MODE, MAP_MODES, currentPotentialPresentation, mapModePresentation,
} from './map-modes.js?v=2026-08-18-02';
import {
  formatRankSummary, formatRegionEvidence, rankTierLabel,
} from './rank-display.js?v=2026-08-18-02';

const element = (id) => document.getElementById(id);

export async function firstRainResult(selectedRequest, gridRequest, center) {
  return Promise.any([
    Promise.resolve(selectedRequest).then((summary) => {
      if (!summary) throw new Error('Selected weather is unavailable');
      return { summary, samples: null };
    }),
    Promise.resolve(gridRequest).then((samples) => {
      const summary = nearestWeatherSample(samples, center);
      if (!summary) throw new Error('Regional weather is unavailable');
      return { summary, samples };
    }),
  ]);
}

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
    modeButtons: [...document.querySelectorAll('[data-map-mode]')],
    notice: element('mapModeNotice'), noticeTitle: element('mapModeNoticeTitle'),
    noticeBody: element('mapModeNoticeBody'), rainCard: document.querySelector('.rain-card'),
    destinations: document.querySelector('#spotState .destination-actions'),
    currentPotentialBadge: element('currentPotentialMapBadge'),
    currentPotentialLegend: element('currentPotentialLegend'),
    rankLegend: element('rankLegend'),
    moistureLegend: element('moistureLegend'),
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
  let mapMode = DEFAULT_MAP_MODE;
  let selectedWeather = null;
  const weather = new Map();

  const currentSpot = () => spotPackage?.spots[index] || null;
  const currentCenter = () => active ? currentSpot()?.center || null : null;
  const currentWeather = () => selectedWeather ? { ...selectedWeather } : null;
  const currentPotential = () => {
    const value = currentPotentialPresentation(currentSpot(), selectedWeather);
    return value ? { ...value } : null;
  };

  function navigationLinks(spot) {
    const destination = spot.center[1] + ',' + spot.center[0];
    ui.apple.href = 'https://maps.apple.com/?daddr=' + destination + '&dirflg=d';
    ui.google.href = 'https://www.google.com/maps/dir/?api=1&destination=' + destination
      + '&travelmode=driving';
  }

  function showWeather(summary) {
    selectedWeather = { ...summary };
    ui.rainLabel.textContent = summary.label;
    ui.rain7.textContent = summary.rain_7d_mm + ' mm';
    ui.rain30.textContent = summary.rain_30d_mm + ' mm';
    ui.lastRain.textContent = summary.days_since_5mm_rain == null
      ? 'None in 30 days'
      : summary.days_since_5mm_rain + ' days ago';
  }

  function habitatEvidence() {
    return overviewSpots?.length && overviewMode
      ? '12-region overview · zoom in to reveal every ranked area nearby'
      : overviewSpots?.length
        ? 'All areas in selected region · ranks within region'
        : 'Relative habitat within this region · higher is better · not a probability';
  }

  function showHabitatSummary() {
    const spot = currentSpot();
    if (!spot) return;
    ui.rank.textContent = rankTierLabel(spot.rank_tier);
    ui.evidence.textContent = habitatEvidence();
  }

  function potentialValues(spots, samples) {
    return (spots || []).map((spot) => {
      const summary = nearestWeatherSample(samples, spot.center);
      return {
        spot_id: spot.spot_id,
        potential: currentPotentialPresentation(spot, summary),
      };
    }).filter(({ potential }) => potential);
  }

  function showCurrentPotential(spot, summary) {
    const potential = currentPotentialPresentation(spot, summary);
    if (!potential) throw new Error('Current potential is unavailable');
    ui.currentPotentialBadge.textContent = potential.status;
    ui.currentPotentialBadge.dataset.tier = potential.tier;
    ui.rank.textContent = potential.status;
    ui.evidence.textContent = potential.detail;
    return potential;
  }

  function showRegionalWeather(spot, weatherSpots, samples) {
    const summary = nearestWeatherSample(samples, spot.center);
    if (!summary) throw new Error('No regional weather samples');
    showWeather(summary);
    if (mapMode === MAP_MODES.currentPotential) {
      const scoredSpots = weatherSpots.some(({ spot_id: spotId }) => spotId === spot.spot_id)
        ? weatherSpots : [...weatherSpots, spot];
      fieldMap.showCurrentPotential(potentialValues(scoredSpots, samples));
      showCurrentPotential(spot, summary);
    } else {
      fieldMap.showWeatherGrid(samples);
      ui.moistureLegend.innerHTML = `<strong>${summary.label}</strong><span>${samples.length} DMI model samples · roughly 2 km</span>`;
    }
  }

  async function updateWeather(spot) {
    const request = ++weatherRequest;
    selectedWeather = null;
    const weatherSpots = overviewMode ? overviewSpots : spotPackage.spots;
    const cacheKey = `${overviewMode ? 'overview' : spotPackage.region}:${spotPackage.generated_at}`;
    let gridRequest = weather.get(cacheKey);
    const cachedSamples = Array.isArray(gridRequest) ? gridRequest : null;
    if (cachedSamples) {
      showRegionalWeather(spot, weatherSpots, cachedSamples);
      return;
    }
    ui.rainLabel.textContent = 'Checking DMI rain history…';
    ui.rain7.textContent = '—';
    ui.rain30.textContent = '—';
    ui.lastRain.textContent = '—';
    try {
      if (!gridRequest) {
        gridRequest = fetchRainGrid(weatherGridPoints(weatherSpots));
        weather.set(cacheKey, gridRequest);
      }
      const selectedRequest = fetchRainHistory(spot.center);
      const first = await firstRainResult(selectedRequest, gridRequest, spot.center);
      const isCurrent = () => request === weatherRequest
        && [MAP_MODES.currentPotential, MAP_MODES.recentMoisture].includes(mapMode)
        && currentSpot()?.spot_id === spot.spot_id;
      if (!isCurrent()) return;
      showWeather(first.summary);
      if (mapMode === MAP_MODES.currentPotential) {
        const potential = showCurrentPotential(spot, first.summary);
        fieldMap.showCurrentPotential([{ spot_id: spot.spot_id, potential }]);
      } else if (!first.samples) {
        ui.moistureLegend.innerHTML = '<strong>Local rain ready</strong><span>Loading regional rain map…</span>';
      }
      let samples;
      try {
        samples = first.samples || await gridRequest;
      } catch {
        weather.delete(cacheKey);
        if (isCurrent()) {
          ui.moistureLegend.innerHTML = '<strong>Regional rain unavailable</strong><span>Selected area still works</span>';
          showToast('Selected-area rain loaded, but the regional rain map did not.');
        }
        return;
      }
      weather.set(cacheKey, samples);
      if (!isCurrent()) return;
      showRegionalWeather(spot, weatherSpots, samples);
    } catch {
      weather.delete(cacheKey);
      if (request === weatherRequest) {
        selectedWeather = null;
        ui.rainLabel.textContent = 'Rain history unavailable';
        ui.moistureLegend.innerHTML = '<strong>Recent rain unavailable</strong><span>Habitat data still works</span>';
        fieldMap.clearWeatherRegion();
        fieldMap.showCurrentPotential([]);
        if (mapMode === MAP_MODES.currentPotential) {
          delete ui.currentPotentialBadge.dataset.tier;
          ui.currentPotentialBadge.textContent = 'Rain unavailable · showing habitat';
          showHabitatSummary();
          ui.evidence.textContent = 'Recent rain unavailable · showing habitat rank';
        }
        showToast('Could not load local rain history. Habitat spots still work.');
      }
    }
  }

  function renderMapMode() {
    const presentation = mapModePresentation(mapMode);
    document.body.dataset.mapMode = mapMode;
    ui.state.dataset.mapMode = mapMode;
    ui.mode.textContent = presentation.modeLabel;
    ui.notice.hidden = !presentation.showNotice;
    ui.noticeTitle.textContent = presentation.noticeTitle;
    ui.noticeBody.textContent = presentation.noticeBody;
    ui.rainCard.hidden = !presentation.showRain;
    ui.destinations.hidden = !presentation.allowNavigation;
    ui.currentPotentialBadge.hidden = mapMode !== MAP_MODES.currentPotential;
    ui.currentPotentialLegend.hidden = mapMode !== MAP_MODES.currentPotential;
    ui.rankLegend.hidden = mapMode !== MAP_MODES.habitat;
    ui.moistureLegend.hidden = mapMode !== MAP_MODES.recentMoisture;
    ui.modeButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.mapMode === mapMode));
    });
    fieldMap.setDisplayMode(mapMode);
    if (mapMode === MAP_MODES.currentPotential) {
      delete ui.currentPotentialBadge.dataset.tier;
      ui.currentPotentialBadge.textContent = 'Checking current potential…';
      ui.rank.textContent = 'Checking rain…';
      ui.evidence.textContent = 'Combining habitat rank with recent moisture';
    } else {
      showHabitatSummary();
    }
  }

  function setMapMode(nextMode) {
    mapModePresentation(nextMode);
    mapMode = nextMode;
    weatherRequest += 1;
    renderMapMode();
    fieldMap.clearWeatherRegion();
    if ([MAP_MODES.currentPotential, MAP_MODES.recentMoisture].includes(mapMode)
      && currentSpot()) updateWeather(currentSpot());
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
    showHabitatSummary();
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
    renderMapMode();
    fieldMap.clearWeatherRegion();
    if ([MAP_MODES.currentPotential, MAP_MODES.recentMoisture].includes(mapMode)) {
      updateWeather(spot);
    }
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
    }
    if (packageChanged || overviewChanged) {
      mapSpots = overviewMode ? overviewSpots : value.spots;
    }
    ui.state.hidden = false;
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
  ui.modeButtons.forEach((button) => {
    button.addEventListener('click', () => setMapMode(button.dataset.mapMode));
  });

  return {
    activate, deactivate, currentCenter, currentPotential, currentSpot, currentWeather, selectSpot,
    showOverview, showRegionDetail,
    setRegions,
  };
}
