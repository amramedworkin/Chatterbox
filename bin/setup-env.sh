#!/bin/bash

# setup-env.sh - Setup .env file from .env-clean template

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔧 Setting up .env file from .env-clean template..."

# Check if .env already exists
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo "⚠️  .env file already exists!"
    echo "   Current .env file will be backed up to .env.backup"
    cp "$PROJECT_ROOT/.env" "$PROJECT_ROOT/.env.backup"
    echo "   Backup created: .env.backup"
fi

# Copy .env-clean to .env
cp "$PROJECT_ROOT/.env-clean" "$PROJECT_ROOT/.env"

echo "✅ .env file created from .env-clean template"
echo ""
echo "📝 Next steps:"
echo "   1. Edit .env file and uncomment/set your values"
echo "   2. At minimum, set OPENAI_API_KEY=your-actual-api-key"
echo "   3. Optionally set Gmail user addresses if different from config.json"
echo ""
echo "🔍 Environment variables will override config.json values when set"
echo "📖 See .env file comments for detailed configuration options" 