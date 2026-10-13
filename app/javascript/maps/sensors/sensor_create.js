// Responsibility: POST one new Sensor with CSRF-protected JSON attributes.
// No Mapbox layers, map events or Stimulus lifecycle live here.
/** @module maps/sensor_create */
import { fetchJson } from "../shared/http"

/**
 * Create one geographic Sensor in the development-only Rails API.
 * @param {string} url - /api/sensors path
 * @param {{longitude: number, latitude: number, name: string,
 *   markerColor: string, markerIcon: string}} values - WGS 84 point and presentation
 * @param {{signal?: AbortSignal}} options - optional cancellation
 * @returns {Promise<Object>} created GeoJSON Feature (HTTP 201)
 * @throws {Error} when CSRF is missing or the request fails
 */
export async function createSensor(url, values, options = {}) {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content
  if (!csrf) throw new Error("Rails CSRF token is missing from the layout")

  return fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify({
      longitude: values.longitude,
      latitude: values.latitude,
      sensor: {
        name: values.name,
        marker_color: values.markerColor,
        marker_icon: values.markerIcon
      }
    }),
    signal: options.signal
  })
}