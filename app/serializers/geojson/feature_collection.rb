module Geojson
  class FeatureCollection
    def initialize(records, serializer:)
      @records = records
      @serializer = serializer
    end

    def as_json(*)
      {
        type: "FeatureCollection",
        features: @records.map { |record| @serializer.new(record).as_json }
      }
    end
  end
end
