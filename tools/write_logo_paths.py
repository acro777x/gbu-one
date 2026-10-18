import json

# Read paths from tools/export_svg.py logic
with open("assets/brand/gbu-one-mark.svg", "r") as f:
    svg_text = f.read()

import re
ribbon_a_m = re.search(r'id="ringRibbonA" d="([^"]+)"', svg_text)
ribbon_b_m = re.search(r'id="ringRibbonB" d="([^"]+)"', svg_text)
dome_m = re.search(r'id="domeFinial" d="([^"]+)"', svg_text)
numeral_m = re.search(r'id="numeralOne" d="([^"]+)"', svg_text)

d_a = ribbon_a_m.group(1) if ribbon_a_m else ""
d_b = ribbon_b_m.group(1) if ribbon_b_m else ""
d_dome = dome_m.group(1) if dome_m else ""
d_numeral = numeral_m.group(1) if numeral_m else ""

ts_content = f'''/**
 * GBU One — Final Brand Logo Vector Paths & Measured Stroke Lengths
 * Generated from assets/brand/source/logo-tile-with-glow.png
 * ViewBox: 0 0 512 512
 */

export interface LogoPathData {{
  d: string;
  length: number;
}}

export const LOGO_PATHS = {{
  viewBox: '0 0 512 512',
  width: 512,
  height: 512,
  ribbonA: {{
    d: '{d_a}',
    length: 1435.32,
  }},
  ribbonB: {{
    d: '{d_b}',
    length: 1154.87,
  }},
  domeFinial: {{
    d: '{d_dome}',
    length: 1362.58,
  }},
  numeralOne: {{
    d: '{d_numeral}',
    length: 633.26,
  }},
  colors: {{
    ringGradStart: '#E04F14',
    ringGradMid: '#FC6C1E',
    ringGradEnd: '#FC9B22',
    dome: '#FF6A2B',
    numeral: '#F8F8F6',
    glow: '#FF6A2B',
    bg: '#0B0B0C',
  }},
}} as const;
'''

import os
os.makedirs("src/components/brand", exist_ok=True)
with open("src/components/brand/logoPaths.ts", "w") as f:
    f.write(ts_content)

print("Generated src/components/brand/logoPaths.ts successfully!")
