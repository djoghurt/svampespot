const TIERS = {
  highest: { label: 'Top 5%', fillColor: '#e6a23c', fillOpacity: 0.62 },
  high: { label: '6–20%', fillColor: '#f4c86a', fillOpacity: 0.48 },
  medium: { label: '21–40%', fillColor: '#7b9d6b', fillOpacity: 0.34 },
  low: { label: '41–70%', fillColor: '#4f7568', fillOpacity: 0.22 },
  lowest: { label: '71–100%', fillColor: '#35534f', fillOpacity: 0.12 },
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
