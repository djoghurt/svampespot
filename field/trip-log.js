const finiteCoordinate = (value) => Array.isArray(value)
  && value.length === 2
  && value.every(Number.isFinite);

const cleanText = (value) => String(value || '').trim();
const cleanOptional = (value) => cleanText(value) || null;
const clampInteger = (value, minimum, maximum) => Math.max(
  minimum,
  Math.min(maximum, Math.round(Number(value) || 0)),
);

function newLogId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `trip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizedPosition(position) {
  if (!finiteCoordinate(position?.coordinates)) return { available: false };
  const accuracy = Number(position.accuracy_m);
  return {
    available: true,
    coordinates: [...position.coordinates],
    accuracy_m: Number.isFinite(accuracy) ? Math.max(0, Math.round(accuracy)) : null,
  };
}

function normalizedRain(weather) {
  const source = { provider: 'Open-Meteo', model: 'dmi_seamless' };
  if (!weather || !Number.isFinite(Number(weather.rain_7d_mm))
    || !Number.isFinite(Number(weather.rain_30d_mm))) {
    return { available: false, ...source };
  }
  return {
    available: true,
    ...source,
    parameter: 'daily precipitation_sum',
    sample_resolution: 'roughly 2 km model sample',
    rain_7d_mm: Number(weather.rain_7d_mm),
    rain_30d_mm: Number(weather.rain_30d_mm),
    days_since_5mm_rain: weather.days_since_5mm_rain == null
      ? null : Math.max(0, Number(weather.days_since_5mm_rain)),
    moisture_factor: Number.isFinite(Number(weather.moisture_factor))
      ? Number(weather.moisture_factor) : null,
    label: cleanOptional(weather.label),
  };
}

function normalizedPotential(value) {
  if (!value?.status || !value?.tier) return null;
  return { label: cleanText(value.status), tier: cleanText(value.tier) };
}

function normalizedSpecies(values) {
  return [...new Set((values || []).map(cleanText).filter(Boolean))];
}

export function createTripLog(spot, context = {}, values = {}) {
  if (!spot?.spot_id || !spot.cell_id || !spot.region || !finiteCoordinate(spot.center)) {
    throw new Error('A ranked spot is required to log a visit');
  }
  const detected = Boolean(values.detected);
  const topPercent = Number.isInteger(spot.top_percent) ? spot.top_percent : null;
  return {
    schema_version: 1,
    log_type: 'ranked_spot_visit',
    selection_basis: 'user_selected_visible_ranking',
    controlled_validation: false,
    log_id: cleanText(values.log_id) || newLogId(),
    recorded_at: values.recorded_at || new Date().toISOString(),
    spot_id: spot.spot_id,
    cell_id: spot.cell_id,
    region: spot.region,
    forest_name: cleanOptional(spot.forest_name),
    spot_center: [...spot.center],
    position: normalizedPosition(context.position),
    prediction: {
      experimental: true,
      package_generated_at: cleanOptional(context.package_generated_at),
      habitat: {
        standing: topPercent == null ? null : 101 - topPercent,
        rank: Number.isInteger(spot.rank) ? spot.rank : null,
        top_percent: topPercent,
        tier: cleanOptional(spot.rank_tier),
      },
      current_potential: normalizedPotential(context.current_potential),
      recent_rain: normalizedRain(context.weather),
    },
    target: {
      key: 'tragt-kantarel',
      scientific_name: 'Craterellus tubaeformis',
      detected,
      cluster_count: detected ? clampInteger(values.cluster_count, 0, 50) : 0,
    },
    search_duration_minutes: clampInteger(values.search_duration_minutes, 0, 480),
    other_species: normalizedSpecies(values.other_species),
    other_species_notes: cleanOptional(values.other_species_notes),
    dominant_tree: cleanOptional(values.dominant_tree),
    moss_cover: cleanOptional(values.moss_cover),
    wetness: cleanOptional(values.wetness),
    field_weather: cleanOptional(values.field_weather),
    notes: cleanText(values.notes),
    photo_name: cleanOptional(values.photo_name),
  };
}

export function createTripLogExport(logs, exportedAt = new Date().toISOString()) {
  if (!Array.isArray(logs) || logs.some((log) => (
    log?.schema_version !== 1 || log.log_type !== 'ranked_spot_visit' || !log.log_id
  ))) {
    throw new Error('Trip-log export requires valid ranked-spot visits');
  }
  return {
    schema_version: 1,
    export_type: 'svampespot_exploratory_trip_logs',
    exported_at: exportedAt,
    evidence: {
      suitable_for_development: true,
      controlled_validation: false,
      limitation: 'Locations were selected from visible recommendations, not blinded controls.',
    },
    logs,
  };
}

export function tripLogStatusForSpot(logs, spotId) {
  const matching = (logs || []).filter(({ spot_id: id }) => id === spotId);
  if (!matching.length) return { count: 0, target_found: false, latest_at: null };
  return {
    count: matching.length,
    target_found: matching.some((log) => Boolean(log.target?.detected)),
    latest_at: matching.reduce((latest, log) => (
      String(log.recorded_at) > String(latest) ? log.recorded_at : latest
    ), matching[0].recorded_at),
  };
}
