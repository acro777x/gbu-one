from PIL import Image
import numpy as np

im = Image.open("assets/brand/source/logo-tile-with-glow.png")
print("logo-tile-with-glow size:", im.size)
# Sample colors along vertical and horizontal center
arr = np.array(im)
# Find bright regions
gray = np.mean(arr[:, :, :3], axis=2)
print("Center region mean brightness (400-500, 400-500):", np.mean(gray[400:500, 400:500]))
print("Top region mean brightness (100-300, 300-600):", np.mean(gray[100:300, 300:600]))
print("Bottom region mean brightness (600-800, 300-600):", np.mean(gray[600:800, 300:600]))

# Let's check where the text is vs mark
# Find rows where there is high contrast / bright pixels
row_max = np.max(gray, axis=1)
col_max = np.max(gray, axis=0)

active_rows = np.where(row_max > 80)[0]
active_cols = np.where(col_max > 80)[0]
print(f"Active rows: {active_rows.min()} to {active_rows.max()}")
print(f"Active cols: {active_cols.min()} to {active_cols.max()}")

# Check for gap between mark and wordmark
row_means = np.mean(gray[:, active_cols.min():active_cols.max()], axis=1)
for y in range(active_rows.min(), active_rows.max(), 25):
    print(f"y={y:3d}: mean brightness = {row_means[y]:.1f}, max = {row_max[y]:.1f}")
