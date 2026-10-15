// Responsibility: attach/detach the Sensor map when Turbo changes the DOM.
/** @module controllers/map_controller */
import { Controller } from "@hotwired/stimulus";
import { SpatialMap } from "../maps/spatial_map";

export default class extends Controller {
  /**
   * Attach the map and its DOM/Mapbox event listeners.
   * @returns {void}
   */
  connect() {
    this.spatialMap = new SpatialMap(this.element);
    this.spatialMap.connect();
  }

  /**
   * Abort in-flight requests and release listeners, popups and WebGL state.
   * @returns {void}
   * @note Called by Stimulus before Turbo disposes of or replaces the page.
   */
  disconnect() {
    this.spatialMap?.disconnect();
    this.spatialMap = null;
  }
}
