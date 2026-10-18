import cv2
import numpy as np
from PIL import Image, ImageDraw
import os

# Load ground truth tile with glow
ground_truth = Image.open("assets/brand/source/logo-tile-with-glow.png").convert("RGBA")
gt_w, gt_h = ground_truth.size # 887x887

# We crop the square mark area from ground truth: cx=441, cy=335, half_size=260
cx, cy = 441, 335
half_size = 260
crop_x0, crop_y0 = cx - half_size, cy - half_size
crop_x1, crop_y1 = cx + half_size, cy + half_size

# Load the mask components
ivory_clean = cv2.imread("tools/mask_ivory.png", cv2.IMREAD_GRAYSCALE)
dome_clean = cv2.imread("tools/mask_dome_clean.png", cv2.IMREAD_GRAYSCALE)
ring_clean = cv2.imread("tools/mask_ring_clean.png", cv2.IMREAD_GRAYSCALE)

# Render our clean vector / raster mark at 1024x1024
# Ground truth mark in 520x520
mark_1024 = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))

# We can render the clean traced paths / mask scaled to 1024
# Ring gradient: #E04F14 (224, 79, 20) -> #FC6C1E (252, 108, 30) -> #FC9B22 (252, 155, 34)
# Let's create the gradient image for the ring
grad_img = np.zeros((520, 520, 4), dtype=np.uint8)
for y in range(520):
    for x in range(520):
        # diagonal gradient 0..1
        t = (x + (520 - y)) / 1040.0
        r_c = int(224 + (252 - 224) * t)
        g_c = int(79 + (155 - 79) * t)
        b_c = int(20 + (34 - 20) * t)
        grad_img[y, x] = [r_c, g_c, b_c, 255]

# Apply ring mask
ring_colored = grad_img.copy()
ring_colored[:, :, 3] = ring_clean

# Apply dome mask: #FF6A2B (255, 106, 43)
dome_colored = np.zeros((520, 520, 4), dtype=np.uint8)
dome_colored[dome_clean > 0] = [255, 106, 43, 255]

# Apply numeral 1 mask: ivory #F8F8F6 (248, 248, 246)
num1_colored = np.zeros((520, 520, 4), dtype=np.uint8)
num1_colored[ivory_clean > 0] = [248, 248, 246, 255]

# Composite clean mark
mark_520 = Image.alpha_composite(Image.fromarray(ring_colored), Image.fromarray(dome_colored))
mark_520 = Image.alpha_composite(mark_520, Image.fromarray(num1_colored))

# Scale to 1024x1024
mark_rendered_1024 = mark_520.resize((1024, 1024), Image.Resampling.LANCZOS)

# Create 1024x1024 ground truth mark crop
gt_mark_crop = ground_truth.crop((crop_x0, crop_y0, crop_x1, crop_y1))
gt_mark_1024 = gt_mark_crop.resize((1024, 1024), Image.Resampling.LANCZOS)

# Overlay check: render vector mark at 50% opacity over ground truth tile mark
overlay = Image.blend(gt_mark_1024.convert("RGB"), mark_rendered_1024.convert("RGB"), 0.5)

# Calculate difference / alignment
diff = cv2.absdiff(np.array(gt_mark_1024.convert("RGB")), np.array(mark_rendered_1024.convert("RGB")))
mean_diff = np.mean(diff)
print(f"Mean pixel difference across overlay: {mean_diff:.2f}")

os.makedirs("docs/qa", exist_ok=True)
overlay.save("docs/qa/logo-overlay.png")
print("Saved docs/qa/logo-overlay.png successfully!")

# Generate App Icon (1024x1024 with background #0B0B0C)
icon_1024 = Image.new("RGBA", (1024, 1024), (11, 11, 12, 255))
# Place mark centered inside safe zone (padding ~140px on all sides -> size ~744x744)
mark_icon = mark_520.resize((744, 744), Image.Resampling.LANCZOS)
icon_1024.paste(mark_icon, (140, 140), mark_icon)
icon_1024.save("assets/brand/icon-1024.png")

# Android adaptive foreground (432x432, mark inside central 66% safe zone: 432 * 0.66 = ~285px)
fg_432 = Image.new("RGBA", (432, 432), (0, 0, 0, 0))
mark_280 = mark_520.resize((280, 280), Image.Resampling.LANCZOS)
fg_432.paste(mark_280, ((432 - 280) // 2, (432 - 280) // 2), mark_280)
fg_432.save("assets/brand/android-adaptive-foreground.png")

# Android adaptive background
bg_432 = Image.new("RGBA", (432, 432), (11, 11, 12, 255))
bg_432.save("assets/brand/android-adaptive-background.png")

# Splash mark
splash_mark = mark_520.resize((256, 256), Image.Resampling.LANCZOS)
splash_mark.save("assets/brand/splash-mark.png")

# Favicons
mark_520.resize((32, 32), Image.Resampling.LANCZOS).save("assets/brand/favicon-32.png")
mark_520.resize((16, 16), Image.Resampling.LANCZOS).save("assets/brand/favicon-16.png")

print("All required brand assets and icon set generated successfully!")
