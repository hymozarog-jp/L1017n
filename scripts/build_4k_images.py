#!/usr/bin/env python3
"""Produce browser-friendly 4K (3840px longest edge) and 960px WebP versions
for raster images in game-covers. Preserve original artwork and aspect ratios.
Upscaling does not recreate detail absent from the source image.
"""
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter

SOURCE = Path("game-covers")
FOUR_K = SOURCE / "4k"
MOBILE = SOURCE / "mobile"
RASTER = {".png", ".jpg", ".jpeg", ".webp"}
FOUR_K.mkdir(parents=True, exist_ok=True)
MOBILE.mkdir(parents=True, exist_ok=True)

def create(source: Path, destination: Path, max_edge: int, quality: int):
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        image.load()
        image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        w, h = image.size
        if not w or not h:
            return
        # Keep the complete composition rather than cropping a cover.
        scale = max_edge / max(w, h)
        target = (max(1, round(w * scale)), max(1, round(h * scale)))
        if target != image.size:
            image = image.resize(target, Image.Resampling.LANCZOS)
            if scale > 1.1:
                # Modest edge contrast; upscaling is not real detail restoration.
                image = image.filter(ImageFilter.UnsharpMask(radius=1.1, percent=70, threshold=4))
        image.save(destination, format="WEBP", quality=quality, method=4)
        with Image.open(destination) as test:
            assert max(test.size) == max_edge, (destination, test.size)
        print(f"{source.name}: {w}x{h} -> {target[0]}x{target[1]} ({destination.stat().st_size:,} bytes)")

sources = sorted(p for p in SOURCE.iterdir() if p.is_file() and p.suffix.lower() in RASTER)
assert sources, "No source raster images were found."
for source in sources:
    create(source, FOUR_K / (source.stem + ".webp"), 3840, 81)
    create(source, MOBILE / (source.stem + ".webp"), 960, 78)
print(f"Built {len(sources)} 4K master images and {len(sources)} mobile images.")
