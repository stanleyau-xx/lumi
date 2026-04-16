#!/bin/sh
set -e

# Fix ownership of the data directory in case a Docker named volume mounted
# over it with root ownership (common Docker gotcha).
chown -R nextjs:nextjs /app/data

# Initialize the database on first start (creates tables + admin user)
if [ ! -f "/app/data/db.sqlite" ]; then
  echo "First start — initializing database..."
  gosu nextjs node scripts/docker-init.js
  echo "Database initialized."
else
  echo "Database already exists, skipping init."
fi

# Drop from root to nextjs user for the server process
exec gosu nextjs node server.js
