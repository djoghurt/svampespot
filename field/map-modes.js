export const MAP_MODES = Object.freeze({
  currentPotential: 'current-potential',
  habitat: 'habitat',
  recentMoisture: 'recent-moisture',
});

export const DEFAULT_MAP_MODE = MAP_MODES.currentPotential;

const PRESENTATIONS = Object.freeze({
  [MAP_MODES.currentPotential]: Object.freeze({
    modeLabel: 'Current potential',
    noticeTitle: 'The source maps work. The combined score is not validated yet.',
    noticeBody: 'Current potential needs a tested rule for combining habitat and recent weather. Until that passes evaluation, use the two source maps separately.',
    showNotice: true,
    showRain: false,
    allowNavigation: false,
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
