#!/bin/bash

# Wait for postgres to be ready
python3 -c "
import psycopg2
import time
import os

db_url = os.getenv('DATABASE_URL', 'postgresql://uam:uam_pass@postgres:5432/uam_db')
while True:
    try:
        conn = psycopg2.connect(db_url)
        conn.close()
        break
    except psycopg2.OperationalError:
        print('Waiting for postgres...')
        time.sleep(2)
"

# Run migrations only if needed
CURRENT_VERSION=$(alembic current 2>/dev/null | head -n 1)
HEAD_VERSION=$(alembic heads 2>/dev/null | head -n 1)

if [ "$CURRENT_VERSION" != "$HEAD_VERSION" ]; then
    echo "Running database migrations..."
    alembic upgrade head
else
    echo "Database is already up to date."
fi

# Start the application
exec "$@"
