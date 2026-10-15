// Responsibility: WalkingRoute LineString layers, reference GET, nearby query,
// and route selection. No Sensor creation or general map lifecycle here.
/** @module maps/routes/walking_routes */
import { fetchJson, urlWithQuery } from "../shared/http";
import { renderTextList } from "../shared/dom";
import { installWalkingRouteStyle } from "./walking_route_layers";

export class WalkingRoutes {
  /** @param {Object} host - SpatialMap */
  constructor(host) {
    this.host = host;
    this.layerKey = "walking_routes";
    this.url = host.root.dataset.walkingRoutesUrl;
    this.nearbyUrl = host.root.dataset.nearbyWalkingRoutesUrl;
    this.distanceM = Number(host.root.dataset.routeDistance);
    this.results = host.requiredElement("[data-route-results]");
    this.request = null;
  }

  /** Delegate only Mapbox paint/source configuration to this domain's style file. */
  installStyle() {
    installWalkingRouteStyle(this.host.map);
  }

  /** @returns {Promise<void>} */
  async refreshReference() {
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    try {
      const data = await fetchJson(this.url, { signal: request.signal });
      if (
        !request.signal.aborted &&
        this.request === request &&
        this.host.map?.getSource("walking-routes")
      ) {
        this.setReferenceData(data);
      }
    } catch (error) {
      if (error.name !== "AbortError" && this.request === request) throw error;
    } finally {
      if (this.request === request) this.request = null;
    }
  }

  /** @param {Object} collection @returns {void} */
  setReferenceData(collection) {
    this.host.map.getSource("walking-routes")?.setData(collection);
  }

  /** @param {{longitude:number,latitude:number}} point @param {AbortSignal} signal @returns {Promise<Object>} */
  queryAt(point, signal) {
    return fetchJson(
      urlWithQuery(this.nearbyUrl, {
        longitude: String(point.longitude),
        latitude: String(point.latitude),
        distance_m: String(this.distanceM),
      }),
      { signal },
    );
  }

  /** @param {Object} data @returns {void} */
  renderQueryResult(data) {
    this.host.map.getSource("nearby-walking-routes")?.setData(data);
    const descriptions = data.features.map(
      (feature) =>
        `${feature.properties.name} — ${Number(feature.properties.distance_m).toFixed(1)} m away`,
    );
    if (data.meta?.truncated) {
      descriptions.push(
        `Partial route results (first ${data.meta.limit}); reduce the distance.`,
      );
    }
    renderTextList(
      this.results,
      descriptions,
      `No route within ${this.distanceM} m.`,
    );
  }

  /** @param {mapboxgl.PointLike} point @returns {boolean} */
  hasFeatureAt(point) {
    return Boolean(
      this.host.featureAt(point, ["nearby-walking-routes", "walking-routes"]),
    );
  }

  /** @param {mapboxgl.MapMouseEvent} event @returns {boolean} */
  handleMapClickEvent(event) {
    const feature = this.host.featureAt(event.point, [
      "nearby-walking-routes",
      "walking-routes",
    ]);
    if (!feature) return false;
    this.host.pointSearch.abort();
    this.host.showPopup(event.lngLat, [
      feature.properties.name,
      `Length: ${Number(feature.properties.length_m).toFixed(1)} m`,
    ]);
    return true;
  }

  /** No nearby routes should remain visible in the UI when disabled. */
  clearResults() {
    renderTextList(this.results, [], "Walking routes disabled.");
  }

  /** @returns {void} */
  disconnect() {
    this.request?.abort();
    this.request = null;
  }
}
