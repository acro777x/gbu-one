import cv2
import numpy as np

ring_mask = cv2.imread("tools/mask_ring_clean.png", cv2.IMREAD_GRAYSCALE)

# In a twisted ring / ribbon, ribbon A typically spans one side (e.g. top-left to bottom-right or counter-clockwise)
# and ribbon B spans the other side, or outer vs inner loop.
# Let's inspect the contours of the ring mask:
cnts, hier = cv2.findContours(ring_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_TC89_KCOS)
print(f"Ring contours count: {len(cnts)}")
for i, c in enumerate(cnts):
    print(f"Ring contour {i}: area={cv2.contourArea(c)}, length={cv2.arcLength(c, True):.1f}")
