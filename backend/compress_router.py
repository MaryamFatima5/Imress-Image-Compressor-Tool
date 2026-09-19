"""
Compression API Router — Imress
=================================

Provides:
1. Direct endpoints for Imress UI:
   - POST /compress      (single image immediate compression & download)
   - POST /compress-zip  (multiple images concurrent compression & ZIP archive)

2. Asynchronous job endpoints (ToolCEO specification):
   - POST /api/images/compress/convert
   - POST /api/compress-image
"""

from __future__ import annotations

import io
import os
import zipfile
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, File, Form, UploadFile, Request, HTTPException
from fastapi.responses import JSONResponse, Response

import jobs as job_store
from job_executor import job_executor
from engine import VALID_LEVELS, compress_image

router = APIRouter(tags=["Compression"])

_EXT_MAP = {
    "jpg":  ".jpg",
    "jpeg": ".jpg",
    "png":  ".png",
    "webp": ".webp",
    "gif":  ".gif",
    "bmp":  ".bmp",
    "tiff": ".tiff",
    "ico":  ".ico",
    "avif": ".avif",
    "heic": ".heic",
    "heif": ".heic",
    "svg":  ".svg",
}


def _output_name(original_filename: str, out_fmt: str) -> str:
    ext = _EXT_MAP.get(out_fmt, f".{out_fmt}")
    base = original_filename.rsplit(".", 1)[0] if "." in original_filename else original_filename
    name = f"{base}{ext}"
    return name


def _make_disposition(filename: str) -> str:
    try:
        ascii_name = filename.encode("ascii").decode("ascii").replace('"', "").replace("\\", "")
        return f'attachment; filename="{ascii_name}"'
    except (UnicodeEncodeError, UnicodeDecodeError):
        encoded = quote(filename, safe="")
        return f"attachment; filename*=UTF-8''{encoded}"


# ---------------------------------------------------------------------------
# Direct UI Endpoints (Imress Frontend Integration)
# ---------------------------------------------------------------------------

@router.post("/compress", summary="Compress a single image directly")
async def compress_single_direct(
    image: Optional[UploadFile] = File(None),
    file:  Optional[UploadFile] = File(None),
    compression_level: str       = Form("high"),
):
    """
    Direct single-file compression endpoint for the Imress UI.
    Accepts field 'image' (or 'file') and returns the compressed binary directly.
    """
    upload = image or file
    if not upload:
        raise HTTPException(status_code=400, detail="No image file uploaded")

    level = compression_level if compression_level in VALID_LEVELS else "high"
    raw = await upload.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    original_filename = upload.filename or "image"
    try:
        compressed_bytes, out_fmt, media_type = compress_image(raw, level=level)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Compression failed: {exc}")

    out_name = _output_name(original_filename, out_fmt)

    return Response(
        content=compressed_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": _make_disposition(out_name),
            "Content-Length": str(len(compressed_bytes)),
            "X-Original-Size": str(len(raw)),
            "X-Compressed-Size": str(len(compressed_bytes)),
        },
    )


@router.post("/compress-zip", summary="Compress multiple images into a ZIP directly")
async def compress_zip_direct(
    images: Optional[List[UploadFile]] = File(None),
    files:  Optional[List[UploadFile]] = File(None),
    compression_level: str             = Form("high"),
):
    """
    Direct multi-file concurrent compression into ZIP archive for Imress UI.
    Accepts files under 'images' (or 'files') and returns application/zip.
    """
    upload_list = images or files or []
    if not upload_list:
        raise HTTPException(status_code=400, detail="No images uploaded")

    level = compression_level if compression_level in VALID_LEVELS else "high"

    # Read uploaded files in memory
    items: list[tuple[bytes, str]] = []
    for f in upload_list:
        raw = await f.read()
        if raw:
            items.append((raw, f.filename or "image"))

    if not items:
        raise HTTPException(status_code=400, detail="All uploaded files were empty")

    # Worker function for parallel thread execution
    def _process_one(item: tuple[bytes, str]) -> tuple[bytes, str]:
        raw, fname = item
        try:
            compressed, out_fmt, _ = compress_image(raw, level=level)
            return compressed, _output_name(fname, out_fmt)
        except Exception:
            # Fallback to original bytes if compression errored
            return raw, fname

    # Execute compression concurrently across CPU workers
    results = list(job_executor.map(_process_one, items))

    # Build ZIP archive
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED, compresslevel=1) as zf:
        used_names: set[str] = set()
        for comp_bytes, out_name in results:
            # Avoid name collisions in zip
            unique_name = out_name
            counter = 1
            while unique_name in used_names:
                stem, ext = os.path.splitext(out_name)
                unique_name = f"{stem}_{counter}{ext}"
                counter += 1
            used_names.add(unique_name)
            zf.writestr(unique_name, comp_bytes)

    zip_bytes = zip_buf.getvalue()

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="compressed_images.zip"',
            "Content-Length": str(len(zip_bytes)),
        },
    )


# ---------------------------------------------------------------------------
# Asynchronous Background Job Endpoints (ToolCEO Architecture)
# ---------------------------------------------------------------------------

def _run_batch_job(
    job_id:            str,
    items:             list[tuple[bytes, str]],
    compression_level: str,
    max_dimension:     Optional[int] = None,
) -> None:
    try:
        job_store.set_progress(job_id, 5)
        n = len(items)

        if n == 1:
            raw, stem = items[0]
            result, out_fmt, media_type = compress_image(
                raw,
                level=compression_level,
                job_id=job_id,
                max_dim_override=max_dimension,
            )
            filename = _output_name(stem, out_fmt)
            job_store.set_progress(job_id, 95)
            orig_sz = len(raw)
            comp_sz = len(result)
            saved_pct = round(max(0.0, (orig_sz - comp_sz) / orig_sz * 100), 1) if orig_sz else 0.0
            job_store.set_done(job_id, result, filename, media_type, orig_sz, comp_sz, saved_pct)
            return

        buf = io.BytesIO()
        total_orig = 0
        total_comp = 0
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=1) as zf:
            for i, (raw, stem) in enumerate(items):
                pct = 5 + int((i / n) * 85)
                job_store.set_progress(job_id, pct)
                result, out_fmt, _ = compress_image(
                    raw,
                    level=compression_level,
                    job_id=None,
                    max_dim_override=max_dimension,
                )
                total_orig += len(raw)
                total_comp += len(result)
                zf.writestr(_output_name(stem, out_fmt), result)

        job_store.set_progress(job_id, 95)
        zip_name = "compressed_images.zip"
        saved_pct = round(max(0.0, (total_orig - total_comp) / total_orig * 100), 1) if total_orig else 0.0
        job_store.set_done(job_id, buf.getvalue(), zip_name, "application/zip", total_orig, total_comp, saved_pct)

    except ValueError as exc:
        job_store.set_error(job_id, str(exc))
    except Exception as exc:
        job_store.set_error(job_id, f"Compression error: {exc}")


async def _enqueue_batch(
    files:             List[UploadFile],
    compression_level: str,
    max_dimension:     Optional[int] = None,
) -> JSONResponse:
    if compression_level not in VALID_LEVELS:
        return JSONResponse(
            {"detail": f"Invalid compression_level '{compression_level}'. Valid presets: {', '.join(sorted(VALID_LEVELS))}"},
            status_code=422,
        )

    items: list[tuple[bytes, str]] = []
    for f in files:
        raw  = await f.read()
        stem = f.filename or "image"
        items.append((raw, stem))

    if not items:
        return JSONResponse({"detail": "No files provided"}, status_code=422)

    job = job_store.create_job()
    job_executor.submit(_run_batch_job, job.id, items, compression_level, max_dimension)
    return JSONResponse({"job_id": job.id}, status_code=202)


@router.post("/api/images/compress/convert", summary="ToolCEO batch compression convert endpoint")
async def api_compress_convert(
    files:             List[UploadFile] = File(...),
    compression_level: str              = Form("maximum"),
    max_dimension:     Optional[int]    = Form(None),
):
    return await _enqueue_batch(files, compression_level, max_dimension)


@router.post("/api/compress-image", summary="ToolCEO async compress endpoint")
async def api_compress_image(
    files:             List[UploadFile] = File(...),
    compression_level: str              = Form("high"),
    max_dimension:     Optional[int]    = Form(None),
):
    return await _enqueue_batch(files, compression_level, max_dimension)
