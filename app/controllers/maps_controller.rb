class MapsController < ApplicationController
  def show
    @mapbox_public_token = ENV.fetch("MAPBOX_PUBLIC_TOKEN")
  end
end
