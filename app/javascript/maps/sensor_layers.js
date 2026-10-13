// Responsibility: install and style GeoJSON sources/layers for Sensors.
// No network requests or event-state transitions belong in this module.
/** @module maps/sensor_layers */
import { EMPTY_FEATURE_COLLECTION } from "./shared/geojson";

/**
 * Install the Sensor, nearby highlight and radius-buffer GeoJSON sources.
 * @returns {void}
 */
export function installSensorSources(map) {
  ["search-area", "all-sensors", "nearby-sensors"].forEach((id) => {
    map.addSource(id, {
      type: "geojson",
      data: EMPTY_FEATURE_COLLECTION,
    });
  });
}

/**
 * Install local white marker glyphs on the Mapbox style before symbol layers.
 * @param {mapboxgl.Map} map - Mapbox map with a ready style
 * @returns {void}
 */
export function registerSensorIcons(map) {
  for (const shape of ["circle", "triangle", "square"]) {
    const imageName = `sensor-${shape}`;
    if (map.hasImage(imageName)) continue;

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas is unavailable for Sensor icons");

    ctx.fillStyle = "#ffffff";
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(16, 16, 6, 0, 2 * Math.PI);
      ctx.fill();
    } else if (shape === "triangle") {
      ctx.beginPath();
      ctx.moveTo(16, 8);
      ctx.lineTo(24, 23);
      ctx.lineTo(8, 23);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(10, 10, 12, 12);
    }
    map.addImage(imageName, ctx.getImageData(0, 0, 32, 32));
  }
}

/**
 * Install Sensor circles and the derived buffer Polygon.
 * @returns {void}
 */
export function installSensorLayers(map) {
  map.addLayer({
    id: "search-area-fill",
    type: "fill",
    slot: "middle",
    source: "search-area",
    paint: { "fill-color": "#2563eb", "fill-opacity": 0.12 },
  });

  map.addLayer({
    id: "search-area-outline",
    type: "line",
    slot: "middle",
    source: "search-area",
    paint: { "line-color": "#2563eb", "line-width": 2 },
  });

  map.addLayer({
    id: "all-sensors",
    type: "circle",
    source: "all-sensors",
    paint: {
      "circle-radius": 6,
      "circle-color": ["coalesce", ["get", "marker_color"], "#334155"],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });

  map.addLayer({
    id: "sensor-icons",
    type: "symbol",
    source: "all-sensors",
    layout: {
      "icon-image": [
        "match",
        ["get", "marker_icon"],
        "triangle",
        "sensor-triangle",
        "square",
        "sensor-square",
        "sensor-circle",
      ],
      "icon-size": 0.8,
      "icon-allow-overlap": true,
    },
  });

  map.addLayer({
    id: "nearby-sensors",
    type: "circle",
    source: "nearby-sensors",
    paint: {
      "circle-radius": 10,
      "circle-color": "#dc2626",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  });
}

/**
 * Register hover styling without duplicating click handlers.
 * @returns {void}
 */
export function installSensorInteractions(map) {
  // Hover is visual only. Do not register another click handler here:
  // Mapbox layer click listeners and map click listeners can both fire.
  for (const layer of ["all-sensors", "nearby-sensors"]) {
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}
