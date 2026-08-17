const TIERS = {
  highest: { label: 'Top 5%', fillColor: '#e23d28', fillOpacity: 0.80 },
  high: { label: '6–20%', fillColor: '#f29f31', fillOpacity: 0.72 },
  medium: { label: '21–40%', fillColor: '#e9d758', fillOpacity: 0.62 },
  low: { label: '41–70%', fillColor: '#1f9ac6', fillOpacity: 0.52 },
  lowest: { label: '71–100%', fillColor: '#7b4ab2', fillOpacity: 0.42 },
};

export function rankTierStyle(tier) {
  return TIERS[tier] || TIERS.lowest;
}

export function rankTierLabel(tier) {
  return TIERS[tier]?.label || 'Relative rank';
}

export function formatRankSummary(spot, total) {
  return Number.isInteger(spot.top_percent)
    ? `Top ${spot.top_percent}% · rank ${spot.rank} of ${total}`
    : `Rank ${spot.rank} of ${total}`;
}

export function formatRegionEvidence(evidence) {
  const positives = Number(evidence?.positive_visits) || 0;
  if (positives === 0) return 'No positive development visits · ranking extrapolated';
  if (!evidence?.evaluable) return `Sparse development evidence · ${positives} positive visits`;
  return `Development only · ${positives} positive visits · historical lift ${Number(evidence.visit_lift).toFixed(2)}`;
}
