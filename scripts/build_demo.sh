#!/usr/bin/env bash
# Build the browser WASM demo for markdown_yo.
# Usage: ./scripts/build_demo.sh [--yo-cli PATH]
#
# Output goes to demo/ (index.html, style.css, app.js, *.wasm, *.js glue).

set -euo pipefail
cd "$(dirname "$0")/.."

YO_CLI="${1:-yo-cli}"

echo "==> Building browser WASM API target..."
"$YO_CLI" build wasm_api

# Copy WASM artifacts into demo/
echo "==> Copying WASM artifacts to demo/..."
cp yo-out/wasm32-emscripten/bin/markdown_yo_wasm_api.js   demo/markdown_yo_wasm_api.js
cp yo-out/wasm32-emscripten/bin/markdown_yo_wasm_api.wasm demo/markdown_yo_wasm_api.wasm

echo "==> Demo ready in demo/"
echo "    Serve with:  npx serve demo"
