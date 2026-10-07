class SensorsController < ApplicationController
  def index
    render json: feature_collection(Sensor.order(:id))
  end

  def nearby
    longitude = Float(params.require(:longitude))
    latitude = Float(params.require(:latitude))
    radius_m = Float(params.fetch(:radius_m, 1_000))

    valid_coordinates =
      longitude.between?(-180, 180) &&
      latitude.between?(-90, 90)

    valid_radius = radius_m.positive? && radius_m <= 50_000

    raise ArgumentError unless valid_coordinates && valid_radius

    sensors = Sensor.nearby(
      longitude: longitude,
      latitude: latitude,
      radius_m: radius_m
    ).order(:id).limit(100)

    search_area_geometry = JSON.parse(
      Sensor.search_area_geojson(
        longitude: longitude,
        latitude: latitude,
        radius_m: radius_m
      )
    )

    render json: {
      sensors: feature_collection(sensors),
      search_area: {
        type: "Feature",
        geometry: search_area_geometry,
        properties: {
          radius_m: radius_m
        }
      }
    }
  rescue ActionController::ParameterMissing, ArgumentError, TypeError
    render json: {
      error: "Provide valid coordinates and a radius greater than 0 and at most 50000 metres."
    }, status: :bad_request
  end

  private

  def feature_collection(sensors)
    {
      type: "FeatureCollection",
      features: sensors.map do |sensor|
        {
          type: "Feature",
          id: sensor.id,
          geometry: {
            type: "Point",
            coordinates: [ sensor.location.x, sensor.location.y ]
          },
          properties: {
            name: sensor.name
          }
        }
      end
    }
  end
end
