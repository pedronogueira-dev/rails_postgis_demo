# Create the indexed WalkingRoute LineString schema.
class CreateWalkingRoutes < ActiveRecord::Migration[8.1]
  # Define the PostGIS-backed schema changes for this migration.
  # @return [void]
  def change
    create_table :walking_routes do |t|
      t.string :name, null: false

      t.line_string :path,
                    geographic: true,
                    srid: 4326,
                    null: false

      t.timestamps
    end

    add_index :walking_routes, :path, using: :gist
  end
end