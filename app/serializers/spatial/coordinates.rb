module Spatial
  class Coordinates
    attr_reader :longitude, :latitude

    def initialize(longitude:, latitude:)
      @longitude = Float(longitude)
      @latitude = Float(latitude)

      raise ArgumentError unless @longitude.between?(-180, 180)
      raise ArgumentError unless @latitude.between?(-90, 90)
    end
  end
end
