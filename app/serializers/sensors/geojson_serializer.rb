module Sensors
  class GeojsonSerializer
    def initialize(sensor)
      @sensor = sensor
    end

    def as_json(*)
      Geojson::Feature.new(
        id: @sensor.id,
        geometry: @sensor.location,
        properties: {
          name: @sensor.name,
          marker_color: @sensor.marker_color,
          marker_icon: @sensor.marker_icon
        }
      ).as_json
    end
  end
end
