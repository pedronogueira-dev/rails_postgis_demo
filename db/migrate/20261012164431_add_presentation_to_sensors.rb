# Add optional Sensor marker color/icon presentation fields.
class AddPresentationToSensors < ActiveRecord::Migration[8.1]
  # Define the PostGIS-backed schema changes for this migration.
  # @return [void]
  def change
    add_column :sensors, :marker_color, :string, null: false, default: "#334155"
    add_column :sensors, :marker_icon, :string, null: false, default: "circle"
  end
end
