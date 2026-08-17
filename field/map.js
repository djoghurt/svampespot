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
  let locationMarker;

  function clearTargets() {
    if (visitLayer) map.removeLayer(visitLayer);
    if (approachMarker) map.removeLayer(approachMarker);
    if (spotLayer) map.removeLayer(spotLayer);
    visitLayer = null;
    approachMarker = null;
    spotLayer = null;
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
    clearTargets();
    const features = spots.map((spot) => ({
      type: 'Feature',
      properties: { spot_id: spot.spot_id, rank: spot.rank },
      geometry: spot.geometry,
    }));
    spotLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
      style: ({ properties }) => {
        const selected = properties.spot_id === selectedId;
        return {
          color: selected ? '#f4c86a' : '#246b65',
          weight: selected ? 4 : 2,
          opacity: 1,
          fillColor: selected ? '#e6a23c' : '#4d6a4b',
          fillOpacity: selected ? 0.42 : 0.22,
        };
      },
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(`#${feature.properties.rank}`, { permanent: false, direction: 'top' });
        layer.on('click', () => onSelect(feature.properties.spot_id));
      },
    }).addTo(map);
    const selected = spots.find(({ spot_id: id }) => id === selectedId);
    if (fitAll) {
      map.fitBounds(spotLayer.getBounds().pad(0.08), { animate: false });
    } else if (selected) {
      const selectedLayer = [...spotLayer.getLayers()].find(
        (layer) => layer.feature.properties.spot_id === selectedId,
      );
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
