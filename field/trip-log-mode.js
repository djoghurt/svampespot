import {
  createTripLog, createTripLogExport, tripLogStatusForSpot,
} from './trip-log.js?v=2026-08-18-04';
import { loadPhoto, loadState, savePhoto, saveState } from './storage.js';

const element = (id) => document.getElementById(id);

function habitatLabel(spot) {
  return Number.isInteger(spot?.top_percent) ? `Habitat ${101 - spot.top_percent}/100` : 'Habitat unavailable';
}

function positionLabel(position) {
  if (!position?.coordinates) return 'Location unavailable';
  return position.accuracy_m == null
    ? 'Location recorded'
    : `Location recorded · ±${Math.round(position.accuracy_m)} m`;
}

function downloadFile(file) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function createTripLogMode({
  capturePosition, fieldMap, getPackage, getPosition, showToast, spotMode,
}) {
  const ui = {
    bar: element('fieldLogBar'), status: element('fieldLogStatus'),
    log: element('logSpotVisit'), history: element('openTripHistory'),
    dialog: element('tripLogDialog'), form: element('tripLogForm'),
    close: element('closeTripLog'), context: element('tripLogContext'),
    location: element('tripLocationStatus'), refresh: element('refreshTripLocation'),
    historyDialog: element('tripHistoryDialog'), historyList: element('tripHistoryList'),
    historySummary: element('tripHistorySummary'), closeHistory: element('closeTripHistory'),
    export: element('exportTripLogs'),
  };
  let active = false;
  let logs = [];
  let pending = null;
  let locationRequest = 0;
  let locationPromise = null;

  function updateMap() {
    fieldMap.showTripLogs(logs);
  }

  function renderSelected() {
    if (!active) return;
    const spot = spotMode.currentSpot();
    const status = tripLogStatusForSpot(logs, spot?.spot_id);
    ui.status.textContent = status.count === 0
      ? 'Not visited yet'
      : `${status.count} visit${status.count === 1 ? '' : 's'} · ${status.target_found ? 'target found' : 'no target yet'}`;
    ui.log.textContent = status.count ? 'Log another visit' : 'Log visit here';
    ui.history.textContent = `History · ${logs.length}`;
    ui.history.disabled = logs.length === 0;
    updateMap();
  }

  function showPosition(position) {
    ui.location.textContent = positionLabel(position);
  }

  async function refreshPosition() {
    const request = ++locationRequest;
    ui.location.textContent = 'Checking location…';
    locationPromise = Promise.resolve(capturePosition()).catch(() => null).then((position) => {
      if (request !== locationRequest) return pending?.position || null;
      pending.position = position;
      showPosition(position);
      return position;
    });
    return locationPromise;
  }

  function openLogger() {
    const spot = spotMode.currentSpot();
    if (!spot) return showToast('Select a ranked area before logging a visit.');
    const weather = spotMode.currentWeather();
    const potential = spotMode.currentPotential();
    pending = {
      spot: { ...spot },
      package_generated_at: getPackage()?.generated_at || null,
      weather: weather ? { ...weather } : null,
      current_potential: potential ? { ...potential } : null,
      position: getPosition(),
    };
    ui.form.reset();
    ui.form.elements.tripDuration.value = '30';
    ui.context.textContent = `${spot.forest_name || 'Selected forest area'} · ${habitatLabel(spot)} · ${weather?.label || 'Recent rain unavailable'}`;
    showPosition(pending.position);
    ui.dialog.showModal();
    refreshPosition();
  }

  async function saveLog(event) {
    event.preventDefault();
    if (!pending) return;
    await locationPromise;
    const data = new FormData(ui.form);
    const photo = data.get('tripPhoto');
    const log = createTripLog(pending.spot, {
      package_generated_at: pending.package_generated_at,
      weather: pending.weather,
      current_potential: pending.current_potential,
      position: pending.position,
    }, {
      detected: data.get('tripDetected') === 'yes',
      cluster_count: data.get('tripClusters'),
      search_duration_minutes: data.get('tripDuration'),
      other_species: data.getAll('tripSpecies'),
      other_species_notes: data.get('tripOtherSpecies'),
      dominant_tree: data.get('tripTree'),
      moss_cover: data.get('tripMoss'),
      wetness: data.get('tripWetness'),
      field_weather: data.get('tripFieldWeather'),
      notes: data.get('tripNotes'),
      photo_name: photo?.size ? photo.name : null,
    });
    logs.push(log);
    if (photo?.size) await savePhoto('trip-log:' + log.log_id, photo);
    await saveState('trip_logs', logs);
    pending = null;
    locationPromise = null;
    ui.dialog.close();
    renderSelected();
    showToast('Visit saved on this device.');
  }

  function historyCard(log) {
    const card = document.createElement('article');
    card.className = `trip-history-card${log.target?.detected ? ' target-found' : ''}`;
    const title = document.createElement('strong');
    title.textContent = log.target?.detected
      ? `Tragt-kantarel found · ${log.target.cluster_count} clusters`
      : 'No tragt-kantarel found';
    const details = document.createElement('span');
    const date = new Date(log.recorded_at);
    const dateLabel = Number.isNaN(date.getTime()) ? log.recorded_at : date.toLocaleString();
    details.textContent = [
      log.forest_name || log.region,
      dateLabel,
      log.prediction?.habitat?.standing == null
        ? null : `Habitat ${log.prediction.habitat.standing}/100`,
      log.prediction?.recent_rain?.label || 'Rain unavailable',
      `${log.search_duration_minutes} min`,
    ].filter(Boolean).join(' · ');
    card.append(title, details);
    return card;
  }

  function openHistory() {
    ui.historyList.replaceChildren();
    const sorted = [...logs].sort((left, right) => (
      String(right.recorded_at).localeCompare(String(left.recorded_at))
    ));
    ui.historySummary.textContent = `${logs.length} exploratory visit${logs.length === 1 ? '' : 's'} saved locally. Export regularly to keep a backup for development.`;
    sorted.forEach((log) => ui.historyList.append(historyCard(log)));
    ui.historyDialog.showModal();
  }

  async function exportLogs() {
    if (!logs.length) return showToast('There are no personal visits to export yet.');
    const body = createTripLogExport(logs);
    const files = [new File(
      [JSON.stringify(body, null, 2)],
      'svampespot-trip-logs.json',
      { type: 'application/json' },
    )];
    for (const log of logs) {
      if (!log.photo_name) continue;
      const photo = await loadPhoto('trip-log:' + log.log_id);
      if (photo) files.push(new File([photo], `${log.log_id}-${log.photo_name}`, {
        type: photo.type || 'image/jpeg',
      }));
    }
    if (navigator.canShare?.({ files })) {
      await navigator.share({ title: 'Svampespot personal trip logs', files });
    } else {
      files.forEach(downloadFile);
    }
  }

  async function initialize() {
    logs = await loadState('trip_logs') || [];
    updateMap();
  }

  function activate() {
    active = true;
    ui.bar.hidden = false;
    renderSelected();
  }

  function deactivate() {
    active = false;
    ui.bar.hidden = true;
  }

  ui.log.addEventListener('click', openLogger);
  ui.history.addEventListener('click', openHistory);
  ui.close.addEventListener('click', () => ui.dialog.close());
  ui.refresh.addEventListener('click', refreshPosition);
  ui.form.addEventListener('submit', (event) => saveLog(event).catch(
    () => showToast('Could not save this visit. Keep the app open and try again.'),
  ));
  ui.closeHistory.addEventListener('click', () => ui.historyDialog.close());
  ui.export.addEventListener('click', () => exportLogs().catch(
    () => showToast('Export failed. Keep the app open and try again.'),
  ));

  return { activate, deactivate, initialize, updateSelected: renderSelected };
}
