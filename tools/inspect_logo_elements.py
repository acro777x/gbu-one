from PIL import Image
import numpy as np

im = Image.open("assets/brand/source/logo-flat-raw-transparent.png")
arr = np.array(im)
alpha = arr[:, :, 3]

# Non-zero alpha bounding box
nonzero = np.argwhere(alpha > 30)
min_y, min_x = nonzero.min(axis=0)
max_y, max_x = nonzero.max(axis=0)
print(f"Overall visible bounding box: x=[{min_x}, {max_x}], y=[{min_y}, {max_y}], w={max_x - min_x}, h={max_y - min_y}")

# Let's inspect colors
# The ivory numeral '1' has high R, G, B (e.g. > 200, > 200, > 200)
ivory_mask = (arr[:, :, 0] > 180) & (arr[:, :, 1] > 180) & (arr[:, :, 2] > 180) & (alpha > 50)
if np.any(ivory_mask):
    coords = np.argwhere(ivory_mask)
    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0)
    print(f"Ivory elements bounding box: x=[{x0}, {x1}], y=[{y0}, {y1}]")

# Orange elements: R > 150, B < 80
orange_mask = (arr[:, :, 0] > 150) & (arr[:, :, 2] < 100) & (alpha > 50)
if np.any(orange_mask):
    coords = np.argwhere(orange_mask)
    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0)
    print(f"Orange elements bounding box: x=[{x0}, {x1}], y=[{y0}, {y1}]")
