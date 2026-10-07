class Sensor < ApplicationRecord
  validates :name, :location, presence: true


  def self.nearby(longitude:, latitude:, radius_m: 1_000)
    where(
      <<~SQL,
        ST_DWithin(
          sensors.location,
          ST_SetSRID(
            ST_MakePoint(:longitude, :latitude),
            4326
          )::geography,
          :radius_m
        )
      SQL
      longitude: longitude,
      latitude: latitude,
      radius_m: radius_m
    )
  end

  def self.search_area_geojson(longitude:, latitude:, radius_m:)
    sql = sanitize_sql_array(
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

    connection.select_value(sql)
  end
end
