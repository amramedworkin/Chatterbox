#!/bin/zsh

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

if command -v python3 >/dev/null 2>&1; then
  echo "Serving $HTML_DIR on http://localhost:$PORT using Python 3's http.server..."
  echo "Default file: $INDEX_FILE"
  cd "$HTML_DIR" && python3 -m http.server $PORT
else
  echo "Python 3 is not installed. Please install Python 3."
  exit 1
fi 