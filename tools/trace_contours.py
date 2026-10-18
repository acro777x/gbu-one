import cv2
import numpy as np
from PIL import Image

# Read logo-tile-with-glow.png
tile_img = cv2.imread("assets/brand/source/logo-tile-with-glow.png", cv2.IMREAD_UNCHANGED)
# and flat
flat_img = cv2.imread("assets/brand/source/logo-flat-raw-transparent.png", cv2.IMREAD_UNCHANGED)

print("tile_img shape:", tile_img.shape)
print("flat_img shape:", flat_img.shape)

# Let's inspect the mark area (y between 100 and 550, x between 150 and 750)
mark_crop = flat_img[100:550, 150:750]

# Split channels
b, g, r, a = cv2.split(mark_crop)

# Let's isolate the ivory numeral '1':
# High R, G, B, low color difference (near white/cream/ivory)
ivory_mask = (r > 180) & (g > 180) & (b > 180) & (a > 100)
ivory_uint8 = np.uint8(ivory_mask * 255)

# Find contours of numeral 1
contours_1, _ = cv2.findContours(ivory_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
print(f"Numeral 1 contours: {len(contours_1)}")
for i, c in enumerate(contours_1):
    area = cv2.contourArea(c)
    if area > 100:
        x, y, w, h = cv2.boundingRect(c)
        print(f"Contour {i}: area={area}, bbox=[x={x+150}, y={y+100}, w={w}, h={h}]")

# Let's isolate the orange components (dome + ring)
# In HSV or RGB: high R, moderate G, low B
orange_mask = (r > 120) & (b < 100) & (a > 80)
# Exclude the numeral 1
orange_no_1 = orange_mask & (~ivory_mask)
orange_uint8 = np.uint8(orange_no_1 * 255)

contours_orange, _ = cv2.findContours(orange_uint8, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
print(f"Orange contours count: {len(contours_orange)}")
for i, c in enumerate(contours_orange):
    area = cv2.contourArea(c)
    if area > 200:
        x, y, w, h = cv2.boundingRect(c)
        print(f"Orange contour {i}: area={area}, bbox=[x={x+150}, y={y+100}, w={w}, h={h}]")
