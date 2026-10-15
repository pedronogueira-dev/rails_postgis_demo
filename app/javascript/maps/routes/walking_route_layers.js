// Responsibility: only install the two LineString sources and their paint.
// The route behavior separately owns HTTP, selection, and cancellation.
/** @module maps/routes/walking_route_layers */
import { EMPTY_FEATURE_COLLECTION } from "../shared/geojson";

/** @param {mapboxgl.Map} map @returns {void} */
export function installWalkingRouteStyle(map) {
  for (const id of ["walking-routes", "nearby-walking-routes"]) {
    map.addSource(id, { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
  }
  map.addLayer({
    id: "walking-routes",
    type: "line",
    source: "walking-routes",
    paint: { "line-color": "#7c3aed", "line-width": 4 },
  });
  map.addLayer({
    id: "nearby-walking-routes",
    type: "line",
    source: "nearby-walking-routes",
    paint: { "line-color": "#f59e0b", "line-width": 8 },
  });
}
