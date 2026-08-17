const round = (value) => Math.round(value * 10) / 10;
const clamp = (value) => Math.max(0, Math.min(1, value));

function ramp(value, start, end, low, high) {
  if (value <= start) return low;
  if (value >= end) return high;
  return low + ((value - start) / (end - start)) * (high - low);
}

/** Keep 250 m model locations private by requesting weather on a coarse grid. */
export function coarsenWeatherCenter([longitude, latitude]) {
  if (![longitude, latitude].every(Number.isFinite)) {
    throw new Error('Weather requires a valid spot coordinate');
  }
  return [longitude, latitude].map((value) => Number((Math.round(value * 10) / 10).toFixed(1)));
}

export function buildWeatherUrl(center) {
  const [longitude, latitude] = coarsenWeatherCenter(center);
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: 'precipitation_sum',
    past_days: '30',
    forecast_days: '1',
    timezone: 'auto',
  });
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
