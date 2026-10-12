import * as mapboxgl from "mapbox-gl/esm";

const EMPTY_FEATURE_COLLECTION = { type: "FeatureCollection", features: [] };

export class SpatialMap {
  constructor(root) {
    this.root = root;

    this.canvas = this.requiredElement("[data-map-canvas]");
    this.radiusInput = this.requiredElement("[data-radius]");
    this.radiusValue = this.requiredElement("[data-radius-value]");
    this.statusElement = this.requiredElement("[data-status]");
    this.sensorResults = this.requiredElement("[data-sensor-results]");

    this.accessToken = root.dataset.accessToken;
    this.center = JSON.parse(root.dataset.center);
    this.zoom = Number(root.dataset.zoom);
    this.sensorsUrl = root.dataset.sensorsUrl;
    this.nearbySensorsUrl = root.dataset.nearbySensorsUrl;

    this.searchCenter = this.center;
    this.onRadiusChange = () => this.radiusChanged();
  }

  connect() {
    this.radiusInput.addEventListener("change", this.onRadiusChange);

    this.map = new mapboxgl.Map({
      accessToken: this.accessToken,
      container: this.canvas,
      style: "mapbox://styles/mapbox/standard",
      center: this.center,
      zoom: this.zoom,
    });

    this.map.addControl(new mapboxgl.NavigationControl(), "top-right");
    this.map.on("load", () => this.handleMapLoad());
    this.map.on("click", (event) => this.handleMapClick(event));
  }

  disconnect() {
    this.radiusInput.removeEventListener("change", this.onRadiusChange);
    this.map?.remove();
    this.map = null;
  }

  requiredElement(selector) {
    const element = this.root.querySelector(selector);
    if (!element) throw new Error(`Spatial map is missing ${selector}`);

    return element;
  }

  radiusChanged() {
    if (!this.map?.loaded()) return;

    this.searchAt(this.searchCenter[0], this.searchCenter[1]);
  }

  async handleMapLoad() {
    this.addSensorSources();
    this.addSensorLayers();
    this.addSensorInteractions();

    await this.loadSource(this.sensorsUrl, "all-sensors");
    await this.searchAt(this.center[0], this.center[1]);
  }

  addSensorSources() {
    ["search-area", "all-sensors", "nearby-sensors"].forEach((id) => {
      this.map.addSource(id, {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
      });
    });
  }

  addSensorLayers() {
    this.map.addLayer({
      id: "search-area-fill",
      type: "fill",
      slot: "middle",
      source: "search-area",
      paint: { "fill-color": "#2563eb", "fill-opacity": 0.12 },
    });

    this.map.addLayer({
      id: "search-area-outline",
      type: "line",
      slot: "middle",
      source: "search-area",
      paint: { "line-color": "#2563eb", "line-width": 2 },
    });

    this.map.addLayer({
      id: "all-sensors",
      type: "circle",
      source: "all-sensors",
      paint: {
        "circle-radius": 6,
        "circle-color": "#334155",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });

    this.map.addLayer({
      id: "nearby-sensors",
      type: "circle",
      source: "nearby-sensors",
      paint: {
        "circle-radius": 10,
        "circle-color": "#dc2626",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
    });
  }

  addSensorInteractions() {
    this.map.on("click", "all-sensors", (event) => {
      const feature = event.features?.[0];
      if (!feature) return;

      this.openPopup(feature.geometry.coordinates, [feature.properties.name]);
    });

    this.map.on("mouseenter", "all-sensors", () => {
      this.map.getCanvas().style.cursor = "pointer";
    });

    this.map.on("mouseleave", "all-sensors", () => {
      this.map.getCanvas().style.cursor = "";
    });
  }

  handleMapClick(event) {
    const featureHits = this.map.queryRenderedFeatures(event.point, {
      layers: ["all-sensors"],
    });

    if (featureHits.length > 0) return;

    this.searchAt(event.lngLat.lng, event.lngLat.lat);
  }

  async searchAt(longitude, latitude) {
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
      );

      this.map.getSource("nearby-sensors").setData(data.sensors);
      this.map.getSource("search-area").setData(data.search_area);

      this.renderList(
        this.sensorResults,
        data.sensors.features.map((feature) => feature.properties.name),
        "No sensors in the selected radius.",
      );

      this.statusElement.textContent = `Queried ${longitude.toFixed(5)}, ${latitude.toFixed(5)}`;
    } catch (error) {
      console.error(error);
      this.statusElement.textContent =
        "The Sensor API request failed. Check the Rails logs.";
    }
  }

  async loadSource(url, sourceId) {
    this.map.getSource(sourceId).setData(await this.fetchJson(url));
  }

  async fetchJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  urlWithQuery(path, params) {
    const url = new URL(path, window.location.origin);
    url.search = new URLSearchParams(params).toString();
    return url;
  }

  renderList(target, items, emptyMessage) {
    const values = items.length > 0 ? items : [emptyMessage];
    target.replaceChildren(...values.map((value) => this.listItem(value)));
  }

  listItem(value) {
    const item = document.createElement("li");
    item.textContent = value;
    return item;
  }

  openPopup(location, lines) {
    const content = document.createElement("div");

    lines.forEach((line) => {
      const row = document.createElement("div");
      row.textContent = line;
      content.append(row);
    });

    new mapboxgl.Popup()
      .setLngLat(location)
      .setDOMContent(content)
      .addTo(this.map);
  }
}
