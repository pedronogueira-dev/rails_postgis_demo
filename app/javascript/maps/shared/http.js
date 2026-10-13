// Responsibility: HTTP JSON transport and same-origin query URL construction.
// No map state or DOM access belongs in this module.
/** @module maps/shared/http */

/**
 * Fetch JSON, preserving AbortSignal and throwing for non-2xx responses.
 * @param {string|URL} url - Rails API URL
 * @param {RequestInit} options - optional fetch settings
 * @returns {Promise<unknown>} decoded JSON
 * @throws {Error} on HTTP failures
 */
export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) }
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return response.json()
}

/**
 * Encode query values on a same-origin Rails API URL.
 * @param {string} path - Rails path
 * @param {Record<string, string>} params - query params
 * @returns {URL} encoded URL
 */
export function urlWithQuery(path, params) {
  const url = new URL(path, window.location.origin)
  url.search = new URLSearchParams(params).toString()
  return url
}