from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent

class PreviewHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = Path(self.translate_path(self.path))
        accepted = self.headers.get("Accept-Encoding", "")
        gzip_ok = any(token.split(";")[0].strip() == "gzip" and "q=0" not in token.replace(" ", "") for token in accepted.split(","))
        if gzip_ok and path.suffix == ".glb" and path.is_relative_to(ROOT / "assets" / "preview-100k"):
            packed = Path(str(path) + ".gz")
            if packed.is_file():
                stream = packed.open("rb")
                self.send_response(200)
                self.send_header("Content-Type", "model/gltf-binary")
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Vary", "Accept-Encoding")
                self.send_header("Content-Length", str(packed.stat().st_size))
                self.send_header("Last-Modified", self.date_time_string(path.stat().st_mtime))
                self.end_headers()
                return stream
        return super().send_head()

    def end_headers(self):
        path = self.path.split("?", 1)[0]
        if path.endswith((".html", ".js", ".css", ".json")) or path.endswith("/"):
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        else:
            self.send_header("Cache-Control", "private, max-age=3600")
        self.send_header("X-Preview-Revision", "preview-100k-20261006")
        super().end_headers()

if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 18768), partial(PreviewHandler, directory=str(ROOT))).serve_forever()
