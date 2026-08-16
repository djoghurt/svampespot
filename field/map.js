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
  let locationMarker;

  function clearVisit() {
    if (visitLayer) map.removeLayer(visitLayer);
    if (approachMarker) map.removeLayer(approachMarker);
  }

  function showVisit(visit) {
    clearVisit();
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

  return { map, showVisit, showLocation };
}
