"""
Imress Backend Service Entry & Registration
===========================================

FastAPI application serving the ToolCEO-based Image Compression Engine,
background SSE progress streams, and static frontend assets on port 5000.
"""

from __future__ import annotations

import os
import sys

# Ensure backend directory is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from compress_router import router as compress_router
from routers.sse_progress import router as sse_router

FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))

app = FastAPI(
    title="Imress Image Compressor",
    version="2.0.0",
    description="Professional local image compression engine powered by ToolCEO architecture",
)

# Enable CORS for desktop, Electron, and browser clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Register Compression & SSE Progress routers
app.include_router(compress_router)
app.include_router(sse_router, prefix="/api")


@app.get("/health", summary="Health check")
def health():
    return {
        "status": "ok",
        "engine": "toolceo-compression-engine",
        "version": "2.0.0",
    }


# Serve Frontend Main Application
@app.get("/", summary="Serve Imress Web UI")
def serve_index():
    index_file = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.isfile(index_file):
        return FileResponse(index_file)
    return {"status": "Imress Backend Running", "message": "Frontend index.html not found"}


# Mount static assets if directory exists
static_dir = os.path.join(FRONTEND_DIR, "static")
if os.path.isdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Mount entire frontend for relative assets
if os.path.isdir(FRONTEND_DIR):
    app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5000))
    print(f"[Imress] Starting Python Compression Server on http://127.0.0.1:{port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info", reload=False)
