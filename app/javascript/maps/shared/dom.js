// Responsibility: safe map-page DOM rendering, text-only popups, and required hooks.
// Shared by the Sensor and wastewater maps; never inject API strings as HTML.
/** @module maps/shared/dom */
import mapboxgl from "mapbox-gl";

/** @param {HTMLElement} root @param {string} selector @param {string} label @returns {Element} */
export function requiredElement(root, selector, label) {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`${label} is missing ${selector}`);
  return el;
}

/** @param {HTMLElement} target @param {string[]} values @param {string} emptyMessage @returns {void} */
export function renderTextList(target, values, emptyMessage) {
  const messages = values.length ? values : [emptyMessage];
  target.replaceChildren(
    ...messages.map((value) => {
      const li = document.createElement("li");
      li.textContent = value;
      return li;
    }),
  );
}

/**
 * Create a Mapbox popup with text-only lines; the caller owns popup removal.
 * @param {mapboxgl.Map} map @param {[number, number]} coords @param {string[]} lines
 * @returns {mapboxgl.Popup} popup
 */
export function openTextPopup(map, coords, lines) {
  const content = document.createElement("div");
  lines.forEach((line) => {
    const row = document.createElement("div");
    row.textContent = line;
    content.append(row);
  });
  return new mapboxgl.Popup()
    .setLngLat(coords)
    .setDOMContent(content)
    .addTo(map);
}
