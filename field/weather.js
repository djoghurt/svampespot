const round = (value) => Math.round(value * 10) / 10;
const clamp = (value) => Math.max(0, Math.min(1, value));
const WEATHER_LATITUDE_STEP = 0.02;
const WEATHER_LONGITUDE_STEP = 0.032;
const WEATHER_BATCH_SIZE = 40;

function ramp(value, start, end, low, high) {
  if (value <= start) return low;
  if (value >= end) return high;
  return low + ((value - start) / (end - start)) * (high - low);
}

function validateCenter([longitude, latitude]) {
  if (![longitude, latitude].every(Number.isFinite)) {
    throw new Error('Weather requires a valid spot coordinate');
  }
  return [longitude, latitude];
}

export function buildWeatherUrl(center) {
  const [longitude, latitude] = validateCenter(center);
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: 'precipitation_sum',
    past_days: '30',
    forecast_days: '1',
    timezone: 'Europe/Copenhagen',
    models: 'dmi_seamless',
  });
  return url.toString();
}

export function weatherGridPoints(spots) {
  const points = new Map();
  for (const spot of spots || []) {
    const [longitude, latitude] = validateCenter(spot.center);
    const longitudeIndex = Math.round(longitude / WEATHER_LONGITUDE_STEP);
    const latitudeIndex = Math.round(latitude / WEATHER_LATITUDE_STEP);
    const gridId = `${longitudeIndex}:${latitudeIndex}`;
    if (points.has(gridId)) continue;
    const center = [
      Number((longitudeIndex * WEATHER_LONGITUDE_STEP).toFixed(6)),
      Number((latitudeIndex * WEATHER_LATITUDE_STEP).toFixed(6)),
    ];
    points.set(gridId, {
      grid_id: gridId,
      center,
      bounds: [
        [center[1] - WEATHER_LATITUDE_STEP / 2, center[0] - WEATHER_LONGITUDE_STEP / 2],
        [center[1] + WEATHER_LATITUDE_STEP / 2, center[0] + WEATHER_LONGITUDE_STEP / 2],
      ],
    });
  }
  return [...points.values()].sort((left, right) => left.grid_id.localeCompare(right.grid_id));
}

export function buildWeatherGridUrl(points) {
  if (!points?.length) throw new Error('Weather grid requires at least one point');
  const url = new URL(buildWeatherUrl(points[0].center));
  url.searchParams.set('latitude', points.map(({ center }) => center[1]).join(','));
  url.searchParams.set('longitude', points.map(({ center }) => center[0]).join(','));
  return url.toString();
}

export function summarizeRainHistory(payload, today = new Date().toISOString().slice(0, 10)) {
  const times = payload?.daily?.time;
  const precipitation = payload?.daily?.precipitation_sum;
  if (!Array.isArray(times) || !Array.isArray(precipitation) || times.length !== precipitation.length) {
    throw new Error('Weather provider returned incomplete rain history');
  }
  const completed = times.map((date, index) => ({
    date,
    rain: Number(precipitation[index]) || 0,
  })).filter(({ date }) => date < today).slice(-30);
  if (completed.length < 7) throw new Error('Weather provider returned too little rain history');
  const sum = (days) => days.reduce((total, { rain }) => total + rain, 0);
  const rain7 = sum(completed.slice(-7));
  const rain30 = sum(completed);
  const lastHeavyIndex = completed.findLastIndex(({ rain }) => rain >= 5);
  const daysSinceHeavy = lastHeavyIndex < 0 ? null : completed.length - lastHeavyIndex;
  const moisture30 = ramp(rain30, 15, 60, 0.15, 1);
  const recentRain = ramp(rain7, 1, 15, 0.35, 1);
  const factor = clamp((2 * moisture30 + recentRain) / 3);
  const label = factor < 0.45
    ? 'Dry recently'
    : factor < 0.75 ? 'Some recent moisture' : 'Wet recently';
  return {
    rain_7d_mm: round(rain7),
    rain_30d_mm: round(rain30),
    days_since_5mm_rain: daysSinceHeavy,
    moisture_factor: round(factor),
    label,
    heuristic: true,
  };
}

export async function fetchRainHistory(center, fetchImpl = fetch) {
  const response = await fetchImpl(buildWeatherUrl(center));
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
  return summarizeRainHistory(await response.json());
}

export async function fetchRainGrid(points, fetchImpl = fetch, today) {
  const samples = [];
  for (let offset = 0; offset < points.length; offset += WEATHER_BATCH_SIZE) {
    const batch = points.slice(offset, offset + WEATHER_BATCH_SIZE);
    const response = await fetchImpl(buildWeatherGridUrl(batch));
    if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
    const payload = await response.json();
    const values = Array.isArray(payload) ? payload : [payload];
    if (values.length !== batch.length) throw new Error('Weather grid response is incomplete');
    values.forEach((value, index) => samples.push({
      ...summarizeRainHistory(value, today),
      ...batch[index],
    }));
  }
  return samples;
}

export function nearestWeatherSample(samples, [longitude, latitude]) {
  return (samples || []).reduce((nearest, sample) => {
    const distance = (sample.center[0] - longitude) ** 2
      + (sample.center[1] - latitude) ** 2;
    return !nearest || distance < nearest.distance ? { sample, distance } : nearest;
  }, null)?.sample || null;
}
