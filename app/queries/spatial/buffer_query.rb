module Spatial
  # Builds a derived geography buffer around an input WGS 84 point.
  class BufferQuery
    # @param longitude [Numeric] buffer-center longitude in decimal degrees
    # @param latitude [Numeric] buffer-center latitude in decimal degrees
    # @param radius_m [Numeric] geography buffer radius in metres
    # @return [Hash] GeoJSON geometry hash representing the derived Polygon
    def self.call(longitude:, latitude:, radius_m:)
      sql = ApplicationRecord.sanitize_sql_array(
        [
          <<~SQL,
            SELECT ST_AsGeoJSON(
              ST_Buffer(
                ST_SetSRID(
                  ST_MakePoint(:longitude, :latitude),
                  4326
                )::geography,
                :radius_m
              )::geometry
            )
          SQL
          {
            longitude: longitude,
            latitude: latitude,
            radius_m: radius_m
          }
        ]
      )

      JSON.parse(ApplicationRecord.connection.select_value(sql))
    end
  end
end
