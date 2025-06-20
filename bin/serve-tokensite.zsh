#!/bin/zsh

# Serve dist/tokensite on http://localhost:3000

SITE_DIR="dist/tokensite"
HTML_DIR="$SITE_DIR/html"
INDEX_FILE="$HTML_DIR/index.html"
PORT=3000

if [ ! -d "$SITE_DIR" ]; then
  echo "Directory $SITE_DIR does not exist. Build the project first."
  exit 1
fi

if [ ! -d "$HTML_DIR" ]; then
  echo "HTML directory $HTML_DIR does not exist. Build the project first."
  exit 1
fi

if [ ! -f "$INDEX_FILE" ]; then
  echo "Index file $INDEX_FILE does not exist. Build the project first."
  exit 1
fi

# Try to use http-server if available
if command -v npx >/dev/null 2>&1; then
  echo "Serving $HTML_DIR on http://localhost:$PORT using http-server..."
  echo "Default file: $INDEX_FILE"
  cd "$HTML_DIR" && npx http-server . -p $PORT --cors -a localhost
  exit $?
fi

# Fallback: use Python 3's http.server
if command -v python3 >/dev/null 2>&1; then
  echo "npx not found. Falling back to Python 3's http.server."
  echo "Serving $HTML_DIR on http://localhost:$PORT ..."
  echo "Default file: $INDEX_FILE"
  cd "$HTML_DIR" && python3 -m http.server $PORT
  exit $?
fi

echo "Neither npx nor python3 found. Please install Node.js or Python 3."
exit 1 