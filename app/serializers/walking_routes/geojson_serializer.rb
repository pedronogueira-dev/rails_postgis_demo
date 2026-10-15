module WalkingRoutes
  # Convert one domain model record to a transport-only GeoJSON Feature.
  class GeojsonSerializer
    # Wrap the domain record without querying or mutating it.
    # @param route [WalkingRoute] route record to encode
    # @return [void]
    def initialize(route)
      @route = route
    end

    # Serialize this record to a GeoJSON Feature.
    # @return [Hash] serialized GeoJSON object or domain attribute hash
    def as_json(*)
      Geojson::Feature.new(
        id: @route.id,
        geometry: @route.path,
        properties: {
          name: @route.name,
          length_m: metric(:length_m),
          distance_m: metric(:distance_m)
        }.compact
      ).as_json
    end

    private

    # Read the computed metric associated with a serialized feature.
    # @param name [Symbol, String] metric or field name
    # @return [Numeric, nil] computed database metric, or nil when unavailable
    def metric(name)
      return unless @route.has_attribute?(name)

      @route[name]&.to_f&.round(1)
    end
  end
end