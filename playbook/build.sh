#!/usr/bin/env bash
# Generate playbook.pdf from playbook.html using headless Chrome.
# Run from the project root: bash playbook/build.sh

set -e
cd "$(dirname "$0")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HTML="$(pwd)/playbook.html"
OUT="$(pwd)/playbook.pdf"

if [ ! -x "$CHROME" ]; then
  echo "Chrome not found at: $CHROME"
  exit 1
fi

"$CHROME" \
  --headless=new \
  --disable-gpu \
  --no-pdf-header-footer \
  --virtual-time-budget=10000 \
  --print-to-pdf-no-header \
  --print-to-pdf="$OUT" \
  "file://$HTML"

echo "✓ Wrote $OUT ($(du -h "$OUT" | cut -f1))"
