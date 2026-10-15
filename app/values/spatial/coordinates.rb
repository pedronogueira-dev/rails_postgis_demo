module Spatial
  # Validated WGS 84 longitude/latitude input shared by spatial HTTP endpoints.
  class Coordinates
    # @return [Float] validated WGS 84 values in decimal degrees
    attr_reader :longitude, :latitude

    # @param longitude [Numeric, String] longitude in decimal degrees
    # @param latitude [Numeric, String] latitude in decimal degrees
    # @raise [ArgumentError] when a value is invalid or outside WGS 84 bounds
    # @return [void]
    def initialize(longitude:, latitude:)
      @longitude = Float(longitude)
      @latitude = Float(latitude)

      raise ArgumentError, "invalid longitude" unless @longitude.between?(-180, 180)
      raise ArgumentError, "invalid latitude" unless @latitude.between?(-90, 90)
    end
  end
end