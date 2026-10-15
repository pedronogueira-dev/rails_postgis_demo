// Responsibility: own the single Mapbox click/hover listener and dispatch one
// user event to the highest-priority domain behavior. No HTTP or GeoJSON here.
/** @module maps/tiny_demo/map_click_dispatcher */

export class MapClickDispatcher {
  /** @param {Object} host - owning SpatialMap */
  constructor(host) {
    this.host = host;
    this.onMapClick = (event) => this.handleMapClickEvent(event);
    this.onMapMove = (event) => this.handleMapMoveEvent(event);
    this.eventsAdded = false;
  }

  /** Attach exactly one map-wide click and hover listener. @returns {void} */
  addMapClickEvent() {
    if (!this.host.map || this.eventsAdded) return;
    this.host.map.on("click", this.onMapClick);
    this.host.map.on("mousemove", this.onMapMove);
    this.eventsAdded = true;
  }

  /** Remove the exact callback references installed by addMapClickEvent. @returns {void} */
  removeMapClickEvent() {
    if (!this.host.map || !this.eventsAdded) return;
    this.host.map.off("click", this.onMapClick);
    this.host.map.off("mousemove", this.onMapMove);
    this.eventsAdded = false;
  }

  /** @param {mapboxgl.MapMouseEvent} event @returns {void} */
  handleMapClickEvent(event) {
    if (!this.host.sourcesReady()) return;
    for (const behavior of this.host.clickPriority()) {
      if (behavior?.handleMapClickEvent?.(event)) {
        if (
          behavior !== this.host.parks &&
          behavior !== this.host.intersections
        ) {
          this.host.intersections?.clearSelection();
        }
        return;
      }
    }
    this.host.intersections?.clearSelection();
    this.host.removePopup();
    void this.host.pointSearch.searchAt(event.lngLat.lng, event.lngLat.lat);
  }

  /** @param {mapboxgl.MapMouseEvent} event @returns {void} */
  handleMapMoveEvent(event) {
    if (!this.host.map || !this.host.sourcesReady()) return;
    const cursor = this.host.placement?.armed
      ? "crosshair"
      : this.host
            .clickPriority()
            .some((behavior) => behavior?.hasFeatureAt?.(event.point))
        ? "pointer"
        : "";
    this.host.map.getCanvas().style.cursor = cursor;
  }
}
