// Responsibility: attach/remove the isolated Mapbox renderer diagnostic on
// Turbo/Stimulus connect/disconnect; no Sensor or wastewater API is involved.
/** @module controllers/basemap_diagnostic_controller */
import { Controller } from "@hotwired/stimulus";
import { BasemapDiagnostic } from "../maps/basemap_diagnostic";

export default class extends Controller {
  /** @returns {void} */
  connect() {
    this.diagnostic = new BasemapDiagnostic(this.element);
    this.diagnostic.connect();
  }

  /** @returns {void} */
  disconnect() {
    this.diagnostic?.disconnect();
    this.diagnostic = null;
  }
}
