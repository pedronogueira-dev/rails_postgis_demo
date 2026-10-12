module Api
  class MapsController < ApplicationController
    def map_config
      token = ENV["MAPBOX_PUBLIC_TOKEN"].to_s.strip

      unless token.start_with?("pk.") && !token.start_with?("pk.replace")
        return render json: {
          error: "Set a real public MAPBOX_PUBLIC_TOKEN and restart Rails."
        }, status: :service_unavailable
      end

      render json: {
        mapbox_public_token: token,
        sensors_url: api_sensors_path,
        nearby_sensors_url: nearby_api_sensors_path
      }
    end
  end
end
