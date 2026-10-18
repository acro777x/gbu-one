import cv2
import numpy as np
from PIL import Image, ImageDraw
import os

# We will extract the mark components from the source
# In logo-flat-raw-transparent.png (887x887):
# Mark bounding box is roughly x: [200, 680], y: [120, 550]
# Width = 480, Height = 430, Center = (441, 335)

im = Image.open("assets/brand/source/logo-flat-raw-transparent.png")
arr = np.array(im)

# Let's crop a square region centered on the mark
# Center = (441, 335), size = 520x520 -> x: [181, 701], y: [75, 595]
cx, cy = 441, 335
half_size = 260
x0 = cx - half_size
x1 = cx + half_size
y0 = cy - half_size
y1 = cy + half_size

mark_square = im.crop((x0, y0, x1, y1))
mark_square.save("assets/brand/source/mark-crop-square.png")
print(f"Cropped square mark from [{x0}, {y0}] to [{x1}, {y1}], size = {mark_square.size}")

# Now let's extract:
# 1. Numeral 1 (Ivory)
# 2. Dome + Finial
# 3. Ring Ribbon A (Upper/outer)
# 4. Ring Ribbon B (Lower/inner)
arr_crop = np.array(mark_square)
r = arr_crop[:, :, 0]
g = arr_crop[:, :, 1]
b = arr_crop[:, :, 2]
a = arr_crop[:, :, 3]

# Ivory mask
ivory_mask = (r > 190) & (g > 190) & (b > 190) & (a > 120)

# Orange mask
orange_mask = (r > 130) & (b < 100) & (a > 60) & (~ivory_mask)

# Save masks for inspection
Image.fromarray(np.uint8(ivory_mask * 255)).save("tools/mask_ivory.png")
Image.fromarray(np.uint8(orange_mask * 255)).save("tools/mask_orange.png")

print("Saved masks for ivory and orange components.")
