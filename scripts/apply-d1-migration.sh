#!/bin/bash

# Script to apply D1 migrations to Cloudflare D1 database
# Usage: ./scripts/apply-d1-migration.sh [database-name]

set -e

DATABASE_NAME=${1:-ai-resume-db}

echo "🚀 Applying D1 migration to database: $DATABASE_NAME"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler CLI is not installed"
    echo "Install it with: npm install -g wrangler"
    exit 1
fi

# Check if migration file exists
MIGRATION_FILE="prisma/migrations/d1_initial_migration.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found at $MIGRATION_FILE"
    exit 1
fi

echo "📄 Migration file: $MIGRATION_FILE"
echo ""

# Apply migration
echo "⏳ Applying migration..."
wrangler d1 execute "$DATABASE_NAME" --file="$MIGRATION_FILE"

echo ""
echo "✅ Migration applied successfully!"
echo ""

# Verify tables were created
echo "📊 Verifying tables..."
wrangler d1 execute "$DATABASE_NAME" --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

echo ""
echo "🎉 Done! Database is ready to use."
