"""
Test suite for Imress Compression Engine powered by ToolCEO architecture
"""
import io
import time
from fastapi.testclient import TestClient
from PIL import Image

from main import app
from engine import compress_image

def run_tests():
    print("--- 1. Testing Engine Direct Logic ---")
    # PNG with alpha
    im_png = Image.new("RGBA", (300, 300), (0, 128, 255, 180))
    buf = io.BytesIO()
    im_png.save(buf, format="PNG")
    raw_png = buf.getvalue()
    comp_png, fmt_png, mime_png = compress_image(raw_png, level="high")
    print(f"PNG Compression: orig={len(raw_png)} -> comp={len(comp_png)} bytes, format={fmt_png}, mime={mime_png}")
    assert fmt_png == "png"
    assert mime_png == "image/png"

    # JPEG
    im_jpg = Image.new("RGB", (400, 400), (200, 50, 80))
    buf_j = io.BytesIO()
    im_jpg.save(buf_j, format="JPEG", quality=95)
    raw_jpg = buf_j.getvalue()
    comp_jpg, fmt_jpg, mime_jpg = compress_image(raw_jpg, level="maximum")
    print(f"JPG Compression: orig={len(raw_jpg)} -> comp={len(comp_jpg)} bytes, format={fmt_jpg}, mime={mime_jpg}")
    assert fmt_jpg == "jpg"
    assert len(comp_jpg) < len(raw_jpg)

    # WEBP
    im_webp = Image.new("RGBA", (250, 250), (100, 200, 50, 200))
    buf_w = io.BytesIO()
    im_webp.save(buf_w, format="WEBP", quality=95)
    raw_webp = buf_w.getvalue()
    comp_webp, fmt_webp, mime_webp = compress_image(raw_webp, level="high")
    print(f"WEBP Compression: orig={len(raw_webp)} -> comp={len(comp_webp)} bytes, format={fmt_webp}, mime={mime_webp}")
    assert fmt_webp == "webp"

    # SVG
    svg_raw = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><!-- comment --><circle cx="50.123456" cy="50.987654" r="40"/></svg>'
    comp_svg, fmt_svg, mime_svg = compress_image(svg_raw, level="maximum")
    print(f"SVG Compression: orig={len(svg_raw)} -> comp={len(comp_svg)} bytes, output={comp_svg.decode()}")
    assert fmt_svg == "svg"
    assert b"<!-- comment -->" not in comp_svg

    print("\n--- 2. Testing FastAPI Router Endpoints ---")
    client = TestClient(app)

    # Health check
    h = client.get("/health")
    assert h.status_code == 200
    print("GET /health -> 200 OK:", h.json())

    # Direct /compress (Imress UI)
    r1 = client.post(
        "/compress",
        files={"image": ("sample.jpg", raw_jpg, "image/jpeg")},
        data={"compression_level": "high"}
    )
    assert r1.status_code == 200
    print(f"POST /compress -> 200 OK, Dispo={r1.headers.get('content-disposition')}, Size={len(r1.content)}")

    # Direct /compress-zip (Imress UI)
    r2 = client.post(
        "/compress-zip",
        files=[
            ("images", ("sample1.png", raw_png, "image/png")),
            ("images", ("sample2.jpg", raw_jpg, "image/jpeg")),
        ],
        data={"compression_level": "high"}
    )
    assert r2.status_code == 200
    assert r2.headers.get("content-type") == "application/zip"
    print(f"POST /compress-zip -> 200 OK, ZipSize={len(r2.content)}")

    # ToolCEO Async Batch Endpoint
    r3 = client.post(
        "/api/images/compress/convert",
        files=[("files", ("test.png", raw_png, "image/png"))],
        data={"compression_level": "maximum"}
    )
    assert r3.status_code == 202
    job_id = r3.json().get("job_id")
    print(f"POST /api/images/compress/convert -> 202 Accepted, JobID={job_id}")

    time.sleep(0.3)
    r_prog = client.get(f"/api/progress/{job_id}")
    assert r_prog.status_code == 200
    print("GET /api/progress/{job_id} -> 200 OK")

    r_dl = client.get(f"/api/download/{job_id}")
    assert r_dl.status_code == 200
    print(f"GET /api/download/{job_id} -> 200 OK, DownloadSize={len(r_dl.content)}")

    print("\n>>> ALL ENGINE & ROUTER TESTS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    run_tests()
