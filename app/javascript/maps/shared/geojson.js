// Responsibility: empty GeoJSON source data reused during map startup and reset.
/** @module maps/shared/geojson */

/** @type {{type: "FeatureCollection", features: Object[]}} */
export const EMPTY_FEATURE_COLLECTION = {
  type: "FeatureCollection",
  features: [],
};
