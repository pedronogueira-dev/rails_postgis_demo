# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

{
  "Sensor A" => "POINT(-9.1400 38.7200)",
  "Sensor B" => "POINT(-9.1350 38.7220)",
  "Sensor C" => "POINT(-9.0000 38.8000)"
}.each do |name, point|
  sensor = Sensor.find_or_initialize_by(name: name)
  sensor.update!(location: point)
end
