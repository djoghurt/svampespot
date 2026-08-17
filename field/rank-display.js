const TIERS = {
  highest: { label: 'Habitat 96–100', fillColor: '#e23d28', fillOpacity: 0.80 },
  high: { label: 'Habitat 81–95', fillColor: '#f29f31', fillOpacity: 0.72 },
  medium: { label: 'Habitat 61–80', fillColor: '#e9d758', fillOpacity: 0.62 },
  low: { label: 'Habitat 30–60', fillColor: '#1f9ac6', fillOpacity: 0.52 },
  lowest: { label: 'Habitat 0–29', fillColor: '#7b4ab2', fillOpacity: 0.42 },
};

export function formatHabitatStanding(topPercent) {
  const value = Number(topPercent);
  if (!Number.isFinite(value) || value < 1 || value > 100) return 'Habitat rank';
  const standing = Math.round(100 * (1 - ((value - 1) / 99)));
  return `Habitat ${standing}/100`;
}

export function rankTierStyle(tier) {
  return TIERS[tier] || TIERS.lowest;
}

export function rankTierLabel(tier) {
  return TIERS[tier]?.label || 'Relative rank';
}

export function formatRankSummary(spot, total) {
  return Number.isInteger(spot.top_percent)
    ? `${formatHabitatStanding(spot.top_percent)} · rank ${spot.rank} of ${total}`
    : `Rank ${spot.rank} of ${total}`;
}

export function formatRegionEvidence(evidence) {
  const positives = Number(evidence?.positive_visits) || 0;
  if (positives === 0) return 'No positive development visits · ranking extrapolated';
  if (!evidence?.evaluable) return `Sparse development evidence · ${positives} positive visits`;
  return `Development only · ${positives} positive visits · historical lift ${Number(evidence.visit_lift).toFixed(2)}`;
}
