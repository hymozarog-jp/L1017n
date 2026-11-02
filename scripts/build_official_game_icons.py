#!/usr/bin/env python3
"""Fetch current official Roblox experience icons (not third-party reuploads),
and prepare high-resolution, mobile-friendly artwork without modifying original
item imagery or purchase flows. Source art remains the creator's own.
"""
import io
import json
import time
import urllib.request
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter

GAMES={"mm2":"66654135","brainrot":"7709344486"}
BASE=Path("game-covers")/"official"
BASE.mkdir(parents=True,exist_ok=True)
API="https://thumbnails.roblox.com/v1/games/icons?universeIds="+",".join(GAMES.values())+"&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false"

def get_bytes(url):
    request=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; L1017n-image-build/1.0)"})
    with urllib.request.urlopen(request,timeout=30) as response:
        return response.read()

payload=json.loads(get_bytes(API).decode("utf-8"))
items={str(i["targetId"]):i for i in payload.get("data",[])}
for name,uid in GAMES.items():
    row=items.get(uid)
    if not row or row.get("state")!="Completed" or not row.get("imageUrl"):
        raise RuntimeError(f"Official icon unavailable for {name}: {row}")
    content=get_bytes(row["imageUrl"])
    with Image.open(io.BytesIO(content)) as img:
        img=ImageOps.exif_transpose(img)
        img.load()
        if min(img.size)<256: raise RuntimeError(f"Official icon too small: {name} {img.size}")
        img=img.convert("RGBA" if "A" in img.getbands() else "RGB")
        original_size=img.size
        for folder,edge,quality in [("mobile",960,85),("4k",3840,86)]:
            target=BASE/folder
            target.mkdir(parents=True,exist_ok=True)
            width,height=img.size
            size=(int(round(width*edge/max(width,height))),int(round(height*edge/max(width,height))))
            result=img.resize(size,Image.Resampling.LANCZOS)
            if edge>max(img.size):
                result=result.filter(ImageFilter.UnsharpMask(radius=1,percent=65,threshold=3))
            file=target/(name+".webp")
            result.save(file,"WEBP",quality=quality,method=5)
            with Image.open(file) as verify:
                assert max(verify.size)==edge
            print(f"{name}: official original {original_size} -> {file} {size} ({file.stat().st_size} bytes)")
print("Official game icons built successfully.")
