# Store geography LineStrings with metre-based length and proximity methods.
class WalkingRoute < ApplicationRecord
  validates :name, :path, presence: true

  # Adds the PostGIS-computed geodesic length to each selected route.
  #
  # @return [ActiveRecord::Relation<WalkingRoute>] routes with `length_m`
  #   selected as a virtual result attribute
  scope :with_length, -> {
    select("walking_routes.*, ST_Length(walking_routes.path) AS length_m")
  }

  # Finds LineStrings within a geography distance of a WGS 84 Point.
  #
  # ST_DWithin performs the threshold filter first; ST_Distance is calculated
  # only for the matching rows so the API can display/order the exact metric.
  #
  # @param longitude [Numeric] query longitude in decimal degrees
  # @param latitude [Numeric] query latitude in decimal degrees
  # @param distance_m [Numeric] maximum distance in metres
  # @return [ActiveRecord::Relation<WalkingRoute>] matching routes with
  #   `length_m` and `distance_m` selected
  def self.near_point(longitude:, latitude:, distance_m: 250)
    point_sql = sanitize_sql_array(
      [
        "ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography",
        { longitude: longitude, latitude: latitude }
      ]
    )

    with_length
      .where("ST_DWithin(walking_routes.path, #{point_sql}, ?)", distance_m)
      .select("ST_Distance(walking_routes.path, #{point_sql}) AS distance_m")
  end
end