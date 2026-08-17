export const MAP_MODES = Object.freeze({
  currentPotential: 'current-potential',
  habitat: 'habitat',
  recentMoisture: 'recent-moisture',
});

export const DEFAULT_MAP_MODE = MAP_MODES.currentPotential;

const PRESENTATIONS = Object.freeze({
  [MAP_MODES.currentPotential]: Object.freeze({
    modeLabel: 'Current potential',
    noticeTitle: '',
    noticeBody: '',
    showNotice: false,
    showRain: true,
    allowNavigation: true,
  }),
  [MAP_MODES.habitat]: Object.freeze({
    modeLabel: 'Habitat potential',
    noticeTitle: '',
    noticeBody: '',
    showNotice: false,
    showRain: false,
    allowNavigation: true,
  }),
  [MAP_MODES.recentMoisture]: Object.freeze({
    modeLabel: 'Recent moisture',
    noticeTitle: 'Recent modelled rain',
    noticeBody: 'DMI rain history is sampled at roughly 2 km. It remains separate from the 250 m habitat ranking.',
    showNotice: true,
    showRain: true,
    allowNavigation: false,
  }),
});

export function mapModePresentation(mode) {
  const presentation = PRESENTATIONS[mode];
  if (!presentation) throw new Error(`Unknown map mode: ${mode}`);
  return { ...presentation };
}

const CURRENT_POTENTIAL_COLOURS = Object.freeze({
  strong: '#e23d28',
  promising: '#e9d758',
  low: '#7b4ab2',
});

const clamp = (value) => Math.max(0, Math.min(1, value));

export function currentPotentialForSpot(spot, weather) {
  const topPercent = Number(spot?.top_percent);
  const moisture = Number(weather?.moisture_factor);
  if (!Number.isFinite(topPercent) || topPercent < 1 || topPercent > 100
    || !Number.isFinite(moisture)) return null;
  const habitat = 1 - (clamp((topPercent - 1) / 99) * 0.6);
  const score = Math.round(100 * habitat * clamp(moisture));
  const tier = score >= 70 ? 'strong' : score >= 40 ? 'promising' : 'low';
  const label = tier === 'strong' ? 'Strong now'
    : tier === 'promising' ? 'Promising now' : 'Low now';
  return { score, tier, label };
}

export function currentPotentialPresentation(spot, weather) {
  const potential = currentPotentialForSpot(spot, weather);
  if (!potential) return null;
  const betterThan = Math.round(100 - Number(spot.top_percent));
  return {
    ...potential,
    status: potential.label,
    detail: `Habitat better than ${betterThan}% · ${weather.label}`,
    map_label: `${potential.label} · Habitat better than ${betterThan}%`,
  };
}

export function currentPotentialStyle(tier) {
  return {
    fillColor: CURRENT_POTENTIAL_COLOURS[tier] || '#687a76',
    fillOpacity: tier ? 0.78 : 0.22,
  };
}

const MOISTURE_COLOURS = Object.freeze({
  'Wet recently': '#2785c7',
  'Some recent moisture': '#f0b541',
  'Dry recently': '#c64f42',
});

export function moistureOverlayStyle(label) {
  return {
    color: '#f7fbfa',
    weight: 2,
    opacity: 0.96,
    dashArray: '8 6',
    fillColor: MOISTURE_COLOURS[label] || '#687a76',
    fillOpacity: 0.42,
    interactive: false,
  };
}
