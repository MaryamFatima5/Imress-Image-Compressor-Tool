"""
jobs.py
In-memory job registry for asynchronous image compression jobs and progress tracking.

Each job has:
  state   : "pending" | "running" | "done" | "error"
  progress: 0-100
  result  : bytes | None   (output file bytes, set when done)
  filename: str | None     (suggested download filename)
  error   : str | None

Also provides smooth_progress() — a context manager that tweens the stored
progress value from a start value toward a target ceiling while the wrapped
block executes, so progress updates remain smooth.
"""

from __future__ import annotations

import contextlib
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Job:
    id: str
    state: str = "pending"
    progress: int = 0
    result: Optional[bytes] = None
    filename: Optional[str] = None
    media_type: Optional[str] = None
    original_size: Optional[int] = None
    compressed_size: Optional[int] = None
    saved_percent: Optional[float] = None
    error: Optional[str] = None
    cancel_event: threading.Event = field(default_factory=threading.Event, repr=False)
    cancelled: bool = False


_store: dict[str, Job] = {}
_lock = threading.Lock()


def create_job() -> Job:
    job = Job(id=str(uuid.uuid4()))
    with _lock:
        _store[job.id] = job
    return job


def get_job(job_id: str) -> Optional[Job]:
    with _lock:
        return _store.get(job_id)


def set_progress(job_id: str, pct: int) -> None:
    with _lock:
        job = _store.get(job_id)
        if job:
            job.progress = pct
            if job.state == "pending":
                job.state = "running"


def set_done(
    job_id: str,
    result: bytes,
    filename: str,
    media_type: str,
    original_size: Optional[int] = None,
    compressed_size: Optional[int] = None,
    saved_percent: Optional[float] = None,
) -> None:
    with _lock:
        job = _store.get(job_id)
        if job:
            job.state = "done"
            job.progress = 100
            job.result = result
            job.filename = filename
            job.media_type = media_type
            if original_size is not None:
                job.original_size = original_size
            if compressed_size is not None:
                job.compressed_size = compressed_size
            if saved_percent is not None:
                job.saved_percent = saved_percent


def set_error(job_id: str, message: str) -> None:
    with _lock:
        job = _store.get(job_id)
        if job:
            job.state = "error"
            job.error = message


def is_cancelled(job_id: str) -> bool:
    with _lock:
        job = _store.get(job_id)
        return bool(job and job.cancel_event.is_set())


def set_cancelled(job_id: str) -> None:
    with _lock:
        job = _store.get(job_id)
        if job:
            job.cancelled = True
            job.state = "error"
            job.error = "Operation cancelled."


def cancel_job(job_id: str) -> bool:
    with _lock:
        job = _store.get(job_id)
        if not job or job.state in ("done", "error"):
            return False
        job.cancel_event.set()
        return True


@contextlib.contextmanager
def smooth_progress(job_id: str, start: int, ceiling: int, interval: float = 0.35):
    """
    Context manager that increments job progress by 1 every *interval* seconds
    from *start* toward *ceiling - 1* while the wrapped block executes.
    """
    stop = threading.Event()

    def _tick() -> None:
        cur = start
        while not stop.is_set() and cur < ceiling - 1:
            time.sleep(interval)
            if stop.is_set():
                break
            cur = min(cur + 1, ceiling - 1)
            set_progress(job_id, cur)

    t = threading.Thread(target=_tick, daemon=True)
    t.start()
    try:
        yield
    finally:
        stop.set()
        t.join(timeout=2)
