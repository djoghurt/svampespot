const finiteCoordinate = (value) => Array.isArray(value)
  && value.length === 2
  && value.every(Number.isFinite);

export function validateFieldPackage(value) {
  if (value?.schema_version !== 1 || !Array.isArray(value.visits)) {
    throw new Error('This is not a Svampespot v3 field package');
  }
  const seen = new Set();
  const validateVisit = (visit) => {
    if ('arm' in visit || 'score' in visit) {
      throw new Error('Field package contains private assignment data');
    }
    if (!visit.visit_id || seen.has(visit.visit_id)) {
      throw new Error('Field visits require unique visit IDs');
    }
    seen.add(visit.visit_id);
    if (!visit.cell_id || !visit.region || !finiteCoordinate(visit.approach_point)) {
      throw new Error('Field visit is missing its cell, region, or approach point');
    }
    if (!visit.geometry || !['Polygon', 'MultiPolygon'].includes(visit.geometry.type)) {
      throw new Error('Field visit requires a target polygon');
    }
  };
  for (const visit of value.visits) validateVisit(visit);
  for (const pair of value.replacement_pairs || []) {
    if (!Number.isInteger(pair.order) || !pair.region || pair.visits?.length !== 2) {
      throw new Error('Replacement pairs require an order, region, and two visits');
    }
    for (const visit of pair.visits) validateVisit(visit);
  }
  return value;
}

export function validateSpotPackage(value) {
  if (value?.schema_version !== 1 || value.package_type !== 'ranked_spots'
    || !Array.isArray(value.spots) || !value.experimental) {
    throw new Error('This is not a Svampespot ranked-spots package');
  }
  const seen = new Set();
  for (const spot of value.spots) {
    if ('score' in spot || 'arm' in spot || 'model' in spot) {
      throw new Error('Spot package contains private model data');
    }
    if (!spot.spot_id || seen.has(spot.spot_id) || !spot.cell_id || !spot.region) {
      throw new Error('Ranked spots require unique IDs, cells, and regions');
    }
    seen.add(spot.spot_id);
    if (!Number.isInteger(spot.rank) || spot.rank < 1 || !finiteCoordinate(spot.center)) {
      throw new Error('Ranked spot requires a rank and area marker');
    }
    if (!spot.geometry || !['Polygon', 'MultiPolygon'].includes(spot.geometry.type)) {
      throw new Error('Ranked spot requires a target polygon');
    }
  }
  return value;
}

export function validateImportedPackage(value) {
  return value?.package_type === 'ranked_spots'
    ? validateSpotPackage(value)
    : validateFieldPackage(value);
}

export function activateReplacementPair(value, visitId, reason, recordedAt) {
  const fieldPackage = validateFieldPackage(value);
  const visit = fieldPackage.visits.find(({ visit_id: id }) => id === visitId);
  if (!visit) throw new Error('Current visit is not in the field package');
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) throw new Error('Record the access or safety reason');
  const replacement = (fieldPackage.replacement_pairs || [])
    .find(({ region }) => region === visit.region);
  if (!replacement) throw new Error('No replacement pair remains for this forest');
  const pairId = visit.pair_id;
  const replacementPairId = replacement.visits[0].pair_id;
  return {
    fieldPackage: {
      ...fieldPackage,
      visits: fieldPackage.visits.filter(({ pair_id: id }) => id !== pairId)
        .concat(replacement.visits),
      replacement_pairs: fieldPackage.replacement_pairs.filter((pair) => pair !== replacement),
    },
    exclusion: {
      schema_version: 1,
      pair_id: pairId,
      region: visit.region,
      reason: cleanReason,
      recorded_at: recordedAt || new Date().toISOString(),
      replacement_pair_id: replacementPairId,
    },
  };
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return Math.max(0, Math.round(meters / 10) * 10) + ' m';
  return (meters / 1000).toFixed(1) + ' km';
}

export function distanceMeters([lonA, latA], [lonB, latB]) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(latB - latA);
  const dLon = radians(lonB - lonA);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(latA)) * Math.cos(radians(latB)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingDegrees([lonA, latA], [lonB, latB]) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const degrees = (value) => value * 180 / Math.PI;
  const dLon = radians(lonB - lonA);
  const y = Math.sin(dLon) * Math.cos(radians(latB));
  const x = Math.cos(radians(latA)) * Math.sin(radians(latB))
    - Math.sin(radians(latA)) * Math.cos(radians(latB)) * Math.cos(dLon);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

export function formatTimer(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  return String(Math.floor(safe / 60)).padStart(2, '0')
    + ':' + String(safe % 60).padStart(2, '0');
}

export function createFieldResult(visit, values) {
  return {
    schema_version: 1,
    visit_id: visit.visit_id,
    pair_id: visit.pair_id,
    region: visit.region,
    cell_id: visit.cell_id,
    completed_at: values.completed_at || new Date().toISOString(),
    started_at: values.started_at || null,
    search_duration_seconds: Math.max(0, Number(values.search_duration_seconds) || 0),
    allotted_duration_seconds: Math.max(0, Number(values.allotted_duration_seconds) || 0),
    detected: Boolean(values.detected),
    cluster_count: Math.max(0, Math.min(50, Number(values.cluster_count) || 0)),
    exploratory_species: values.exploratory_species || [],
    dominant_tree: values.dominant_tree || null,
    moss_cover: values.moss_cover || null,
    wetness: values.wetness || null,
    weather: values.weather || null,
    deviations: String(values.deviations || '').trim(),
    track: Array.isArray(values.track) ? values.track : [],
    photo_name: values.photo_name || null,
  };
}
