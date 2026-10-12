Rails.application.routes.draw do
  get "/map", to: "maps#show", as: :map

  namespace :api do
    resources :sensors, only: %i[index] do
      collection do
        get :nearby
      end
    end
    get "/mapbox/config", to: "mapbox#config", as: :mapbox_config
  end
end
