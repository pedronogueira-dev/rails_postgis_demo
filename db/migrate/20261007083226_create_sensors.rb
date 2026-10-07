class CreateSensors < ActiveRecord::Migration[8.0]
  def change
    enable_extension "postgis"
    create_table :sensors do |t|
        t.string :name, null: false

        t.st_point :location,
                  geographic: true,
                  srid: 4326,
                  null: false

        t.timestamps
      end

    add_index :sensors, :location, using: :gist
  end
end
