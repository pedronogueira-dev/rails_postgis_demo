Rails.application.routes.draw do
  root "maps#show"

  get "/map", to: "maps#show", as: :map
  get "/map/diagnostics", to: "maps#diagnostics", as: :map_diagnostics
  # get "/maps/config", to: "api/maps#map_config", as: :temporary_maps_config

  namespace :api do
    resources :sensors, only: %i[index create] do
      collection { get :nearby }
    end
    resources :walking_routes, only: %i[index] do
      collection { get :nearby }
    end
  end

end
