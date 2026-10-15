// Responsibility: GET Sensor reference/nearby data, render its GeoJSON sources,
// and show identity on feature clicks. Radius event state lives in PointSearch.
/** @module maps/sensors/sensor_read */
import { fetchJson, urlWithQuery } from "../shared/http";
import { renderTextList } from "../shared/dom";
import { installSensorStyle, prepareSensorCollection } from "./sensor_layers";

export class SensorRead {
  /** @param {Object} host - SpatialMap state and map utilities */
  constructor(host) {
    this.host = host;
    this.layerKey = "sensors";
    this.referenceUrl = host.root.dataset.sensorsUrl;
    this.nearbyUrl = host.root.dataset.nearbySensorsUrl;
    this.results = host.requiredElement("[data-sensor-results]");
    this.referenceRequest = null;
  }

  /** Install only Sensor-owned sources/layers. @returns {void} */
  installStyle() {
    installSensorStyle(this.host.map);
  }

  /** @returns {boolean} */
  ready() {
    const map = this.host.map;
    return Boolean(
      map?.getLayer("all-sensors") &&
      map?.getSource("all-sensors") &&
      map?.getSource("nearby-sensors") &&
      map?.getSource("search-area"),
    );
  }

  /** GET all Sensor features (later replaced by viewport loading). @returns {Promise<void>} */
  async refreshReference() {
    this.referenceRequest?.abort();
    const request = new AbortController();
    this.referenceRequest = request;
    try {
      const data = await fetchJson(this.referenceUrl, {
        signal: request.signal,
      });
      if (
        this.referenceRequest !== request ||
        request.signal.aborted ||
        !this.ready()
      )
        return;
      this.setReferenceData(data);
    } catch (error) {
      if (error.name !== "AbortError" && this.referenceRequest === request)
        throw error;
    } finally {
      if (this.referenceRequest === request) this.referenceRequest = null;
    }
  }

  /** @param {Object} collection @returns {void} */
  setReferenceData(collection) {
    this.host.map
      .getSource("all-sensors")
      .setData(prepareSensorCollection(this.host.map, collection));
  }

  /** @param {{longitude:number,latitude:number,radiusM:number}} point @param {AbortSignal} signal @returns {Promise<Object>} */
  queryAt(point, signal) {
    return fetchJson(
      urlWithQuery(this.nearbyUrl, {
        longitude: String(point.longitude),
        latitude: String(point.latitude),
        radius_m: String(point.radiusM),
      }),
      { signal },
    );
  }

  /** @param {Object} data - {sensors, search_area} @returns {void} */
  renderQueryResult(data) {
    this.host.map
      .getSource("nearby-sensors")
      .setData(prepareSensorCollection(this.host.map, data.sensors));
    this.host.map.getSource("search-area").setData(data.search_area);
    const names = data.sensors.features.map(
      (feature) => feature.properties.name,
    );
    if (data.meta?.truncated) {
      names.push(
        `Partial results (first ${data.meta.limit}); narrow the search area.`,
      );
    }
    renderTextList(this.results, names, "No sensors in the selected radius.");
  }

  /** @param {mapboxgl.PointLike} point @returns {boolean} */
  hasFeatureAt(point) {
    return Boolean(
      this.host.featureAt(point, ["nearby-sensors", "all-sensors"]),
    );
  }

  /** @param {mapboxgl.MapMouseEvent} event @returns {boolean} */
  handleMapClickEvent(event) {
    const feature = this.host.featureAt(event.point, [
      "nearby-sensors",
      "all-sensors",
    ]);
    if (!feature) return false;
    this.host.pointSearch.abort();
    this.host.showPopup(feature.geometry.coordinates, [
      feature.properties.name,
    ]);
    this.host.statusElement.textContent =
      "Sensor selected; no nearby query was sent.";
    return true;
  }

  /** Forget result-list text when this domain is hidden; no stale UI claims. */
  clearResults() {
    renderTextList(this.results, [], "Sensors disabled.");
  }

  /** @returns {void} */
  disconnect() {
    this.referenceRequest?.abort();
    this.referenceRequest = null;
  }
}
