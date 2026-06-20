#!/usr/bin/env bash
# cache-bust.sh — stamp ?v=<content-hash> onto local asset URLs in index.html.
#
# Run this before committing a deploy. Each js/*.js and style.css reference gets
# a query string derived from a hash of that file's *content*, so the browser
# only re-downloads modules that actually changed. Unchanged files keep their
# cached copy. Re-running with no source changes leaves index.html untouched.
#
# Usage:  ./cache-bust.sh
set -euo pipefail
cd "$(dirname "$0")"

HTML="index.html"

# Short content hash for a file (first 8 hex chars of its SHA-256).
hash_of() { shasum -a 256 "$1" | cut -c1-8; }

# Replace (or add) ?v=... on a single asset reference inside index.html.
# $1 = attribute ("href" or "src"), $2 = asset path (e.g. "js/main.js")
stamp() {
  local attr="$1" path="$2" v
  v="$(hash_of "$path")"
  # Escape the path for use in the sed regex (dots become literal).
  local esc="${path//./\\.}"
  sed -i '' -E "s|(${attr}=\"${esc})(\?v=[^\"]*)?\"|\1?v=${v}\"|g" "$HTML"
}

stamp href "style.css"

# Every js/<name>.js referenced by index.html, in document order.
while IFS= read -r js; do
  stamp src "$js"
done < <(grep -oE 'js/[a-z0-9]+\.js' "$HTML" | sed -E 's/\?v=.*//' | sort -u)

echo "Stamped cache-busting hashes into $HTML:"
grep -nE 'href="style\.css|src="js/' "$HTML"
