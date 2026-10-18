from PIL import Image
import numpy as np

flat = Image.open("assets/brand/source/logo-flat-raw-transparent.png")
tile = Image.open("assets/brand/source/logo-tile-with-glow.png")

# Let's inspect mark region y: [100, 560]
flat_mark = flat.crop((150, 100, 750, 560))
flat_mark.save("tools/crop_flat_mark.png")

tile_mark = tile.crop((150, 100, 750, 560))
tile_mark.save("tools/crop_tile_mark.png")

print("Saved cropped mark regions. Dimensions:", flat_mark.size)
