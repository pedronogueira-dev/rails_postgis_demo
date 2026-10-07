# README

This README would normally document whatever steps are necessary to get the
application up and running.

Things you may want to cover:


# Docker Commands:

### Bundling
```bash
docker run --rm \
  --volume "$PWD:/rails" \
  --workdir /rails \
  ruby:4.0.3-slim-bookworm \
  bundle lock
```

#### Debugging json incompatability
```bash
docker compose -p tiny_postgis -f .docker/docker-compose.yml \
  run --rm --no-deps web \
  bundle exec ruby -ractive_support -ractive_support/json \
  -e 'puts "JSON #{JSON::VERSION}"; puts({ ok: true }.to_json)'
```

### Compose validation
```bash
docker compose -p tiny_postgis -f .docker/docker-compose.yml config --quiet
```

### Build App
```bash
docker compose -p tiny_postgis -f .docker/docker-compose.yml build web
```

### Start Postgresql
```bash
docker compose -p tiny_postgis -f .docker/docker-compose.yml up -d --wait db
```

### Start Postgresql
```bash
docker compose -p tiny_postgis -f .docker/docker-compose.yml up -d pgadmin
```