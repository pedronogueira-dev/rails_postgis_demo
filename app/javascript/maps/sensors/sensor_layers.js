// Responsibility: draw Sensor shapes with feature-owned colours on white badges.
// Shape colour is NOT a white raster icon over a tiny coloured circle.
/** @module maps/sensors/sensor_layers */
import { EMPTY_FEATURE_COLLECTION } from "../shared/geojson"

const SHAPES = new Set(["circle", "triangle", "square"])
const COLOR = /^#[0-9a-fA-F]{6}$/

/** @param {mapboxgl.Map} map @returns {void} */
export function installSensorStyle(map) {
  for (const id of ["search-area", "all-sensors", "nearby-sensors"]) {
    map.addSource(id, { type: "geojson", data: EMPTY_FEATURE_COLLECTION })
  }
  map.addLayer({ id: "search-area-fill", type: "fill", source: "search-area",
    paint: { "fill-color": "#2563eb", "fill-opacity": 0.12 } })
  map.addLayer({ id: "search-area-outline", type: "line", source: "search-area",
    paint: { "line-color": "#2563eb", "line-width": 2 } })
  map.addLayer({ id: "nearby-sensor-halo", type: "circle", source: "nearby-sensors",
    paint: { "circle-radius": 22, "circle-color": "#dc2626",
      "circle-opacity": 0.32, "circle-stroke-color": "#dc2626",
      "circle-stroke-width": 2 } })
  for (const [id, source] of [["all-sensors", "all-sensors"], ["nearby-sensors", "nearby-sensors"]]) {
    map.addLayer({ id, type: "symbol", source, layout: {
      "icon-image": ["get", "_marker_image"],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-size": 1
    } })
  }
}

/**
 * Compose a white badge with a large *coloured* shape and a subtle outline.
 * @param {"circle"|"triangle"|"square"} shape
 * @param {string} color - validated RGB hex
 * @returns {ImageData}
 */
export function drawSensorMarker(shape, color) {
  const canvas = document.createElement("canvas")
  canvas.width = 48
  canvas.height = 48
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Sensor marker canvas 2D context unavailable")

  // White, easily distinguishable badge behind the chosen shape.
  context.beginPath()
  context.arc(24, 24, 22, 0, Math.PI * 2)
  context.fillStyle = "#ffffff"
  context.fill()
  context.lineWidth = 1
  context.strokeStyle = "#64748b"
  context.stroke()

  context.beginPath()
  if (shape === "triangle") {
    context.moveTo(24, 9)
    context.lineTo(39, 35)
    context.lineTo(9, 35)
    context.closePath()
  } else if (shape === "square") {
    context.rect(11, 11, 26, 26)
  } else {
    context.arc(24, 24, 14, 0, Math.PI * 2)
  }
  context.fillStyle = color
  context.fill()
  context.lineWidth = 1
  context.strokeStyle = "#1e293b"
  context.stroke()
  return context.getImageData(0, 0, 48, 48)
}

/**
 * Ensure images are registered *before* GeoJSON references them. Never mutate
 * server response objects or trust external icon URLs from feature properties.
 * @param {mapboxgl.Map} map @param {Object} collection
 * @returns {Object} copied FeatureCollection with local _marker_image keys
 */
export function prepareSensorCollection(map, collection) {
  return {
    ...collection,
    features: (collection.features || []).map(feature => {
      const properties = feature.properties || {}
      const shape = SHAPES.has(properties.marker_icon) ? properties.marker_icon : "circle"
      const color = COLOR.test(properties.marker_color || "")
        ? properties.marker_color.toLowerCase() : "#334155"
      const imageId = `sensor-${shape}-${color.slice(1)}`
      if (!map.hasImage(imageId)) {
        map.addImage(imageId, drawSensorMarker(shape, color), { pixelRatio: 3 })
      }
      return { ...feature, properties: { ...properties, _marker_image: imageId } }
    })
  }
}