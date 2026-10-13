// Responsibility: Sensor map lifecycle and user interactions; styles, HTTP and DOM
// helpers live in focused sibling modules. Stimulus owns connect/disconnect.
/** @module maps/spatial_map */
import { createBasemap } from "./shared/basemap";
import { fetchJson, urlWithQuery } from "./shared/http";
import { requiredElement, renderTextList, openTextPopup } from "./shared/dom";
import { EMPTY_FEATURE_COLLECTION } from "./shared/geojson";
import {
  installSensorSources,
  installSensorLayers,
  installSensorInteractions,
  registerSensorIcons,
} from "./sensor_layers";
import { createSensor } from "./sensor_create";

/**
 * @typedef {{type: "Point", coordinates: [number, number]}} SensorPoint
 * A GeoJSON point in EPSG:4326: longitude first, then latitude.
 */
/**
 * @typedef {{type: "FeatureCollection", features: Object[]}} GeoJSONFeatureCollection
 * The Sensor API / viewport JSON collection; never assume features are nonempty.
 */

/**
 * Own Mapbox sources, click priority, and abortable Sensor queries.
 * @class
 */
export class SpatialMap {
  /**
   * Capture DOM elements, Rails data attributes, and request state.
   * @param {HTMLElement} root - Stimulus controller root containing Rails data attributes
   */
  constructor(root) {
    this.root = root;

    this.canvas = this.requiredElement("[data-map-canvas]");
    this.radiusInput = this.requiredElement("[data-radius]");
    this.radiusValue = this.requiredElement("[data-radius-value]");
    this.statusElement = this.requiredElement("[data-status]");
    this.basemapStatus = this.requiredElement("[data-basemap-status]");
    this.sensorResults = this.requiredElement("[data-sensor-results]");
    this.sensorNameInput = this.requiredElement("[data-sensor-name]");
    this.sensorColorInput = this.requiredElement("[data-sensor-color]");
    this.sensorIconInput = this.requiredElement("[data-sensor-icon]");
    this.placementButton = this.requiredElement("[data-placement-button]");

    this.accessToken = root.dataset.accessToken;
    this.center = JSON.parse(root.dataset.center);
    this.zoom = Number(root.dataset.zoom);
    this.sensorsUrl = root.dataset.sensorsUrl;
    this.nearbySensorsUrl = root.dataset.nearbySensorsUrl;

    this.searchCenter = this.center;
    this.nearbyRequestController = null;
    this.sourceRequestControllers = new Map();
    this.onRadiusChange = () => this.radiusChanged();

    this.createSensorUrl = root.dataset.createSensorUrl;
    this.placementEnabled = false;
    this.placementRequestController = null;
    this.onPlacementButtonClick = () => this.togglePlacement();
  }

  /**
   * Attach the map and its DOM/Mapbox event listeners.
   * @returns {void}
   */
  connect() {
    this.radiusInput.addEventListener("change", this.onRadiusChange);
    this.placementButton.disabled = false;
    this.placementButton.removeAttribute("aria-disabled");
    this.placementButton.textContent = "Place sensor";
    this.placementButton.addEventListener("click", this.onPlacementButtonClick);
    if (
      !this.accessToken?.startsWith("pk.") ||
      this.accessToken.startsWith("pk.replace")
    ) {
      this.statusElement.textContent =
        "A valid public pk. Mapbox token is required.";
      return;
    }
    this.basemapStatus.textContent = "Loading Mapbox Streets basemap...";
    try {
      this.map = createBasemap({
        container: this.canvas,
        accessToken: this.accessToken,
        center: this.center,
        zoom: this.zoom,
        onStyleReady: () => {
          this.basemapStatus.textContent =
            "Basemap style loaded; waiting for tiles...";
          void this.handleMapLoad().catch((error) =>
            this.reportMapError(error),
          );
        },
        onIdle: () => {
          this.basemapStatus.textContent =
            "Mapbox is idle; visually verify Lisbon streets.";
        },
        onError: (error) => {
          console.error("Mapbox style/tile error:", error);
          this.basemapStatus.textContent = `Basemap error: ${error.message}`;
        },
      });
    } catch (error) {
      console.error("Mapbox constructor failed:", error);
      this.basemapStatus.textContent = `Basemap failed: ${error.message}`;
      return;
    }
    this.map.on("click", (event) => {
      void this.handleMapClick(event);
    });
  }

  /**
   * Abort in-flight requests and release listeners, popups and WebGL state.
   * @returns {void}
   * @note Called by Stimulus before Turbo disposes of or replaces the page.
   */
  disconnect() {
    this.nearbyRequestController?.abort();
    this.nearbyRequestController = null;
    this.activePopup?.remove();
    this.activePopup = null;
    this.sourceRequestControllers.forEach((request) => request.abort());
    this.sourceRequestControllers.clear();
    this.radiusInput.removeEventListener("change", this.onRadiusChange);
    this.placementRequestController?.abort();
    this.placementRequestController = null;
    this.placementButton.removeEventListener(
      "click",
      this.onPlacementButtonClick,
    );
    this.placementButton.disabled = true;
    this.map?.remove();
    this.map = null;
  }

  /** @param {string} selector @returns {Element} */
  requiredElement(selector) {
    return requiredElement(this.root, selector, "Spatial map");
  }

  /**
   * Ensure the Mapbox style has installed every required Sensor source/layer.
   * @returns {boolean} whether custom style sources and layers are ready
   */
  sourcesReady() {
    // A canvas is not evidence that the asynchronous Mapbox style is ready.
    return Boolean(
      this.map?.getLayer("all-sensors") &&
      this.map.getSource("all-sensors") &&
      this.map.getSource("nearby-sensors") &&
      this.map.getSource("search-area"),
    );
  }

  /**
   * Hit-test only layers that currently exist in the loaded style.
   * @param {mapboxgl.PointLike} point - pixel position of the click
   * @param {string[]} layerIds - candidate Mapbox layer identifiers
   * @returns {Array<mapboxgl.MapboxGeoJSONFeature>} features from currently installed layers
   */
  renderedFeaturesAt(point, layerIds) {
    if (!this.map) return [];
    const layers = layerIds.filter((id) => this.map.getLayer(id));
    if (layers.length === 0) return [];
    return this.map.queryRenderedFeatures(point, { layers });
  }

  /**
   * Surface initialization failures without hiding their browser-console details.
   * @param {Error} error - underlying Mapbox/network error
   * @returns {void}
   */
  reportMapError(error) {
    if (!this.map) return;
    console.error("Mapbox initialization/data error:", error);
    this.statusElement.textContent = `Map setup failed: ${error.message}. Inspect Mapbox style/API requests in Network.`;
  }

  /**
   * Re-query the last clicked coordinate using the current radius.
   * @returns {void}
   */
  radiusChanged() {
    if (!this.sourcesReady()) {
      this.statusElement.textContent =
        "Mapbox layers are still loading. Try again after the style loads.";
      return;
    }
    void this.searchAt(this.searchCenter[0], this.searchCenter[1]);
  }

  /**
   * Register sources/layers after style.load and perform the initial data fetch.
   * @returns {Promise<void>} resolves once the asynchronous operation finishes or is aborted
   */
  async handleMapLoad() {
    this.addSensorSources();
    /** Register local icons before Mapbox creates the Sensor symbol layer. @returns {void} */
    this.registerSensorIcons();
    this.addSensorLayers();
    this.addSensorInteractions();

    if (!this.sourcesReady()) {
      throw new Error(
        "Mapbox Sensor layers/sources were not registered after style.load",
      );
    }
    try {
      await this.loadSource(this.sensorsUrl, "all-sensors");
      if (this.map) await this.searchAt(this.center[0], this.center[1]);
    } catch (error) {
      if (!this.map) return;
      console.error(error);
      this.statusElement.textContent =
        "Could not load Sensors; inspect the Rails API.";
    }
  }

  /** Register local icons before Mapbox creates the Sensor symbol layer. @returns {void} */
  registerSensorIcons() {
    registerSensorIcons(this.map);
  }

  /** Delegate addSensorSources to the map style module. @returns {void} */
  addSensorSources() {
    installSensorSources(this.map);
  }

  /** Delegate addSensorLayers to the map style module. @returns {void} */
  addSensorLayers() {
    installSensorLayers(this.map);
  }

  /** Delegate addSensorInteractions to the map style module. @returns {void} */
  addSensorInteractions() {
    installSensorInteractions(this.map);
  }

  /** Update placement label and cursor when toggling or completing a creation. @returns {void} */
  syncPlacementUi() {
    this.placementButton.textContent = this.placementEnabled
      ? "Cancel placement"
      : "Place sensor";
    if (this.map) {
      this.map.getCanvas().style.cursor = this.placementEnabled
        ? "crosshair"
        : "";
    }
  }

  /** Enter or exit one-shot click-to-place mode. @returns {void} */
  togglePlacement() {
    if (this.placementRequestController) return;
    if (!this.sourcesReady()) {
      this.statusElement.textContent =
        "Wait until Mapbox Sensor layers have loaded.";
      return;
    }
    this.placementEnabled = !this.placementEnabled;
    this.syncPlacementUi();
    this.statusElement.textContent = this.placementEnabled
      ? "Placement armed: click a point on the map (or Cancel placement)."
      : "Placement cancelled; no Sensor was created.";
  }

  /**
   * Place a Sensor once, refresh its reference layer and display its identity.
   * @param {number} longitude - WGS 84 longitude
   * @param {number} latitude - WGS 84 latitude
   * @returns {Promise<void>}
   */
  async createSensorAt(longitude, latitude) {
    if (this.placementRequestController) return; // reject double-click duplicate POSTs
    const request = new AbortController();
    this.placementRequestController = request;
    this.placementButton.disabled = true;
    this.statusElement.textContent = "Creating Sensor...";

    try {
      const feature = await createSensor(
        this.createSensorUrl,
        {
          longitude,
          latitude,
          name: this.sensorNameInput.value,
          markerColor: this.sensorColorInput.value,
          markerIcon: this.sensorIconInput.value,
        },
        { signal: request.signal },
      );

      if (!this.map || request.signal.aborted) return;
      this.placementEnabled = false;
      this.syncPlacementUi();
      // Step 74 replaces only this whole-layer refresh with loadVisibleFeatures().
      await this.loadSource(this.sensorsUrl, "all-sensors");
      if (!this.map || request.signal.aborted) return;
      this.openPopup(feature.geometry.coordinates, [
        feature.properties.name,
        "Sensor created",
      ]);
      this.statusElement.textContent = `Created Sensor: ${feature.properties.name}`;
    } catch (error) {
      if (error.name === "AbortError" || !this.map) return;
      this.statusElement.textContent = `Sensor creation failed: ${error.message}`;
      throw error;
    } finally {
      if (this.placementRequestController === request) {
        this.placementRequestController = null;
        if (this.map) this.placementButton.disabled = false;
      }
    }
  }

  /** Dispatch one click to placement, identity, or nearby search. @param {mapboxgl.MapMouseEvent} event @returns {Promise<void>} */
  async handleMapClick(event) {
    if (!this.sourcesReady()) {
      this.statusElement.textContent =
        "Sensor layers not ready; retry shortly.";
      return;
    }

    // Placement is first—even a click on a marker places a new Sensor.
    if (this.placementEnabled) {
      if (this.placementRequestController) return;
      try {
        await this.createSensorAt(event.lngLat.lng, event.lngLat.lat);
      } catch (error) {
        console.error("Sensor placement request:", error);
      }
      return;
    }

    const feature = this.renderedFeaturesAt(event.point, [
      "sensor-icons",
      "nearby-sensors",
      "all-sensors",
    ])[0];
    if (feature) {
      this.nearbyRequestController?.abort();
      this.nearbyRequestController = null;
      this.openPopup(feature.geometry.coordinates, [feature.properties.name]);
      return;
    }

    this.activePopup?.remove();
    this.activePopup = null;
    await this.searchAt(event.lngLat.lng, event.lngLat.lat);
  }
  /**
   * Fetch nearby Sensors and buffer; ignore superseded or disconnected results.
   * @param {number} longitude - WGS 84 longitude in decimal degrees
   * @param {number} latitude - WGS 84 latitude in decimal degrees
   * @returns {Promise<void>} resolves once the asynchronous operation finishes or is aborted
   * @note The AbortController ensures only the most recent user intent can repaint.
   */
  async searchAt(longitude, latitude) {
    if (!this.sourcesReady()) {
      if (this.map)
        this.statusElement.textContent =
          "Cannot search yet: Mapbox GeoJSON sources are not ready.";
      return;
    }
    this.nearbyRequestController?.abort();
    const request = new AbortController();
    this.nearbyRequestController = request;
    this.searchCenter = [longitude, latitude];

    const radiusM = Number(this.radiusInput.value);
    this.radiusValue.textContent = radiusM;
    this.statusElement.textContent = "Querying PostGIS...";

    try {
      const data = await this.fetchJson(
        this.urlWithQuery(this.nearbySensorsUrl, {
          longitude: longitude.toString(),
          latitude: latitude.toString(),
          radius_m: radiusM.toString(),
        }),
        { signal: request.signal },
      );
      // Earlier clicks/radius changes may finish after later requests.
      if (
        !this.map ||
        request.signal.aborted ||
        request !== this.nearbyRequestController
      )
        return;

      // A style change/teardown can invalidate sources while fetch is pending.
      if (!this.sourcesReady()) return;
      const nearbySource = this.map.getSource("nearby-sensors");
      const searchAreaSource = this.map.getSource("search-area");
      nearbySource.setData(data.sensors);
      searchAreaSource.setData(data.search_area);
      this.renderList(
        this.sensorResults,
        data.sensors.features.map((feature) => feature.properties.name),
        "No sensors in the selected radius.",
      );
      this.statusElement.textContent = `Queried ${longitude.toFixed(5)}, ${latitude.toFixed(5)}`;
    } catch (error) {
      if (
        error.name === "AbortError" ||
        !this.map ||
        request !== this.nearbyRequestController
      )
        return;
      console.error(error);
      this.statusElement.textContent =
        "The Sensor API request failed. Check the Rails logs.";
    } finally {
      if (request === this.nearbyRequestController) {
        this.nearbyRequestController = null;
      }
    }
  }

  /**
   * Fetch one GeoJSON source with per-source cancellation and readiness checks.
   * @param {string|URL} url - same-origin endpoint or HTTP URL
   * @param {string} sourceId - installed Mapbox source identifier
   * @returns {Promise<void>} resolves once the asynchronous operation finishes or is aborted
   */
  async loadSource(url, sourceId) {
    if (!this.map) return;
    this.sourceRequestControllers.get(sourceId)?.abort();
    const request = new AbortController();
    this.sourceRequestControllers.set(sourceId, request);
    try {
      const data = await this.fetchJson(url, { signal: request.signal });
      if (
        !this.map ||
        request.signal.aborted ||
        this.sourceRequestControllers.get(sourceId) !== request
      )
        return;
      const source = this.map.getSource(sourceId);
      if (!source)
        throw new Error(`Mapbox source '${sourceId}' is not installed`);
      source.setData(data);
    } catch (error) {
      if (error.name !== "AbortError" && this.map) throw error;
    } finally {
      if (this.sourceRequestControllers.get(sourceId) === request) {
        this.sourceRequestControllers.delete(sourceId);
      }
    }
  }

  /** @param {string|URL} url @param {RequestInit} options @returns {Promise<unknown>} */
  fetchJson(url, options = {}) {
    return fetchJson(url, options);
  }

  /** @param {string} path @param {Record<string,string>} params @returns {URL} */
  urlWithQuery(path, params) {
    return urlWithQuery(path, params);
  }

  /** @param {HTMLElement} target @param {string[]} items @param {string} empty @returns {void} */
  renderList(target, items, empty) {
    renderTextList(target, items, empty);
  }

  /** @param {[number,number]} location @param {string[]} lines @returns {void} */
  openPopup(location, lines) {
    this.activePopup?.remove();
    this.activePopup = openTextPopup(this.map, location, lines);
  }
}
