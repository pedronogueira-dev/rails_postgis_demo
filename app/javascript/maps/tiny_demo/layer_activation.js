// Responsibility: own checkbox listeners and translate Part 1 domain activation
// into source visibility, request cancellation, and dependent selection cleanup.
// No SQL, no controller registration, no generic event-bus abstractions.
/** @module maps/tiny_demo/layer_activation */
import { EMPTY_FEATURE_COLLECTION } from "../shared/geojson";

export class LayerActivation {
  /** @param {Object} host - SpatialMap composition root */
  constructor(host) {
    this.host = host;
    this.entries = new Map();
    this.inputs = new Map();
    this.status = host.requiredElement("[data-demo-layer-status]");
    this.onToggle = (event) => this.handleLayerToggleEvent(event);
    this.enableAll = host.requiredElement("[data-enable-demo-layers]");
    this.disableAll = host.requiredElement("[data-disable-demo-layers]");
    this.onEnableAll = () => this.handleBulkLayerEvent(true);
    this.onDisableAll = () => this.handleBulkLayerEvent(false);
  }

  /** Each domain declares its actual styles/sources, avoiding guessed IDs. */
  register(key, { behavior, layerIds, sourceIds }) {
    this.entries.set(key, { behavior, layerIds, sourceIds });
  }

  /** @returns {string[]} user-enabled domains in an unambiguous order */
  enabledKeys() {
    return [...this.entries.keys()].filter((key) => this.isEnabled(key));
  }

  /** @param {string} key @returns {boolean} */
  isEnabled(key) {
    return this.inputs.get(key)?.checked ?? true;
  }

  /** Attach the precise checkbox listeners owned by this behavior. */
  addLayerToggleEvents() {
    for (const input of this.host.root.querySelectorAll("[data-demo-layer]")) {
      const key = input.dataset.demoLayer;
      if (!this.entries.has(key)) continue;
      input.addEventListener("change", this.onToggle);
      this.inputs.set(key, input);
    }
    this.addBulkLayerEvents();
    this.renderStatus();
  }

  /** Bulk controls are separately named but share the same layer-state policy. */
  addBulkLayerEvents() {
    this.enableAll.addEventListener("click", this.onEnableAll);
    this.disableAll.addEventListener("click", this.onDisableAll);
  }

  /** Remove listeners and leave no DOM state after Turbo disconnection. */
  removeLayerToggleEvents() {
    for (const input of this.inputs.values()) {
      input.removeEventListener("change", this.onToggle);
    }
    this.inputs.clear();
    this.removeBulkLayerEvents();
  }

  /** Symmetric teardown for both explicit action buttons. */
  removeBulkLayerEvents() {
    this.enableAll.removeEventListener("click", this.onEnableAll);
    this.disableAll.removeEventListener("click", this.onDisableAll);
  }

  /** @param {Event} event */
  handleLayerToggleEvent(event) {
    const key = event.currentTarget.dataset.demoLayer;
    // Do not hide an in-flight write: aborting the browser cannot undo a DB COMMIT.
    if (key === "sensors" && this.host.placement?.request) {
      event.currentTarget.checked = true;
      this.host.statusElement.textContent =
        "Finish Sensor creation before hiding the layer.";
      return;
    }
    this.host.pointSearch.abort();
    this.host.removePopup();
    this.applyLayer(key);
    this.syncCrossGeometrySelection();
    this.host.placement?.setAvailable(this.isEnabled("sensors"));
    this.renderStatus();
    // One fresh spatial query; stale responses are invalidated before repaint.
    void this.host.pointSearch.searchAt(...this.host.pointSearch.lastPoint);
    void this.refreshReferenceAfterToggle(key);
  }

  /** Apply one bulk change without issuing one viewport request per checkbox. */
  handleBulkLayerEvent(enabled) {
    if (!enabled && this.host.placement?.request) {
      this.host.statusElement.textContent = "Finish Sensor creation first.";
      return;
    }
    this.host.pointSearch.abort();
    this.host.removePopup();
    for (const [key, input] of this.inputs) {
      input.checked = enabled;
      this.applyLayer(key);
    }
    this.syncCrossGeometrySelection();
    this.host.placement?.setAvailable(this.isEnabled("sensors"));
    this.renderStatus();
    void this.host.pointSearch.searchAt(...this.host.pointSearch.lastPoint);
    if (!this.host.sourcesReady()) return;
    if (this.host.viewport) void this.host.viewport.loadVisibleFeatures();
    else if (enabled) void this.host.refreshReferenceLayers();
  }

  /** Hide/show ONLY layers already installed by the owning domain. */
  applyLayer(key) {
    const entry = this.entries.get(key);
    if (!entry) return;
    const active = this.isEnabled(key);
    for (const layerId of entry.layerIds) {
      if (this.host.map?.getLayer(layerId)) {
        this.host.map.setLayoutProperty(
          layerId,
          "visibility",
          active ? "visible" : "none",
        );
      }
    }
    if (!active) {
      entry.behavior?.disconnect?.(); // abort reference GET, not a database mutation
      entry.behavior?.clearResults?.(); // remove old nearby/containment list items
      for (const sourceId of entry.sourceIds) {
        this.host.map?.getSource(sourceId)?.setData(EMPTY_FEATURE_COLLECTION);
      }
    }
  }

  /** Apply current controls AFTER Mapbox source/layer installation. */
  applyAll() {
    for (const key of this.entries.keys()) this.applyLayer(key);
    this.syncCrossGeometrySelection();
  }

  /** Cross-geometry cyan overlay needs BOTH routes and polygons enabled. */
  syncCrossGeometrySelection() {
    const active =
      this.isEnabled("walking_routes") && this.isEnabled("park_areas");
    if (!active) this.host.intersections?.clearSelection();
    const id = "park-area-intersecting-routes";
    if (this.host.map?.getLayer(id)) {
      this.host.map.setLayoutProperty(
        id,
        "visibility",
        active ? "visible" : "none",
      );
    }
  }

  /** New visible data is loaded once; disabled data is never re-requested. */
  async refreshReferenceAfterToggle(key) {
    if (!this.host.sourcesReady()) return; // a checkbox can change before style.load
    try {
      if (this.host.viewport) {
        await this.host.viewport.loadVisibleFeatures();
      } else if (this.isEnabled(key)) {
        await this.entries.get(key).behavior.refreshReference();
      }
    } catch (error) {
      console.error("Layer reference refresh:", error);
      this.host.statusElement.textContent = `Layer refresh failed: ${error.message}`;
    }
  }

  /** Pure DOM status; closing a disclosure panel never changes these values. */
  renderStatus() {
    this.status.textContent = `${this.enabledKeys().length} of ${this.entries.size} layers enabled.`;
  }
}
