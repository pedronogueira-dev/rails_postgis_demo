class MapboxConfigController < ApplicationController
  def show
    render json: {
      access_token: ENV.fetch("MAPBOX_PUBLIC_TOKEN")
    }
  end
end
