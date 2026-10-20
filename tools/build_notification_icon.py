"""
Generate the Android notification small icon from the FINAL GBU One mark.

Android requires a notification icon to be a single-colour (white) silhouette
with transparency. This script does NOT redesign the logo: it reuses the
component masks that were extracted from the approved artwork
(`tools/mask_ring_clean.png`, `mask_dome_clean.png`, `mask_ivory.png`),
so the geometry is identical to the shipped brand asset.

The numeral "1" is knocked out of the dome so it stays legible once the whole
mark is flattened to one colour (the OS tints the icon anyway).

Outputs: assets/brand/notification-icon.png      (1024x1024, white on transparent)
         assets/brand/notification-icon-96.png   (96x96, for expo-notifications)
"""
import numpy as np
from PIL import Image

RING = "tools/mask_ring_clean.png"
DOME = "tools/mask_dome_clean.png"
NUMERAL = "tools/mask_ivory.png"
OUT_MASTER = "assets/brand/notification-icon.png"
OUT_96 = "assets/brand/notification-icon-96.png"


def load(path: str) -> np.ndarray:
    return np.array(Image.open(path).convert("L"))


ring = load(RING)
dome = load(DOME)
numeral = load(NUMERAL)

if not (ring.shape == dome.shape == numeral.shape):
    raise SystemExit("Component masks have different sizes")

# Knock the numeral out of the dome so the "1" reads as a hole in the dome.
dome_knockout = np.where(numeral > 0, 0, dome).astype(np.uint8)

shape = np.maximum.reduce([ring, dome_knockout, numeral]).astype(np.uint8)

# Trim the transparent padding, then rebuild a square with a small margin.
ys, xs = np.nonzero(shape)
if len(ys) == 0:
    raise SystemExit("Combined mask is empty")

pad = 4
y0, y1 = ys.min() - pad, ys.max() + pad
x0, x1 = xs.min() - pad, xs.max() + pad
cropped = shape[max(y0, 0):y1, max(x0, 0):x1]

side = max(cropped.shape)
square = np.zeros((side, side), dtype=np.uint8)
oy = (side - cropped.shape[0]) // 2
ox = (side - cropped.shape[1]) // 2
square[oy:oy + cropped.shape[0], ox:ox + cropped.shape[1]] = cropped

margin = int(side * 0.06)
inner = side - margin * 2
glyph = np.array(
    Image.fromarray(square).resize((inner, inner), Image.LANCZOS)
)

canvas = np.zeros((side, side), dtype=np.uint8)
canvas[margin:margin + inner, margin:margin + inner] = glyph

white = Image.new("RGBA", (side, side), (255, 255, 255, 0))
white.putalpha(Image.fromarray(canvas))

master = white.resize((1024, 1024), Image.LANCZOS)
master.save(OUT_MASTER)
master.resize((96, 96), Image.LANCZOS).save(OUT_96)

print(f"ring+dome+numeral -> {OUT_MASTER} (1024x1024), {OUT_96} (96x96)")
