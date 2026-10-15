// Responsibility: own Sensor CREATE mode, its button event, request cancellation
// and one-shot map placement. The Sensor read/query components remain independent.
/** @module maps/sensor_placement */
import { createSensor } from "./sensor_create";

export class SensorPlacement {
  /** @param {Object} host - owning SpatialMap */
  constructor(host) {
    this.host = host;
    this.layerKey = "sensors";
    this.button = host.requiredElement("[data-placement-button]");
    this.nameInput = host.requiredElement("[data-sensor-name]");
    this.colorInput = host.requiredElement("[data-sensor-color]");
    this.iconInput = host.requiredElement("[data-sensor-icon]");
    this.url = host.root.dataset.createSensorUrl;
    this.armed = false;
    this.request = null;
    this.onPlacementClick = () => this.handlePlacementButtonEvent();
  }

  /** Wire and enable the placement button only when the behavior exists. @returns {void} */
  addSensorPlacementEvent() {
    this.button.disabled = false;
    this.button.removeAttribute("aria-disabled");
    this.button.addEventListener("click", this.onPlacementClick);
    this.renderPlacementState();
  }

  /** Remove the exact listener, cancel a request, and restore disabled state. @returns {void} */
  removeSensorPlacementEvent() {
    this.button.removeEventListener("click", this.onPlacementClick);
    this.request?.abort();
    this.request = null;
    this.armed = false;
    this.button.disabled = true;
    this.button.setAttribute("aria-disabled", "true");
    this.renderPlacementState();
  }

  /** Keep placement disabled when Sensor data is deactivated. @param {boolean} enabled */
  setAvailable(enabled) {
    if (!enabled) this.armed = false;
    this.button.disabled = !enabled || Boolean(this.request);
    this.button.setAttribute("aria-disabled", String(this.button.disabled));
    this.renderPlacementState();
  }

  /** @returns {void} */
  handlePlacementButtonEvent() {
    if (this.request) return;
    if (!this.host.sourcesReady()) {
      this.host.statusElement.textContent =
        "Wait for the Sensor map layers to load.";
      return;
    }
    this.armed = !this.armed;
    this.renderPlacementState();
    this.host.statusElement.textContent = this.armed
      ? "Placement armed: click once on the map or cancel."
      : "Placement cancelled.";
  }

  /** @returns {void} */
  renderPlacementState() {
    this.button.textContent = this.armed ? "Cancel placement" : "Place sensor";
    if (this.host.map)
      this.host.map.getCanvas().style.cursor = this.armed ? "crosshair" : "";
  }

  /** @param {mapboxgl.MapMouseEvent} event @returns {boolean} */
  handleMapClickEvent(event) {
    if (!this.armed) return false;
    if (!this.request)
      void this.placeSensor(event.lngLat.lng, event.lngLat.lat);
    return true;
  }

  /** POST owns the write outcome; view refreshing cannot change it.
   * @param {number} longitude @param {number} latitude @returns {Promise<void>} */
  async placeSensor(longitude, latitude) {
    if (this.request) return;
    const request = new AbortController();
    this.request = request;
    this.button.disabled = true;
    this.host.statusElement.textContent = "Creating Sensor...";
    let created;
    try {
      created = await this.createSensorAt(longitude, latitude, request.signal);
    } catch (error) {
      if (error.name !== "AbortError" && this.host.map)
        this.showCreateFailure(error);
      return;
    } finally {
      if (this.request === request) {
        this.request = null;
        if (this.host.map) this.button.disabled = false;
      }
    }
    if (request.signal.aborted || !this.host.map) return;
    this.showCreateSuccess(created);
    await this.refreshAfterCreate(created);
  }

  /** Only this operation sends a write request. @returns {Promise<Object>} */
  createSensorAt(longitude, latitude, signal) {
    return createSensor(
      this.url,
      {
        longitude,
        latitude,
        name: this.nameInput.value,
        markerColor: this.colorInput.value,
        markerIcon: this.iconInput.value,
      },
      { signal },
    );
  }

  /** Successful persistence is acknowledged before the optional read refresh.
   * @param {Object} feature @returns {void} */
  showCreateSuccess(feature) {
    this.armed = false;
    this.renderPlacementState();
    this.host.statusElement.textContent = `Created Sensor: ${feature.properties.name}`;
    this.host.showPopup(feature.geometry.coordinates, [
      feature.properties.name,
      "Sensor created",
    ]);
  }

  /** Read-side failure must never encourage a duplicate POST retry.
   * @param {Object} feature @returns {Promise<void>} */
  async refreshAfterCreate(feature) {
    try {
      await (this.host.viewport
        ? this.host.viewport.loadVisibleFeatures()
        : this.host.sensors.refreshReference());
    } catch (error) {
      if (!this.host.map) return; // Turbo disconnected during the refresh.
      console.error("Sensor reference refresh:", error);
      this.host.statusElement.textContent = `Sensor ${feature.properties.name} was saved, but map refresh failed. Reload the map; do not create it again.`;
    }
  }

  /** @param {Error} error @returns {void} */
  showCreateFailure(error) {
    console.error("Sensor creation:", error);
    this.host.statusElement.textContent = `Sensor creation failed: ${error.message}`;
  }
}
