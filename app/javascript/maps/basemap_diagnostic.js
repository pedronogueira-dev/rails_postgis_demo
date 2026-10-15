// Responsibility: prove Mapbox GL rendering independently from PostGIS, Sensors,
// API fetches and the normal SpatialMap controller. Only this file owns the
// inline no-tiles diagnostic style and its detailed renderer evidence.
/** @module maps/basemap_diagnostic */
import mapboxgl from "mapbox-gl";

const STREETS_STYLE = "mapbox://styles/mapbox/streets-v12";

const INLINE_STYLE = {
  version: 8,
  sources: {
    "diagnostic-geometry": {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-9.18, 38.7],
                  [-9.1, 38.7],
                  [-9.1, 38.76],
                  [-9.18, 38.76],
                  [-9.18, 38.7],
                ],
              ],
            },
          },
          {
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: [-9.14, 38.73] },
          },
        ],
      },
    },
  },
  layers: [
    {
      id: "diagnostic-background",
      type: "background",
      paint: { "background-color": "#b6e3f1" },
    },
    {
      id: "diagnostic-polygon",
      type: "fill",
      source: "diagnostic-geometry",
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": "#7442a6", "fill-opacity": 0.85 },
    },
    {
      id: "diagnostic-point",
      type: "circle",
      source: "diagnostic-geometry",
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": 11,
        "circle-color": "#ffd34f",
        "circle-stroke-color": "#222222",
        "circle-stroke-width": 2,
      },
    },
  ],
};

/** Renderer-only probe for remote Mapbox Streets versus local inline style. */
export class BasemapDiagnostic {
  /** @param {HTMLElement} root - the separate diagnostic Stimulus root */
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector("[data-basemap-diagnostic-canvas]");
    this.status = root.querySelector("[data-basemap-diagnostic-status]");
    this.report = root.querySelector("[data-basemap-diagnostic-report]");
    this.mode = root.dataset.diagnosticStyle === "inline" ? "inline" : "remote";
    this.token = root.dataset.accessToken || "";
    this.map = null;
    this.errors = [];
  }

  /** Create the renderer without installing any domain layers or API requests. @returns {void} */
  connect() {
    try {
      if (!this.canvas || !this.status || !this.report) {
        throw new Error("Diagnostic HTML elements are missing");
      }
      if (!mapboxgl.supported()) {
        throw new Error(
          "WebGL is unavailable: inspect hardware acceleration and browser graphics support",
        );
      }
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        throw new Error(
          `Map container is ${rect.width}x${rect.height}; inspect generated CSS`,
        );
      }
      if (
        this.mode === "remote" &&
        (!this.token.startsWith("pk.") || this.token.startsWith("pk.replace"))
      ) {
        throw new Error(
          "A real, origin-authorized public Mapbox pk. token is required for remote Streets",
        );
      }

      this.status.textContent = `Starting ${this.mode} rendering...`;
      this.map = new mapboxgl.Map({
        container: this.canvas,
        style: this.mode === "inline" ? INLINE_STYLE : STREETS_STYLE,
        accessToken: this.token || undefined,
        center: [-9.14, 38.72],
        zoom: 11,
        projection: "mercator",
      });
      this.map.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Deliberate DevTools probe only on this diagnostic page. Never place a
      // global Mapbox reference in the real map controller or public API.
      this.root.__basemapDiagnostic = this;
      this.map.on("style.load", () => {
        this.status.textContent =
          this.mode === "inline"
            ? "Inline style loaded; waiting for the first frame..."
            : "Streets style loaded; waiting for remote tiles...";
        this.updateReport();
      });
      this.map.on("sourcedata", (event) => {
        if (event.sourceId === "diagnostic-geometry") this.updateReport();
      });
      this.map.on("idle", () => {
        // A failed style or tile request may still be followed by an idle event.
        // Never overwrite the evidence of that failure with a success message.
        this.status.textContent = this.errors.length
          ? `${this.errors.length} Mapbox error(s); inspect Console and Network.`
          : this.mode === "inline"
            ? "Inline style is idle. Verify purple polygon and yellow point are visible."
            : "Remote Streets is idle. Verify real Lisbon geography is visible.";
        this.updateReport();
      });
      this.map.on("error", (event) => {
        const error =
          event.error || new Error("Unknown Mapbox rendering error");
        const message = error.message || String(error);
        this.errors.push(message);
        console.error("Diagnostic Mapbox error:", error);
        this.status.textContent = `Mapbox error: ${message}`;
        this.updateReport();
      });
      this.map.on("webglcontextlost", () => {
        this.status.textContent =
          "WebGL context lost; inspect Chrome GPU/WebGL diagnostics.";
      });
      this.updateReport();
    } catch (error) {
      console.error("Renderer diagnostic failed:", error);
      if (this.status)
        this.status.textContent = `Renderer failed: ${error.message}`;
      this.map?.remove();
      this.map = null;
      delete this.root.__basemapDiagnostic;
    }
  }

  /** Show diagnostic evidence without asserting that a visible street map exists. @returns {void} */
  updateReport() {
    if (!this.map || !this.report) return;
    const canvas = this.map.getCanvas();
    const styleLoaded = this.map.isStyleLoaded();
    // These probes can throw "Style is not done loading" during connect().
    // Not-yet-measurable is null, not a renderer failure.
    let tilesLoaded = null;
    let styleLayerCount = null;
    let geometrySourceLoaded = null;
    let probeWarning = null;

    if (styleLoaded) {
      try {
        tilesLoaded = this.map.areTilesLoaded();
        styleLayerCount = this.map.getStyle()?.layers?.length ?? 0;
      } catch (error) {
        probeWarning = error.message;
      }
    }
    if (this.mode === "inline") {
      try {
        if (this.map.getSource("diagnostic-geometry")) {
          geometrySourceLoaded = this.map.isSourceLoaded("diagnostic-geometry");
        }
      } catch (error) {
        probeWarning = error.message;
      }
    }

    const evidence = {
      mode: this.mode,
      canvas: `${canvas.width}x${canvas.height}`,
      styleLoaded,
      tilesLoaded,
      geometrySourceLoaded,
      styleLayerCount,
      probeWarning,
      errors: this.errors,
    };
    this.report.textContent = JSON.stringify(evidence, null, 2);
  }

  /** Release WebGL and debug state on Turbo navigation/disconnect. @returns {void} */
  disconnect() {
    this.map?.remove();
    this.map = null;
    delete this.root.__basemapDiagnostic;
  }
}
