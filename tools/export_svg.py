import cv2
import numpy as np
from PIL import Image, ImageDraw
import os

# We have the 520x520 crop from the ground truth
# Target viewBox is 512x512
scale = 512.0 / 520.0

ivory_clean = cv2.imread("tools/mask_ivory.png", cv2.IMREAD_GRAYSCALE)
dome_clean = cv2.imread("tools/mask_dome_clean.png", cv2.IMREAD_GRAYSCALE)
ring_clean = cv2.imread("tools/mask_ring_clean.png", cv2.IMREAD_GRAYSCALE)

# Clean up masks with smooth morphology
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
ivory_clean = cv2.morphologyEx(ivory_clean, cv2.MORPH_CLOSE, kernel)
dome_clean = cv2.morphologyEx(dome_clean, cv2.MORPH_CLOSE, kernel)
ring_clean = cv2.morphologyEx(ring_clean, cv2.MORPH_CLOSE, kernel)

def contour_to_d(contour, scale_factor=scale):
    # Smooth approximation
    epsilon = 0.002 * cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, epsilon, True)
    pts = approx.reshape(-1, 2) * scale_factor
    if len(pts) < 3:
        return "", 0.0
    
    d = f"M {pts[0][0]:.2f} {pts[0][1]:.2f} "
    total_len = 0.0
    for i in range(1, len(pts)):
        d += f"L {pts[i][0]:.2f} {pts[i][1]:.2f} "
        total_len += np.linalg.norm(pts[i] - pts[i-1])
    d += "Z"
    total_len += np.linalg.norm(pts[0] - pts[-1])
    return d, total_len

# 1. Numeral 1
cnts_1, _ = cv2.findContours(ivory_clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_TC89_KCOS)
largest_1 = max(cnts_1, key=cv2.contourArea)
d_numeral1, len_numeral1 = contour_to_d(largest_1)

# 2. Dome + Finial
# We combine the dome components into clean paths
cnts_dome, _ = cv2.findContours(dome_clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_TC89_KCOS)
d_dome_parts = []
len_dome_total = 0.0
for c in cnts_dome:
    if cv2.contourArea(c) > 100:
        d_p, l_p = contour_to_d(c)
        if d_p:
            d_dome_parts.append(d_p)
            len_dome_total += l_p
d_dome = " ".join(d_dome_parts)

# 3. Ring ribbons
# In the animation spec: Ribbon A and Ribbon B stroke-draw in opposite directions around center
# Split ring into upper-left (Ribbon A) and lower-right (Ribbon B) or outer/inner ribbons
# Let's see: split ring vertically/diagonally through center (260, 260)
h, w = ring_clean.shape
mask_ribbon_a = np.zeros_like(ring_clean)
mask_ribbon_b = np.zeros_like(ring_clean)

# Cut line: diagonal from top-right to bottom-left (y = -x + 520) or split across center
# Let's create an overlapping split so they smoothly join as the twisted ring
Y, X = np.ogrid[:h, :w]
split_a = (Y <= X + 40)
split_b = (Y >= X - 40)

mask_ribbon_a[split_a & (ring_clean > 0)] = 255
mask_ribbon_b[split_b & (ring_clean > 0)] = 255

cnts_a, _ = cv2.findContours(mask_ribbon_a, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_TC89_KCOS)
largest_a = max(cnts_a, key=cv2.contourArea)
d_ribbon_a, len_ribbon_a = contour_to_d(largest_a)

cnts_b, _ = cv2.findContours(mask_ribbon_b, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_TC89_KCOS)
largest_b = max(cnts_b, key=cv2.contourArea)
d_ribbon_b, len_ribbon_b = contour_to_d(largest_b)

print(f"Numeral 1 path length: {len_numeral1:.2f}")
print(f"Dome path length: {len_dome_total:.2f}")
print(f"Ribbon A path length: {len_ribbon_a:.2f}")
print(f"Ribbon B path length: {len_ribbon_b:.2f}")

# Write SVG
svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
  <defs>
    <linearGradient id="ringGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#E04F14" />
      <stop offset="50%" stop-color="#FC6C1E" />
      <stop offset="100%" stop-color="#FC9B22" />
    </linearGradient>
  </defs>
  <!-- Ring Ribbon A -->
  <path id="ringRibbonA" d="{d_ribbon_a}" fill="url(#ringGrad)" />
  <!-- Ring Ribbon B -->
  <path id="ringRibbonB" d="{d_ribbon_b}" fill="url(#ringGrad)" />
  <!-- Dome & Finial -->
  <path id="domeFinial" d="{d_dome}" fill="#FF6A2B" />
  <!-- Numeral 1 -->
  <path id="numeralOne" d="{d_numeral1}" fill="#F8F8F6" />
</svg>
'''

os.makedirs("assets/brand", exist_ok=True)
with open("assets/brand/gbu-one-mark.svg", "w") as f:
    f.write(svg_content)

mono_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
  <path d="{d_ribbon_a}" fill="#F8F8F6" />
  <path d="{d_ribbon_b}" fill="#F8F8F6" />
  <path d="{d_dome}" fill="#F8F8F6" />
  <path d="{d_numeral1}" fill="#0B0B0C" />
</svg>
'''
with open("assets/brand/gbu-one-mark-mono.svg", "w") as f:
    f.write(mono_svg)

print("Generated gbu-one-mark.svg and gbu-one-mark-mono.svg successfully.")
