"""Flask app: JSON API plus the built React frontend."""

from __future__ import annotations

import os
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from . import __version__
from .extract import MAX_UPLOAD_BYTES, ExtractionError, extract_text
from .nlp import NotEnoughTextError, analyse

STATIC_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
LENGTHS = {"short", "medium", "long"}


def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES + 64 * 1024

    @app.after_request
    def security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        response.headers.setdefault("X-Frame-Options", "DENY")
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", version=__version__)

    @app.post("/api/analyze")
    def analyze():
        """Accepts JSON {text, length} or multipart form with a `file` field."""
        length = "medium"
        if request.files.get("file"):
            upload = request.files["file"]
            length = request.form.get("length", length)
            try:
                text = extract_text(upload.filename or "", upload.read())
            except ExtractionError as exc:
                return _error(str(exc), 400)
            title = Path(upload.filename or "Untitled").stem
        else:
            body = request.get_json(silent=True) or {}
            text = body.get("text", "")
            length = body.get("length", length)
            title = (body.get("title") or "").strip()[:80]
            if not isinstance(text, str):
                return _error("`text` must be a string.", 400)

        if length not in LENGTHS:
            return _error("`length` must be short, medium or long.", 400)
        try:
            result = analyse(text, length=length)
        except NotEnoughTextError as exc:
            return _error(str(exc), 422)

        result["title"] = title or _guess_title(text, result)
        result["source_text"] = text[:200_000]
        return jsonify(result)

    @app.errorhandler(413)
    def too_large(_):
        return _error("File is larger than 10 MB.", 413)

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def frontend(path: str):
        if path.startswith("api/"):
            return _error("Not found.", 404)
        if path and (STATIC_DIR / path).is_file():
            return send_from_directory(STATIC_DIR, path)
        if (STATIC_DIR / "index.html").is_file():
            return send_from_directory(STATIC_DIR, "index.html")
        return ("Frontend not built. Run `npm run build` in frontend/.", 503)

    return app


def _error(message: str, status: int):
    return jsonify(error=message), status


def _guess_title(text: str, result: dict) -> str:
    for line in text.strip().splitlines()[:3]:
        line = line.strip().lstrip("#").strip()
        if line and len(line.split()) <= 8 and not line.endswith((".", "?", "!")):
            return line[:80]
    terms = result.get("key_terms") or []
    if terms:
        return " · ".join(t["term"].title() if t["term"].islower() else t["term"]
                          for t in terms[:2])
    return "Study set"


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5000)), debug=True)
