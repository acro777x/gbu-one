import cv2
import numpy as np
from PIL import Image

ivory_img = cv2.imread("tools/mask_ivory.png", cv2.IMREAD_GRAYSCALE)
orange_img = cv2.imread("tools/mask_orange.png", cv2.IMREAD_GRAYSCALE)

# Morphological clean up to remove background-removal artifacts (speckles)
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
ivory_clean = cv2.morphologyEx(ivory_img, cv2.MORPH_CLOSE, kernel)
ivory_clean = cv2.morphologyEx(ivory_clean, cv2.MORPH_OPEN, kernel)

orange_clean = cv2.morphologyEx(orange_img, cv2.MORPH_CLOSE, kernel)
orange_clean = cv2.morphologyEx(orange_clean, cv2.MORPH_OPEN, kernel)

def contour_to_svg_path(contour, scale=512.0/520.0):
    # Approximating contour to polygon with moderate epsilon
    epsilon = 0.003 * cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, epsilon, True)
    
    pts = approx.reshape(-1, 2)
    if len(pts) < 3:
        return ""
    
    # Scale points to 512x512
    scaled_pts = pts * scale
    
    # Build path
    d = f"M {scaled_pts[0][0]:.2f} {scaled_pts[0][1]:.2f} "
    for pt in scaled_pts[1:]:
        d += f"L {pt[0]:.2f} {pt[1]:.2f} "
    d += "Z"
    return d

# Find numeral 1 contour
cnts_1, _ = cv2.findContours(ivory_clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_TC89_KCOS)
largest_1 = max(cnts_1, key=cv2.contourArea)
path_1 = contour_to_svg_path(largest_1)
print(f"Path 1 length of contour points: {len(largest_1)}, arcLength: {cv2.arcLength(largest_1, True) * (512.0/520.0):.2f}")

# Orange has: Dome + Finial and Ring
# Let's separate dome from ring: dome is in the upper central area (y < 280, x between 100 and 420 in crop)
# Let's inspect connected components of orange_clean
num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(orange_clean)
print(f"Orange components found: {num_labels}")

dome_mask = np.zeros_like(orange_clean)
ring_mask = np.zeros_like(orange_clean)

for label in range(1, num_labels):
    area = stats[label, cv2.CC_STAT_AREA]
    if area < 50:
        continue
    x = stats[label, cv2.CC_STAT_LEFT]
    y = stats[label, cv2.CC_STAT_TOP]
    w = stats[label, cv2.CC_STAT_WIDTH]
    h = stats[label, cv2.CC_STAT_HEIGHT]
    cx_lbl, cy_lbl = centroids[label]
    print(f"Component {label}: area={area}, bbox=[x={x}, y={y}, w={w}, h={h}], center=({cx_lbl:.1f}, {cy_lbl:.1f})")
    
    # The outer ring has large area (> 30000)
    if area > 20000:
        ring_mask[labels == label] = 255
    else:
        # Dome, finial, arches
        dome_mask[labels == label] = 255

# Save masks
cv2.imwrite("tools/mask_dome_clean.png", dome_mask)
cv2.imwrite("tools/mask_ring_clean.png", ring_mask)
print("Saved clean dome and ring masks.")
