"""
Wrapper that imports the FitCoach FastAPI app and adds:
 - Serving the built Vite SPA under /api/app/
 - Serving uploads under /api/uploads/
 - Middleware to rewrite /uploads/ URLs in JSON responses to /api/uploads/
"""
import sys, json, mimetypes
from pathlib import Path

# The FitCoach app package is at /app/backend/app/
# uvicorn runs from /app/backend/, so "from app.main import app" resolves naturally.
from app.main import app

from fastapi import Request
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

DIST_DIR = Path("/app/fitcoach-frontend-dist")
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Middleware: rewrite "/uploads/" -> "/api/uploads/" in JSON responses
# so that avatar_url, photo_url etc. work when the SPA runs under /api/app/
# ---------------------------------------------------------------------------
class RewriteUploadsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        ct = response.headers.get("content-type", "")
        if "application/json" in ct:
            body_parts = []
            async for chunk in response.body_iterator:
                if isinstance(chunk, str):
                    chunk = chunk.encode("utf-8")
                body_parts.append(chunk)
            body = b"".join(body_parts)
            body = body.replace(b'"/uploads/', b'"/api/uploads/')
            body = body.replace(b"'/uploads/", b"'/api/uploads/")
            headers = dict(response.headers)
            headers["content-length"] = str(len(body))
            return Response(content=body, status_code=response.status_code,
                            headers=headers, media_type=response.media_type)
        return response

app.add_middleware(RewriteUploadsMiddleware)

# ---------------------------------------------------------------------------
# Mount uploads at /api/uploads/ (in addition to /uploads which main.py mounts)
# ---------------------------------------------------------------------------
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="api_uploads")

# ---------------------------------------------------------------------------
# SPA catch-all: serve static files from dist, or index.html for SPA routes
# ---------------------------------------------------------------------------
INDEX_HTML = (DIST_DIR / "index.html").read_text("utf-8") if DIST_DIR.exists() else "<h1>Build not found</h1>"

@app.get("/api/app")
@app.get("/api/app/")
async def spa_root():
    return HTMLResponse(INDEX_HTML)

@app.get("/api/app/{path:path}")
async def spa_catch_all(path: str):
    file_path = DIST_DIR / path
    if file_path.exists() and file_path.is_file():
        ct = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        return FileResponse(file_path, media_type=ct)
    # SPA fallback: return index.html for client-side routing
    return HTMLResponse(INDEX_HTML)
