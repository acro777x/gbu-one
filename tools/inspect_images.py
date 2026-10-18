import sys
from PIL import Image

for name in ["assets/brand/source/logo-tile-with-glow.png", "assets/brand/source/logo-flat-raw-transparent.png", "assets/brand/source/gbu-one-final-sheet.png"]:
    try:
        im = Image.open(name)
        print(f"{name}: mode={im.mode}, size={im.size}")
    except Exception as e:
        print(f"Error {name}: {e}")
