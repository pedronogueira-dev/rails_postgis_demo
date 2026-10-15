module Api
  # Expose nearby routes and index GeoJSON endpoints.
  class WalkingRoutesController < ApplicationController
    # Render the GeoJSON representation of the requested collection.
    # @return [void]
    def index
      render json: collection(WalkingRoute.with_length.order(:id))
    end

    # Return routes within the requested geography radius.
    # @return [void]
    def nearby
      point = coordinates
      distance_m = Float(params.fetch(:distance_m, 250))
      raise ArgumentError, "invalid distance" unless distance_m.positive? && distance_m <= 10_000

      routes = WalkingRoute.near_point(
        longitude: point.longitude,
        latitude: point.latitude,
        distance_m: distance_m
      ).order(Arel.sql("distance_m ASC")).limit(100)

      render json: collection(routes)
    rescue ActionController::ParameterMissing, ArgumentError, TypeError
      render json: {
        error: "Provide valid coordinates and a distance between 0 and 10000 metres."
      }, status: :bad_request
    end

    private

    # Validate and normalize query coordinates to WGS 84 longitude and latitude.
    # @return [Spatial::Coordinates] validated WGS 84 coordinate value object
    def coordinates
      Spatial::Coordinates.new(
        longitude: params.require(:longitude),
        latitude: params.require(:latitude)
      )
    end

    # Serialize records as a GeoJSON FeatureCollection.
    # @param records [Enumerable] records being serialized
    # @return [Hash] serialized GeoJSON object or domain attribute hash
    def collection(records)
      Geojson::FeatureCollection.new(
        records,
        serializer: WalkingRoutes::GeojsonSerializer
      ).as_json
    end
  end
end