import cv2
import numpy as np
from PIL import Image

# Load the visual ground truth image
tile_img = Image.open("assets/brand/source/logo-tile-with-glow.png").convert("RGBA")
tile_arr = np.array(tile_img)

# Also load flat raw
flat_img = Image.open("assets/brand/source/logo-flat-raw-transparent.png").convert("RGBA")
flat_arr = np.array(flat_img)

print("Ground truth image loaded successfully.")
