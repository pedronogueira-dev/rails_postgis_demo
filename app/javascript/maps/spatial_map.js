// Responsibility: compose independent map behaviors and own Mapbox lifecycle.
// Feature rendering, HTTP, click dispatch and DOM events live in focused modules.
/** @module maps/spatial_map */
import { createBasemap } from "./shared/basemap";
import { requiredElement, openTextPopup } from "./shared/dom";
import { SensorRead } from "./sensors/sensor_read";
import { SensorPlacement } from "./sensors/sensor_placement";
import { WalkingRoutes } from "./routes/walking_routes";

import { PointSearch } from "./point_search";
import { MapClickDispatcher } from "./tiny_demo/map_click_dispatcher";
import { LayerActivation } from "./tiny_demo/layer_activation";

export class SpatialMap {
  /** @param {HTMLElement} root - Stimulus map root with Rails data attributes */
  constructor(root) {
    this.root = root;
    this.canvas = this.requiredElement("[data-map-canvas]");
    this.statusElement = this.requiredElement("[data-status]");
    this.basemapStatus = this.requiredElement("[data-basemap-status]");
    this.center = JSON.parse(root.dataset.center);
    this.zoom = Number(root.dataset.zoom);
    this.map = null;
    this.popup = null;
    this.sensors = new SensorRead(this);
    this.layers = new LayerActivation(this);
    this.layers.register("sensors", {
      behavior: this.sensors,
      layerIds: [
        "search-area-fill",
        "search-area-outline",
        "all-sensors",
        "nearby-sensor-halo",
        "nearby-sensors",
      ],
      sourceIds: ["all-sensors", "nearby-sensors", "search-area"],
    });
    this.pointSearch = new PointSearch(this);
    this.pointSearch.addProvider(this.sensors);
    this.placement = new SensorPlacement(this);
    this.routes = new WalkingRoutes(this);
    this.layers.register("walking_routes", {
      behavior: this.routes,
      layerIds: ["walking-routes", "nearby-walking-routes"],
      sourceIds: ["walking-routes", "nearby-walking-routes"],
    });
    this.pointSearch.addProvider(this.routes);

    this.clicks = new MapClickDispatcher(this);
  }

  /** Register each behavior's DOM events, then create the basemap. @returns {void} */
  connect() {
    this.pointSearch.addRadiusChangeEvent();
    this.layers.addLayerToggleEvents();
    this.placement.addSensorPlacementEvent();
    this.placement.setAvailable(this.layers.isEnabled("sensors"));

    this.startBasemap();
  }

  /** Remove each behavior's listeners/requests, then release WebGL. @returns {void} */
  disconnect() {
    this.pointSearch.removeRadiusChangeEvent();
    this.clicks.removeMapClickEvent();
    this.sensors.disconnect();
    this.routes.disconnect();
    this.layers.removeLayerToggleEvents();
    this.placement.removeSensorPlacementEvent();

    this.removePopup();
    this.map?.remove();
    this.map = null;
  }

  /** @param {string} selector @returns {HTMLElement} */
  requiredElement(selector) {
    return requiredElement(this.root, selector, "Spatial map");
  }

  /** @returns {boolean} */
  sourcesReady() {
    return Boolean(this.map && this.sensors.ready());
  }

  /** @returns {Array<Object>} active behaviors ordered by click priority */
  clickPriority() {
    return [this.placement, this.sensors, this.routes].filter((behavior) =>
      this.layers.isEnabled(behavior.layerKey),
    );
  }

  /** @param {mapboxgl.PointLike} point @param {string[]} layers @returns {Object|null} */
  featureAt(point, layers) {
    if (!this.map) return null;
    const available = layers.filter((id) => this.map.getLayer(id));
    if (!available.length) return null;
    const hits = this.map.queryRenderedFeatures(point, { layers: available });
    for (const id of available) {
      const match = hits.find((hit) => hit.layer.id === id);
      if (match) return match;
    }
    return null;
  }

  /** @param {number[]|Object} coords @param {string[]} lines @returns {void} */
  showPopup(coords, lines) {
    this.removePopup();
    this.popup = openTextPopup(this.map, coords, lines);
  }

  /** @returns {void} */
  removePopup() {
    this.popup?.remove();
    this.popup = null;
  }

  /** Only reference domains enabled by their checkboxes can make GET requests. */
  refreshReferenceLayers() {
    return Promise.all(
      [this.sensors, this.routes, this.parks]
        .filter(Boolean)
        .filter(
          (behavior) => this.layers?.isEnabled(behavior.layerKey) !== false,
        )
        .map((behavior) => behavior.refreshReference()),
    );
  }

  /** @returns {void} */
  startBasemap() {
    const token = this.root.dataset.accessToken;
    if (!token?.startsWith("pk.") || token.startsWith("pk.replace")) {
      this.basemapStatus.textContent = "Set a valid public Mapbox token.";
      return;
    }
    this.basemapStatus.textContent = "Loading Mapbox Streets...";
    try {
      this.map = createBasemap({
        container: this.canvas,
        accessToken: token,
        center: this.center,
        zoom: this.zoom,
        onStyleReady: () => {
          void this.handleStyleReady();
        },
        onIdle: () => {
          this.basemapStatus.textContent = "Basemap rendered.";
        },
        onError: (error) => {
          console.error("Mapbox style/tile error:", error);
          this.basemapStatus.textContent = `Basemap error: ${error.message}`;
        },
      });
    } catch (error) {
      console.error("Mapbox startup:", error);
      this.basemapStatus.textContent = `Basemap failed: ${error.message}`;
    }
  }

  /** Install each domain's style, add Mapbox events, and load reference data. */
  async handleStyleReady() {
    if (!this.map || this.sourcesReady()) return;
    try {
      this.sensors.installStyle();
      this.routes.installStyle();
      this.clicks.addMapClickEvent();
      this.layers.applyAll();
      await this.refreshReferenceLayers();
      if (this.map) await this.pointSearch.searchAt(...this.center);
    } catch (error) {
      console.error("Sensor map setup:", error);
      this.statusElement.textContent = `Sensor map failed: ${error.message}`;
    }
  }
}
