#!/usr/bin/env python3
"""Local dev server with no-cache headers (avoids stale JS/CSS in the browser)."""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    with HTTPServer(('', PORT), NoCacheHandler) as httpd:
        print(f'Serving http://localhost:{PORT} (no-cache)', flush=True)
        httpd.serve_forever()
