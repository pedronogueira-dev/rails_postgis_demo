class Sensor < ApplicationRecord
  validates :name, :location, presence: true

  # Finds sensors whose geography Point is within a radius of a WGS 84 point.
  #
  # `ST_DWithin` is used as the predicate so PostGIS can use the GiST index on
  # `sensors.location` when that is cheaper than a sequential scan.
  #
  # @param longitude [Numeric] query-point longitude in decimal degrees
  # @param latitude [Numeric] query-point latitude in decimal degrees
  # @param radius_m [Numeric] maximum geography distance in metres
  # @return [ActiveRecord::Relation] a composable relation containing matching
  #   sensors
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
end
