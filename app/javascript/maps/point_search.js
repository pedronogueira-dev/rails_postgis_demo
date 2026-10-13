// Responsibility: coordinate the *one* Point-click spatial search, radius event,
// and shared request cancellation. Feature modules own their own queries/views.
/** @module maps/point_search */

export class PointSearch {
  /** @param {Object} host - owning SpatialMap */
  constructor(host) {
    this.host = host
    this.radiusInput = host.requiredElement("[data-radius]")
    this.radiusValue = host.requiredElement("[data-radius-value]")
    this.providers = []
    this.lastPoint = host.center
    this.request = null
    this.onRadiusChange = () => this.handleRadiusChangeEvent()
  }

  /** @param {Object} provider - one domain's queryAt/renderQueryResult pair */
  addProvider(provider) { this.providers.push(provider) }

  /** Register only the radius-change DOM event. @returns {void} */
  addRadiusChangeEvent() {
    this.radiusInput.addEventListener("change", this.onRadiusChange)
  }

  /** Remove the radius-change event and abort searches. @returns {void} */
  removeRadiusChangeEvent() {
    this.radiusInput.removeEventListener("change", this.onRadiusChange)
    this.abort()
  }

  /** Rerun all current domain queries at the latest clicked Point. @returns {void} */
  handleRadiusChangeEvent() {
    void this.searchAt(...this.lastPoint)
  }

  /** @returns {void} */
  abort() {
    this.request?.abort()
    this.request = null
  }

  /**
   * Execute all Point-based queries with the same AbortSignal, and commit only
   * when every result belongs to the latest interaction.
   * @param {number} longitude @param {number} latitude @returns {Promise<void>}
   */
  async searchAt(longitude, latitude) {
    if (!this.host.sourcesReady()) return
    this.abort()
    const request = new AbortController()
    this.request = request
    this.lastPoint = [longitude, latitude]
    const radiusM = Number(this.radiusInput.value)
    this.radiusValue.textContent = radiusM
    this.host.statusElement.textContent = "Querying PostGIS..."
    try {
      const point = { longitude, latitude, radiusM }
      const results = await Promise.all(this.providers.map(provider =>
        provider.queryAt(point, request.signal)
      ))
      if (request.signal.aborted || this.request !== request ||
          !this.host.sourcesReady()) return
      this.providers.forEach((provider, index) => provider.renderQueryResult(results[index]))
      this.host.statusElement.textContent =
        `Queried ${longitude.toFixed(5)}, ${latitude.toFixed(5)}`
    } catch (error) {
      if (error.name === "AbortError" || request.signal.aborted ||
          this.request !== request) return
      console.error("Spatial Point query:", error)
      this.host.statusElement.textContent = `Spatial query failed: ${error.message}`
    } finally {
      if (this.request === request) this.request = null
    }
  }
}