# Render the Sensor map, or an isolated Mapbox renderer diagnostic.
# The renderer diagnostic never initializes the Sensor/SpatialMap controller.
class MapsController < ApplicationController
  # Render the Rails-owned Turbo/Stimulus map page.
  # @return [void]
  def show
    # Preserve a convenient probe alias while implementing isolation in Rails.
    # A stale compiled Sensor helper can no longer interpret this as a Sensor page.
    if params[:basemap_only] == "1"
      return redirect_to map_diagnostics_path(style: "remote")
    end

    @mapbox_public_token = ENV.fetch("MAPBOX_PUBLIC_TOKEN")
  end

  # Render a dedicated browser renderer diagnostic with NO Sensor API hooks.
  # @return [void]
  def diagnostics
    # The inline style needs no remote Mapbox style/tiles and can test graphics
    # even if the public token is missing or its origin restrictions are wrong.
    @mapbox_public_token = ENV["MAPBOX_PUBLIC_TOKEN"].to_s
    @diagnostic_style = params[:style] == "inline" ? "inline" : "remote"
  end
end
