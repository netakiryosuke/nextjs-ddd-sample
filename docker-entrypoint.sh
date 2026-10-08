#!/bin/sh
set -eu

npm run db:migrate

if [ "${SEED_DATABASE:-false}" = "true" ]; then
  npm run db:seed
fi

exec "$@"
