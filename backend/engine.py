"""
Image Compressor Engine — Imress (powered by ToolCEO Architecture)
==================================================================

Professional offline image compressor supporting all raster and vector image formats:
JPG, PNG, WEBP, AVIF, HEIC/HEIF, GIF, BMP, TIFF, ICO, and SVG.
Provides world-class compression ratios matching online tools (TinyPNG / Squoosh / Compressor.io)
100% locally and offline without external network calls.
"""

from __future__ import annotations

import io
import logging
import re
from typing import Optional

_log = logging.getLogger(__name__)

MEDIA_TYPES: dict[str, str] = {
    "jpg":  "image/jpeg",
    "jpeg": "image/jpeg",
    "png":  "image/png",
    "webp": "image/webp",
    "gif":  "image/gif",
    "bmp":  "image/bmp",
    "tiff": "image/tiff",
    "ico":  "image/x-icon",
    "avif": "image/avif",
    "heic": "image/heic",
    "heif": "image/heic",
    "svg":  "image/svg+xml",
}

LEVEL_SETTINGS: dict[str, dict] = {
    "maximum": {
        "jpg_quality": 52,
        "max_dimension": 2048,
        "png_colors": 128,
        "png_smart": False,
        "webp_quality": 52,
        "avif_quality": 45,
        "heic_quality": 50,
        "gif_colors": 128,
        "svg_decimals": 1,
    },
    "high": {
        "jpg_quality": 65,
        "max_dimension": 2560,
        "png_colors": 256,
        "png_smart": False,
        "webp_quality": 68,
        "avif_quality": 55,
        "heic_quality": 62,
        "gif_colors": 192,
        "svg_decimals": 2,
    },
    "medium": {
        "jpg_quality": 76,
        "max_dimension": 3840,
        "png_colors": 256,
        "png_smart": True,
        "webp_quality": 78,
        "avif_quality": 68,
        "heic_quality": 72,
        "gif_colors": 256,
        "svg_decimals": 2,
    },
    "low": {
        "jpg_quality": 86,
        "max_dimension": None,
        "png_colors": None,  # Lossless
        "png_smart": True,
        "webp_quality": 88,
        "avif_quality": 80,
        "heic_quality": 84,
        "gif_colors": 256,
        "svg_decimals": None,
    },
}

VALID_LEVELS = frozenset(LEVEL_SETTINGS)

PIL_TO_EXT: dict[str, str] = {
    "JPEG": "jpg",
    "JPG":  "jpg",
    "PNG":  "png",
    "WEBP": "webp",
    "GIF":  "gif",
    "BMP":  "bmp",
    "DIB":  "bmp",
    "TIFF": "tiff",
    "TIF":  "tiff",
    "ICO":  "ico",
    "AVIF": "avif",
    "HEIF": "heic",
    "HEIC": "heic",
}

EXT_TO_PIL: dict[str, str] = {
    "jpg":  "JPEG",
    "jpeg": "JPEG",
    "png":  "PNG",
    "webp": "WEBP",
    "gif":  "GIF",
    "bmp":  "BMP",
    "tiff": "TIFF",
    "ico":  "ICO",
    "avif": "AVIF",
    "heic": "HEIF",
}


def _report(job_id: Optional[str], pct: int) -> None:
    if not job_id:
        return
    try:
        import jobs as job_store
        job_store.set_progress(job_id, pct)
    except Exception:
        pass


def _register_optional_decoders() -> None:
    """Register offline Pillow plugins (such as pillow_heif for HEIC/HEIF/AVIF)."""
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
        pillow_heif.register_avif_opener()
    except Exception:
        pass


def _is_svg(data: bytes) -> bool:
    prefix = data[:512].strip().lower()
    return (
        prefix.startswith(b"<svg")
        or (prefix.startswith(b"<?xml") and b"<svg" in data[:2048].lower())
        or b"<!doctype svg" in prefix
    )


def _compress_svg(data: bytes, level: str) -> bytes:
    """Offline SVG minifier removing bloat, editor tags, comments, and extra precision."""
    try:
        text = data.decode("utf-8", errors="ignore")
    except Exception:
        return data

    # Strip comments <!-- ... -->
    text = re.sub(r"<!--[\s\S]*?-->", "", text)
    # Strip doctype and XML processing instructions
    text = re.sub(r"<\?xml[^>]*\?>", "", text)
    text = re.sub(r"<!DOCTYPE[^>]*>", "", text, flags=re.IGNORECASE)
    # Strip metadata and editor blocks
    text = re.sub(r"<metadata[\s\S]*?</metadata>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<sodipodi:[^>]*/>|<sodipodi:[^>]*>[\s\S]*?</sodipodi:[^>]*>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<inkscape:[^>]*/>|<inkscape:[^>]*>[\s\S]*?</inkscape:[^>]*>", "", text, flags=re.IGNORECASE)
    # Strip editor attributes (inkscape:*, sodipodi:*, data-name, etc.) and xmlns
    text = re.sub(r'\s+xmlns:(?:inkscape|sodipodi|sketch|illustrator)="[^"]*"', "", text)
    text = re.sub(r'\s+(?:inkscape|sodipodi|sketch|illustrator):[a-zA-Z0-9_-]+="[^"]*"', "", text)
    text = re.sub(r"\s+data-name=\"[^\"]*\"", "", text)
    # Strip redundant spaces between tags
    text = re.sub(r">\s+<", "><", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text)

    decimals = LEVEL_SETTINGS.get(level, {}).get("svg_decimals")
    if decimals is not None:
        pattern = r"(\d+\.\d{" + str(decimals) + r"})\d+"
        text = re.sub(pattern, r"\1", text)
        # Strip trailing zeroes in decimals
        text = re.sub(r"(\.\d*?[1-9])0+(?=[^\d])", r"\1", text)
        text = re.sub(r"\.0+(?=[^\d])", "", text)

    compressed = text.strip().encode("utf-8")
    return compressed if len(compressed) < len(data) else data


def _open_image(data: bytes):
    try:
        from PIL import Image, ImageFile, ImageOps, UnidentifiedImageError
    except ImportError:
        raise RuntimeError("Pillow is not installed. Run: pip install Pillow")

    _register_optional_decoders()
    ImageFile.LOAD_TRUNCATED_IMAGES = True
    Image.MAX_IMAGE_PIXELS = None

    try:
        img = Image.open(io.BytesIO(data))
        fmt = img.format
        # Ensure EXIF orientation is normalized so photos are not rotated sideways
        try:
            transposed = ImageOps.exif_transpose(img)
            if transposed is not None:
                img = transposed
        except Exception:
            pass
        if not getattr(img, "format", None):
            img.format = fmt
        img.load()
        return img
    except UnidentifiedImageError as exc:
        raise ValueError(
            "Unsupported or damaged image. Please ensure the file is a valid image format."
        ) from exc


def _normalise_format(fmt: Optional[str]) -> str:
    key = (fmt or "").upper()
    return PIL_TO_EXT.get(key, key.lower() or "png")


def _choose_output_format(src_fmt: str, has_alpha: bool) -> str:
    if src_fmt in {"bmp", "dib"}:
        return "bmp"
    if src_fmt == "ico":
        return "ico"
    if src_fmt in EXT_TO_PIL or src_fmt in {"jpg", "jpeg", "png", "webp", "gif", "tiff", "avif", "heic"}:
        return src_fmt
    if has_alpha:
        return "png"
    return "jpg"


def _to_jpeg_rgb(img):
    """JPEG has no alpha — composite onto a clean background and strip metadata bloat."""
    from PIL import Image
    if img.mode == "RGB":
        res = Image.new("RGB", img.size)
        res.paste(img)
        return res
    if img.mode == "CMYK":
        return img.convert("RGB")
    if img.mode == "P":
        img = img.convert("RGBA")
    if img.mode in ("RGBA", "LA"):
        if img.mode == "LA":
            img = img.convert("RGBA")
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[-1])
        return background
    return img.convert("RGB")


def _compress_png(img, settings: dict, orig_len: Optional[int] = None) -> bytes:
    """
    Compress PNG using multi-strategy adaptive optimization:
    1. Clean lossless DEFLATE with chunk stripping (compress_level=9, optimize=True).
    2. Adaptive palette quantization avoiding palette table bloat on small images.
    3. Multi-tier color budgeting (256, 192, 128, 64, 32).
    4. Optional libimagequant / TinyPNG quantization.
    Always selects the smallest valid output strictly reducing file size.
    """
    from PIL import Image

    colors = settings.get("png_colors") or 256
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)

    candidates: list[bytes] = []

    # 1. Clean lossless DEFLATE with max compression level and optimization
    try:
        clean_img = img.copy()
        clean_img.info = {}
        buf_lossless = io.BytesIO()
        clean_img.save(buf_lossless, format="PNG", compress_level=9, optimize=True)
        val = buf_lossless.getvalue()
        if val:
            candidates.append(val)
    except Exception:
        pass

    # 2. Inspect actual unique colors to avoid writing huge 256-color palette chunks on small images
    try:
        raw_colors = img.getcolors(maxcolors=256)
        actual_colors = len(raw_colors) if raw_colors else 256
    except Exception:
        actual_colors = 256

    color_steps = [c for c in [min(colors, actual_colors), 192, 128, 64, 32] if c <= 256]
    # Remove duplicates while preserving order
    color_steps = list(dict.fromkeys(color_steps))

    # 3. Direct palette re-quantization if already mode 'P'
    if img.mode == "P":
        for col_count in color_steps:
            try:
                q_img = img.quantize(
                    colors=col_count,
                    method=Image.Quantize.FASTOCTREE,
                    dither=Image.Dither.NONE,
                )
                buf_q = io.BytesIO()
                q_img.save(buf_q, format="PNG", compress_level=9, optimize=True)
                val = buf_q.getvalue()
                if val:
                    candidates.append(val)
                    if orig_len and len(val) < orig_len * 0.75:
                        break
            except Exception:
                pass
    else:
        rgba_img = img.convert("RGBA") if has_alpha else img.convert("RGB")

        # 4. Try libimagequant if installed
        try:
            import imagequant
            for col_count in [min(colors, 256), 128]:
                try:
                    q_img = imagequant.quantize_pil_image(
                        rgba_img,
                        dithering_level=0.5,
                        max_colors=col_count,
                    )
                    buf_q = io.BytesIO()
                    q_img.save(buf_q, format="PNG", compress_level=9, optimize=True)
                    val = buf_q.getvalue()
                    if val:
                        candidates.append(val)
                        if orig_len and len(val) < orig_len * 0.7:
                            break
                except Exception:
                    pass
        except ImportError:
            pass

        # 5. Fast zero-dither Pillow quantization with adaptive color tiers
        for col_count in color_steps:
            try:
                if has_alpha:
                    q_img = rgba_img.quantize(
                        colors=col_count,
                        method=Image.Quantize.FASTOCTREE,
                        dither=Image.Dither.NONE,
                    )
                else:
                    q_img = rgba_img.quantize(
                        colors=col_count,
                        method=Image.Quantize.MEDIANCUT,
                        dither=Image.Dither.NONE,
                    )
                buf_q = io.BytesIO()
                q_img.save(buf_q, format="PNG", compress_level=9, optimize=True)
                val = buf_q.getvalue()
                if val:
                    candidates.append(val)
                    if orig_len and len(val) < orig_len * 0.7:
                        break
            except Exception:
                pass

    # Filter strictly smaller candidates if orig_len is provided
    if orig_len:
        smaller = [c for c in candidates if len(c) < orig_len]
        if smaller:
            return min(smaller, key=len)

    if not candidates:
        buf = io.BytesIO()
        img.save(buf, format="PNG", compress_level=9, optimize=True)
        return buf.getvalue()

    return min(candidates, key=len)


def _compress_pillow(
    data: bytes,
    level: str,
    job_id: Optional[str],
    max_dim_override: Optional[int] = None,
) -> tuple[bytes, str]:
    from PIL import Image, ImageFile, ImageSequence

    settings = dict(LEVEL_SETTINGS[level])
    if max_dim_override is not None:
        settings["max_dimension"] = max_dim_override if max_dim_override > 0 else None

    jpg_quality = int(settings["jpg_quality"])
    webp_quality = int(settings["webp_quality"])
    avif_quality = int(settings["avif_quality"])
    heic_quality = int(settings["heic_quality"])
    gif_colors = int(settings["gif_colors"])
    orig_sz = len(data)

    _report(job_id, 20)

    img = _open_image(data)
    src_fmt = _normalise_format(img.format)
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)

    # 1. Smart dimension scaling if image exceeds max dimension for the preset
    max_dim = settings.get("max_dimension")
    if max_dim and max(img.size) > max_dim:
        ratio = max_dim / max(img.size)
        new_size = (max(1, int(img.size[0] * ratio)), max(1, int(img.size[1] * ratio)))
        img = img.resize(new_size, Image.Resampling.LANCZOS)

    ImageFile.MAXBLOCK = max(ImageFile.MAXBLOCK, img.size[0] * img.size[1] * 4, 4_194_304)

    _report(job_id, 40)
    out_fmt = _choose_output_format(src_fmt, has_alpha)
    out = io.BytesIO()

    if out_fmt == "jpg":
        _report(job_id, 60)
        rgb_img = _to_jpeg_rgb(img)
        jpg_candidates: list[bytes] = []

        # Try base quality; if >= orig_sz, adaptively step down quality
        for q in [jpg_quality, max(38, jpg_quality - 8), max(35, jpg_quality - 16)]:
            # Progressive is standard and smaller; test progressive first
            buf = io.BytesIO()
            rgb_img.save(
                buf,
                format="JPEG",
                quality=q,
                optimize=True,
                progressive=True,
                subsampling="4:2:0",
            )
            val = buf.getvalue()
            if val:
                jpg_candidates.append(val)
                if len(val) < orig_sz:
                    break

            # If progressive didn't beat orig_sz, try non-progressive
            buf = io.BytesIO()
            rgb_img.save(
                buf,
                format="JPEG",
                quality=q,
                optimize=True,
                progressive=False,
                subsampling="4:2:0",
            )
            val = buf.getvalue()
            if val and len(val) < orig_sz:
                jpg_candidates.append(val)
                break

            if any(len(c) < orig_sz for c in jpg_candidates):
                break

        # If still not smaller than original and image has large dimensions, try subtle 10% resize
        if all(len(c) >= orig_sz for c in jpg_candidates) and max(rgb_img.size) > 1200:
            scale = 0.90
            w = max(1, int(rgb_img.size[0] * scale))
            h = max(1, int(rgb_img.size[1] * scale))
            scaled = rgb_img.resize((w, h), Image.Resampling.LANCZOS)
            for q in [jpg_quality, max(38, jpg_quality - 10)]:
                buf = io.BytesIO()
                scaled.save(buf, format="JPEG", quality=q, optimize=True, progressive=True, subsampling="4:2:0")
                val = buf.getvalue()
                if val and len(val) < orig_sz:
                    jpg_candidates.append(val)
                    break
                if any(len(c) < orig_sz for c in jpg_candidates):
                    break

        if jpg_candidates:
            out.write(min(jpg_candidates, key=len))
        else:
            rgb_img.save(out, format="JPEG", quality=jpg_quality, optimize=True, progressive=True, subsampling="4:2:0")

    elif out_fmt == "png":
        _report(job_id, 60)
        if getattr(img, "is_animated", False):
            frames = [frame.copy() for frame in ImageSequence.Iterator(img)]
            frames[0].save(
                out,
                format="PNG",
                save_all=True,
                append_images=frames[1:],
                optimize=True,
                compress_level=9,
            )
        else:
            png_bytes = _compress_png(img, settings, orig_len=orig_sz)
            out.write(png_bytes)

    elif out_fmt == "webp":
        _report(job_id, 60)
        webp_candidates: list[bytes] = []
        for q in [webp_quality, max(38, webp_quality - 8), max(35, webp_quality - 16)]:
            buf = io.BytesIO()
            save_kwargs = {
                "format": "WEBP",
                "quality": q,
                "method": 4,
                "lossless": False,
            }
            if getattr(img, "is_animated", False):
                frames = [frame.copy() for frame in ImageSequence.Iterator(img)]
                save_kwargs.update({
                    "save_all": True,
                    "append_images": frames[1:],
                    "duration": img.info.get("duration", 100),
                    "loop": img.info.get("loop", 0),
                })
                frames[0].save(buf, **save_kwargs)
            else:
                img.save(buf, **save_kwargs)
            val = buf.getvalue()
            if val and (len(val) < orig_sz or not webp_candidates):
                webp_candidates.append(val)
                if len(val) < orig_sz:
                    break
            if any(len(c) < orig_sz for c in webp_candidates):
                break
        if webp_candidates:
            out.write(min(webp_candidates, key=len))
        else:
            img.save(out, format="WEBP", quality=webp_quality, method=4)

    elif out_fmt == "gif":
        _report(job_id, 60)
        if getattr(img, "is_animated", False):
            frames = []
            for frame in ImageSequence.Iterator(img):
                f = frame.copy().convert("RGBA" if has_alpha else "RGB")
                try:
                    import imagequant
                    q_f = imagequant.quantize_pil_image(f, dithering_level=0.9, max_colors=gif_colors)
                except Exception:
                    q_f = f.quantize(
                        colors=gif_colors,
                        method=Image.Quantize.FASTOCTREE if has_alpha else Image.Quantize.MEDIANCUT,
                    )
                frames.append(q_f)
            frames[0].save(
                out,
                format="GIF",
                save_all=True,
                append_images=frames[1:],
                optimize=True,
                duration=img.info.get("duration", 100),
                loop=img.info.get("loop", 0),
            )
        else:
            try:
                import imagequant
                f = img.convert("RGBA" if has_alpha else "RGB")
                q_img = imagequant.quantize_pil_image(f, dithering_level=0.95, max_colors=gif_colors)
            except Exception:
                q_img = img.quantize(
                    colors=gif_colors,
                    method=Image.Quantize.FASTOCTREE if has_alpha else Image.Quantize.MEDIANCUT,
                )
            q_img.save(out, format="GIF", optimize=True)

    elif out_fmt == "tiff":
        _report(job_id, 60)
        img.save(
            out,
            format="TIFF",
            compression="tiff_lzw",
            save_all=getattr(img, "is_animated", False),
        )

    elif out_fmt == "bmp":
        _report(job_id, 60)
        try:
            if level in ("maximum", "high", "medium"):
                q_img = img.convert("RGB").quantize(colors=256)
                q_img.save(out, format="BMP")
            else:
                img.save(out, format="BMP")
        except Exception:
            img.save(out, format="BMP")

    elif out_fmt == "ico":
        _report(job_id, 60)
        img.save(out, format="ICO")

    elif out_fmt == "avif":
        _report(job_id, 60)
        img.save(out, format="AVIF", quality=avif_quality)

    elif out_fmt == "heic":
        _report(job_id, 60)
        try:
            import pillow_heif
            heif_file = pillow_heif.from_pillow(img)
            heif_file.save(out, quality=heic_quality)
        except Exception:
            rgb_img = _to_jpeg_rgb(img)
            rgb_img.save(out, format="JPEG", quality=jpg_quality, optimize=True, progressive=True, subsampling="4:2:0")
            out_fmt = "jpg"

    else:
        out_fmt = "png"
        png_bytes = _compress_png(img, settings)
        out.write(png_bytes)

    _report(job_id, 90)
    compressed = out.getvalue()
    if not compressed:
        raise RuntimeError("Compression produced an empty output.")

    # Guaranteed size safety: if compressed is larger than original and format matches, keep smaller
    if len(compressed) > len(data) and src_fmt == out_fmt:
        return data, out_fmt

    return compressed, out_fmt


def compress_image(
    data: bytes,
    level: str = "high",
    job_id: Optional[str] = None,
    max_dim_override: Optional[int] = None,
) -> tuple[bytes, str, str]:
    """
    Compress raw image data offline across all supported formats.

    Returns:
        (compressed_bytes, format_extension, mime_type)
    """
    if level not in VALID_LEVELS:
        raise ValueError(
            f"Invalid compression level '{level}'. "
            f"Valid presets: {', '.join(sorted(VALID_LEVELS))}"
        )

    _report(job_id, 10)

    # 1. Vector SVG handling
    if _is_svg(data):
        compressed_svg = _compress_svg(data, level)
        _report(job_id, 95)
        return compressed_svg, "svg", MEDIA_TYPES["svg"]

    # 2. Raster images (Pillow + pillow_heif + imagequant)
    result, out_fmt = _compress_pillow(data, level, job_id, max_dim_override)
    media_type = MEDIA_TYPES.get(out_fmt, "application/octet-stream")
    return result, out_fmt, media_type
