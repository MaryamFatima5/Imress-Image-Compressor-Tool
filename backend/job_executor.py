"""Shared, bounded executor for long-running image compression jobs."""

from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor

# Keep compression work bounded so background operations cannot saturate
# the CPU or starve requests for UI interactivity.
_MAX_WORKERS = max(2, min(8, (os.cpu_count() or 4)))

job_executor = ThreadPoolExecutor(
    max_workers=_MAX_WORKERS,
    thread_name_prefix="imress-compress-worker",
)
