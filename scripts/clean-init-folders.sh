#!/bin/bash

# Script to delete all data/init folders
# This removes all migration preparation folders

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INIT_DIR="$PROJECT_ROOT/data/init"

echo "🧹 Cleaning up all data/init folders..."

# Check if data/init directory exists
if [ ! -d "$INIT_DIR" ]; then
    echo "ℹ️  No data/init directory found. Nothing to clean."
    exit 0
fi

# Count folders before deletion
FOLDER_COUNT=$(find "$INIT_DIR" -maxdepth 1 -type d | wc -l)
FOLDER_COUNT=$((FOLDER_COUNT - 1)) # Subtract 1 for the init directory itself

if [ "$FOLDER_COUNT" -eq 0 ]; then
    echo "ℹ️  No init folders found in data/init. Nothing to clean."
    exit 0
fi

echo "📁 Found $FOLDER_COUNT init folder(s) to delete:"
find "$INIT_DIR" -maxdepth 1 -type d -not -path "$INIT_DIR" | while read -r folder; do
    echo "   - $(basename "$folder")"
done

# Confirm deletion
read -p "❓ Are you sure you want to delete all init folders? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Operation cancelled."
    exit 1
fi

# Delete all folders in data/init except the init directory itself
echo "🗑️  Deleting init folders..."
find "$INIT_DIR" -maxdepth 1 -type d -not -path "$INIT_DIR" -exec rm -rf {} +

echo "✅ Successfully deleted $FOLDER_COUNT init folder(s)."

# Verify deletion
REMAINING=$(find "$INIT_DIR" -maxdepth 1 -type d | wc -l)
REMAINING=$((REMAINING - 1)) # Subtract 1 for the init directory itself

if [ "$REMAINING" -eq 0 ]; then
    echo "✅ All init folders have been successfully removed."
else
    echo "⚠️  Warning: $REMAINING folder(s) still remain in data/init."
fi 