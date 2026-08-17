import { MAP_MODES, moistureOverlayStyle } from './map-modes.js?v=2026-08-17-15';
import { rankTierStyle } from './rank-display.js?v=2026-08-17-15';

export function createFieldMap(element) {
  const map = L.map(element, { zoomControl: false, attributionControl: true })
    .setView([56.16, 9.55], 11);
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
  map.createPane('publicBoundaryPane');
  map.getPane('publicBoundaryPane').style.zIndex = 430;
  map.getPane('publicBoundaryPane').style.pointerEvents = 'none';
  map.createPane('weatherPane');
  map.getPane('weatherPane').style.zIndex = 360;
  map.getPane('weatherPane').style.pointerEvents = 'none';

  let visitLayer;
  let approachMarker;
  let spotLayer;
  let spotSource;
  let publicLandLayer;
  let publicLandSource;
  let selectedSpotId;
  let spotLayersById = new Map();
  let locationMarker;
  let weatherLayer;
  let viewChangeTimer;
  let displayMode = MAP_MODES.bestNow;
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
    if (publicLandLayer) map.removeLayer(publicLandLayer);
    if (weatherLayer) map.removeLayer(weatherLayer);
    spotLayer = null;
    spotSource = null;
    publicLandLayer = null;
    publicLandSource = null;
    weatherLayer = null;
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

  function showSpots(
    spots,
    selectedId,
    onSelect,
    fitAll = false,
    publicLand = null,
    focusSelected = true,
    minimumZoom = null,
  ) {
    clearVisitTargets();
    const styleFor = (properties, selected) => {
      const tier = rankTierStyle(properties.rank_tier);
      const muted = displayMode !== MAP_MODES.habitat;
      return selected ? {
        color: muted ? '#e7ece8' : '#fff0b5',
        weight: muted ? 2 : 4,
        opacity: 1,
        fillColor: tier.fillColor,
        fillOpacity: muted ? 0.16 : Math.min(0.90, tier.fillOpacity + 0.16),
      } : {
        color: muted ? '#526a65' : '#294f49',
        weight: 0.8,
        opacity: muted ? 0.35 : 0.72,
        fillColor: tier.fillColor,
        fillOpacity: muted ? 0.08 : tier.fillOpacity,
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
    if (publicLandSource !== publicLand) {
      if (publicLandLayer) map.removeLayer(publicLandLayer);
      publicLandLayer = publicLand ? L.geoJSON(publicLand, {
        pane: 'publicBoundaryPane',
        interactive: false,
        style: {
          color: '#0d5049',
          weight: 3,
          opacity: 0.92,
          dashArray: '9 6',
          fill: false,
        },
      }).addTo(map) : null;
      publicLandSource = publicLand;
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
      if (minimumZoom && map.getZoom() < minimumZoom) {
        map.setZoom(minimumZoom, { animate: false });
      }
    } else if (selected && focusSelected) {
      const selectedLayer = spotLayersById.get(selectedId);
      map.fitBounds(selectedLayer.getBounds().pad(1.1), { animate: false, maxZoom: 15 });
    }
  }

  function setDisplayMode(mode) {
    displayMode = mode;
    if (!spotLayer) return;
    spotLayer.eachLayer((layer) => {
      const selected = layer.feature.properties.spot_id === selectedSpotId;
      const tier = rankTierStyle(layer.feature.properties.rank_tier);
      const muted = mode !== MAP_MODES.habitat;
      layer.setStyle(selected ? {
        color: muted ? '#e7ece8' : '#fff0b5', weight: muted ? 2 : 4, opacity: 1,
        fillColor: tier.fillColor,
        fillOpacity: muted ? 0.16 : Math.min(0.90, tier.fillOpacity + 0.16),
      } : {
        color: muted ? '#526a65' : '#294f49', weight: 0.8,
        opacity: muted ? 0.35 : 0.72, fillColor: tier.fillColor,
        fillOpacity: muted ? 0.08 : tier.fillOpacity,
      });
    });
  }

  function clearWeatherRegion() {
    if (weatherLayer) map.removeLayer(weatherLayer);
    weatherLayer = null;
  }

  function showWeatherGrid(samples) {
    clearWeatherRegion();
    weatherLayer = L.layerGroup().addTo(map);
    samples.forEach((sample) => {
      L.rectangle(sample.bounds, {
        ...moistureOverlayStyle(sample.label),
        pane: 'weatherPane',
      }).addTo(weatherLayer);
    });
  }

  function onViewChanged(callback) {
    map.on('moveend', () => {
      clearTimeout(viewChangeTimer);
      viewChangeTimer = setTimeout(() => {
        const center = map.getCenter();
        callback({
          zoom: map.getZoom(),
          center: [center.lng, center.lat],
        });
      }, 160);
    });
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

  return {
    map, onViewChanged, showVisit, showSpots, showLocation,
    clearWeatherRegion, setDisplayMode, showWeatherGrid,
  };
}
