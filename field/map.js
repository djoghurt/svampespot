import { rankTierStyle } from './rank-display.js';

export function createFieldMap(element) {
  const map = L.map(element, { zoomControl: false, attributionControl: true })
    .setView([56.16, 9.55], 11);
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  let visitLayer;
  let approachMarker;
  let spotLayer;
  let spotSource;
  let selectedSpotId;
  let spotLayersById = new Map();
  let locationMarker;
  const spotRenderer = L.canvas({ padding: 0.5 });

  function clearVisitTargets() {
    if (visitLayer) map.removeLayer(visitLayer);
    if (approachMarker) map.removeLayer(approachMarker);
    visitLayer = null;
    approachMarker = null;
  }

  function clearTargets() {
    clearVisitTargets();
    if (spotLayer) map.removeLayer(spotLayer);
    spotLayer = null;
    spotSource = null;
    selectedSpotId = null;
    spotLayersById = new Map();
  }

  function showVisit(visit) {
    clearTargets();
    visitLayer = L.geoJSON({
      type: 'Feature',
      properties: {},
      geometry: visit.geometry,
    }, {
      style: {
        color: '#e6a23c',
        weight: 4,
        opacity: 1,
        fillColor: '#e6a23c',
        fillOpacity: 0.16,
      },
    }).addTo(map);
    if (visit.walking_line) {
      L.geoJSON(visit.walking_line, {
        style: { color: '#f4c86a', weight: 4, dashArray: '7 7' },
      }).addTo(visitLayer);
    }
    approachMarker = L.circleMarker(
      [visit.approach_point[1], visit.approach_point[0]],
      { radius: 9, color: '#102421', weight: 3, fillColor: '#f4c86a', fillOpacity: 1 },
    ).bindTooltip('Approach point').addTo(map);
    const bounds = visitLayer.getBounds();
    bounds.extend(approachMarker.getLatLng());
    map.fitBounds(bounds.pad(0.35), { animate: false });
  }

  function showSpots(spots, selectedId, onSelect, fitAll = false) {
    clearVisitTargets();
    const styleFor = (properties, selected) => {
      const tier = rankTierStyle(properties.rank_tier);
      return selected ? {
        color: '#fff0b5',
        weight: 4,
        opacity: 1,
        fillColor: tier.fillColor,
        fillOpacity: Math.min(0.76, tier.fillOpacity + 0.16),
      } : {
        color: '#294f49',
        weight: 0.8,
        opacity: 0.72,
        fillColor: tier.fillColor,
        fillOpacity: tier.fillOpacity,
      };
    };
    if (spotSource !== spots) {
      if (spotLayer) map.removeLayer(spotLayer);
      spotLayersById = new Map();
      const features = spots.map((spot) => ({
        type: 'Feature',
        properties: {
          spot_id: spot.spot_id,
          rank: spot.rank,
          top_percent: spot.top_percent,
          rank_tier: spot.rank_tier,
        },
        geometry: spot.geometry,
      }));
      spotLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
        renderer: spotRenderer,
        style: ({ properties }) => styleFor(properties, properties.spot_id === selectedId),
        onEachFeature: (feature, layer) => {
          spotLayersById.set(feature.properties.spot_id, layer);
          const percentile = Number.isInteger(feature.properties.top_percent)
            ? ` · Top ${feature.properties.top_percent}%`
            : '';
          layer.bindTooltip(
            `#${feature.properties.rank}${percentile}`,
            { permanent: false, direction: 'top', sticky: true },
          );
          layer.on('click', () => onSelect(feature.properties.spot_id));
        },
      }).addTo(map);
      spotSource = spots;
    }
    if (selectedSpotId !== selectedId) {
      for (const spotId of [selectedSpotId, selectedId]) {
        const layer = spotLayersById.get(spotId);
        if (layer) layer.setStyle(styleFor(
          layer.feature.properties,
          layer.feature.properties.spot_id === selectedId,
        ));
      }
      selectedSpotId = selectedId;
    }
    const selected = spots.find(({ spot_id: id }) => id === selectedId);
    if (fitAll) {
      map.fitBounds(spotLayer.getBounds().pad(0.08), { animate: false });
    } else if (selected) {
      const selectedLayer = spotLayersById.get(selectedId);
      map.fitBounds(selectedLayer.getBounds().pad(1.1), { animate: false, maxZoom: 15 });
    }
  }

  function showLocation(coords, accuracy) {
    const latLng = [coords[1], coords[0]];
    if (!locationMarker) {
      locationMarker = L.circleMarker(latLng, {
        radius: 8,
        color: '#e7ece8',
        weight: 3,
        fillColor: '#246b65',
        fillOpacity: 1,
      }).addTo(map);
    } else {
      locationMarker.setLatLng(latLng);
    }
    locationMarker.setRadius(Math.max(7, Math.min(18, Number(accuracy) / 8 || 8)));
  }

  return { map, showVisit, showSpots, showLocation };
}
