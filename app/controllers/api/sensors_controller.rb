module Api
  class SensorsController < ApplicationController
    def index
      render json: collection(Sensor.order(:id))
    end

    def nearby
      point = coordinates
      radius_m = Float(params.fetch(:radius_m, 1_000))
      raise ArgumentError, "invalid radius" unless radius_m.positive? && radius_m <= 50_000

      sensors = Sensor.nearby(
        longitude: point.fetch(:longitude),
        latitude: point.fetch(:latitude),
        radius_m: radius_m
      ).order(:id).limit(100)

      render json: {
        sensors: collection(sensors),
        search_area: Geojson::Feature.new(
          geometry: Spatial::BufferQuery.call(
            longitude: point.fetch(:longitude),
            latitude: point.fetch(:latitude),
            radius_m: radius_m
          ),
          properties: { radius_m: radius_m }
        ).as_json
      }
    rescue ActionController::ParameterMissing, ArgumentError, TypeError
      render json: { error: "Provide valid coordinates and a radius between 0 and 50000 metres." },
             status: :bad_request
    end

    private

    def coordinates
      longitude = Float(params.require(:longitude))
      latitude = Float(params.require(:latitude))

      raise ArgumentError, "invalid longitude" unless longitude.between?(-180, 180)
      raise ArgumentError, "invalid latitude" unless latitude.between?(-90, 90)

      { longitude: longitude, latitude: latitude }
    end

    def collection(records)
      Geojson::FeatureCollection.new(
        records,
        serializer: Sensors::GeojsonSerializer
      ).as_json
    end
  end
end
