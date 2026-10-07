module Geojson
  class Feature
    def initialize(geometry:, properties: {}, id: nil)
      @geometry = geometry
      @properties = properties
      @id = id
    end

    def as_json(*)
      {
        type: "Feature",
        geometry: encoded_geometry,
        properties: @properties
      }.tap do |feature|
        feature[:id] = @id unless @id.nil?
      end
    end

    private

    def encoded_geometry
      return @geometry if @geometry.is_a?(Hash)

      RGeo::GeoJSON.encode(@geometry)
    end
  end
end
