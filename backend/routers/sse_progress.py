"""
SSE Progress and Download Router.

GET  /api/progress/{job_id}  -> streams Server-Sent Events:
  data: {"progress": 0-100, "state": "running"|"done"|"error", ...}

GET  /api/download/{job_id}  -> returns the finished file once state=="done".
POST /api/cancel/{job_id}    -> cancels running job.
"""

from __future__ import annotations

import asyncio
import json
import logging
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, StreamingResponse

from jobs import get_job, cancel_job, set_cancelled

_log = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Progress"])


@router.get("/progress/{job_id}")
async def stream_progress(job_id: str):
    """Stream SSE progress updates until the job finishes or errors."""

    async def event_gen():
        while True:
            job = get_job(job_id)
            if job is None:
                data = json.dumps({"state": "error", "error": "Job not found", "progress": 0})
                yield f"data: {data}\n\n"
                return

            payload = {"state": job.state, "progress": job.progress}
            if job.state == "done":
                payload["filename"]   = job.filename
                payload["media_type"] = job.media_type
                for _stat in ("original_size", "compressed_size", "saved_percent"):
                    val = getattr(job, _stat, None)
                    if val is not None:
                        payload[_stat] = val
            if job.state == "error":
                payload["error"] = job.error or "Unknown error"

            yield f"data: {json.dumps(payload)}\n\n"

            if job.state in ("done", "error"):
                return

            await asyncio.sleep(0.25)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/cancel/{job_id}")
def cancel_job_endpoint(job_id: str):
    """Cancel a running background job."""
    cancelled = cancel_job(job_id)
    set_cancelled(job_id)
    return {"ok": True, "cancelled": cancelled}


@router.get("/download/{job_id}")
def download_result(job_id: str):
    """Return the finished file bytes for a completed job."""
    try:
        return _do_download(job_id)
    except HTTPException:
        raise
    except Exception as exc:
        _log.exception("download_result(%s) failed", job_id)
        raise HTTPException(status_code=500, detail=f"Download error: {exc}") from exc


def _do_download(job_id: str):
    job = get_job(job_id)
    # If the job exists but is still running, wait up to 10 s for it to finish.
    if job is not None and job.state != "done" and job.state != "error":
        import time as _time
        for _ in range(40):
            _time.sleep(0.25)
            job = get_job(job_id)
            if job is None or job.state in ("done", "error"):
                break

    if job is None or job.state != "done" or job.result is None:
        raise HTTPException(status_code=404, detail="Job not ready or not found.")

    filename = (job.filename or "download").strip()
    media_type = job.media_type or "application/octet-stream"

    try:
        ascii_name = filename.encode("ascii").decode("ascii")
        ascii_name = ascii_name.replace('"', "").replace("\\", "")
        content_disposition = f'attachment; filename="{ascii_name}"'
    except (UnicodeEncodeError, UnicodeDecodeError):
        encoded = quote(filename, safe="")
        content_disposition = f"attachment; filename*=UTF-8''{encoded}"

    return Response(
        content=bytes(job.result),
        media_type=media_type,
        headers={"Content-Disposition": content_disposition},
    )
