import { Controller } from "@hotwired/stimulus";
import { SpatialMap } from "../maps/spatial_map";

export default class extends Controller {
  connect() {
    this.spatialMap = new SpatialMap(this.element);
    this.spatialMap.connect();
  }

  disconnect() {
    this.spatialMap?.disconnect();
    this.spatialMap = null;
  }
}
