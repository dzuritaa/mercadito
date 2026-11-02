#!/bin/sh
# Production container start: apply migrations, load reference data, start.
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Loading reference data (categories and recipe tags)..."
npx tsx prisma/seed.ts

echo "Starting Mercadito on port 3000..."
exec npx next start -p 3000
