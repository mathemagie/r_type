#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "============================================"
echo "  R-TYPELIKE - Demarrage en cours..."
echo "============================================"

if command -v python3 >/dev/null 2>&1; then
  PYCMD=python3
elif command -v python >/dev/null 2>&1; then
  PYCMD=python
else
  echo "Python n'est pas installe."
  echo "Ouverture directe dans le navigateur par defaut..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open index.html
  else
    xdg-open index.html >/dev/null 2>&1 || sensible-browser index.html
  fi
  exit 0
fi

echo "Serveur local : http://localhost:8765"
(sleep 1 && (
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:8765
  else
    xdg-open http://localhost:8765 >/dev/null 2>&1
  fi
)) &

$PYCMD -m http.server 8765
