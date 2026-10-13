// Responsibility: construct a visible, locally bundled Mapbox GL basemap.
// Separate renderer readiness from Rails/GeoJSON data readiness, so a white
// canvas can be diagnosed without consulting Sensor or wastewater APIs.
/** @module maps/shared/basemap */
import mapboxgl from "mapbox-gl"

export const BASEMAP_STYLE = "mapbox://styles/mapbox/streets-v12"

/**
 * Create Mapbox, test WebGL2/DOM dimensions, and report renderer events.
 * @param {Object} options - basemap startup requirements
 * @param {HTMLElement} options.container - visible map element
 * @param {string} options.accessToken - Mapbox public pk. token
 * @param {[number,number]} options.center - [longitude, latitude]
 * @param {number} options.zoom - initial zoom
 * @param {(map: mapboxgl.Map) => void} options.onStyleReady - install overlays here
 * @param {(error: Error) => void} options.onError - report style and tile errors
 * @param {() => void} options.onIdle - basemap rendering has settled
 * @returns {mapboxgl.Map} owned by the caller; disconnect() must remove it
 */
export function createBasemap({
  container, accessToken, center, zoom, onStyleReady, onError, onIdle
}) {
  if (!mapboxgl.supported()) {
    throw new Error("Mapbox GL JS requires WebGL2; enable hardware acceleration or use a compatible browser")
  }
  const { width, height } = container.getBoundingClientRect()
  if (width <= 0 || height <= 0) {
    throw new Error(`Map container has invalid size ${width}x${height}; verify Tailwind and Mapbox CSS`)
  }

  const map = new mapboxgl.Map({
    container,
    accessToken,
    style: BASEMAP_STYLE,
    center,
    zoom,
    projection: "mercator"
  })
  map.addControl(new mapboxgl.NavigationControl(), "top-right")
  let styleOrTileFailed = false
  map.on("style.load", () => onStyleReady(map))
  map.on("error", event => {
    styleOrTileFailed = true
    onError(event.error || new Error("Unknown Mapbox error"))
  })
  map.on("idle", () => { if (!styleOrTileFailed) onIdle() })
  return map
}