"""
Contrast research for the GBU One palette.

Computes WCAG contrast ratios for the current tokens and for the candidate
replacements, so the palette change is based on numbers rather than taste.

    python tools/contrast_check.py
"""
from itertools import combinations


def srgb_to_linear(channel: float) -> float:
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def luminance(hex_colour: str) -> float:
    value = hex_colour.lstrip('#')
    if len(value) == 8:  # rgba over an assumed base is handled by the caller
        value = value[:6]
    r, g, b = (int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * srgb_to_linear(r) + 0.7152 * srgb_to_linear(g) + 0.0722 * srgb_to_linear(b)


def ratio(foreground: str, background: str) -> float:
    a = luminance(foreground)
    b = luminance(background)
    lighter, darker = max(a, b), min(a, b)
    return (lighter + 0.05) / (darker + 0.05)


def blend(overlay: str, base: str, alpha: float) -> str:
    """Flattens an rgba overlay onto an opaque base."""
    ov = overlay.lstrip('#')
    o = [int(ov[i:i + 2], 16) for i in (0, 2, 4)]
    bv = base.lstrip('#')
    b = [int(bv[i:i + 2], 16) for i in (0, 2, 4)]
    mixed = [round(o[i] * alpha + b[i] * (1 - alpha)) for i in range(3)]
    return '#%02X%02X%02X' % tuple(mixed)


def report(title: str, pairs, min_body=4.5, min_large=3.0):
    print(f'\n=== {title} ===')
    print(f'{"foreground":>16} {"background":>16}  ratio  body  large')
    for fg, bg, note in pairs:
        r = ratio(fg, bg)
        body = 'PASS' if r >= min_body else 'fail'
        large = 'PASS' if r >= min_large else 'fail'
        print(f'{fg:>16} {bg:>16} {r:6.2f}  {body}  {large}  {note}')


LIGHT = {
    'bg': '#F6F7FB', 'surface': '#FFFFFF', 'surfaceAlt': '#EEF1F6',
    'surfaceMuted': '#E5E9F0', 'textPrimary': '#111827', 'textSecondary': '#667085',
    'textTertiary': '#98A2B3', 'accent': '#E85B22', 'accentSoft': '#FFF0E8',
    'onAccent': '#FFFFFF', 'success': '#168A5B', 'successSoft': '#E8F7F0',
    'warning': '#A96800', 'warningSoft': '#FFF5D9', 'danger': '#C53030',
    'dangerSoft': '#FDECEC',
}

DARK = {
    'bg': '#0B0B0C', 'surface': '#161618', 'surfaceAlt': '#1C1C20',
    'surfaceMuted': '#141416', 'textPrimary': '#F5F5F4', 'textSecondary': '#A8A29E',
    'accent': '#FF6A2B', 'accentSoft': 'rgba(255,106,43,0.14)',
    'onAccent': '#FFFFFF', 'success': '#3DD68C', 'warning': '#F5B83D',
    'danger': '#FF5C5C',
}

print('LIGHT palette - current')
report(
    'light: current failures',
    [
        (LIGHT['onAccent'], LIGHT['accent'], 'primary button label'),
        (LIGHT['accent'], LIGHT['surface'], 'accent text on a card'),
        (LIGHT['accent'], LIGHT['accentSoft'], 'accent text on a soft badge'),
        (LIGHT['textTertiary'], LIGHT['surface'], 'caption / placeholder'),
        (LIGHT['textTertiary'], LIGHT['bg'], 'caption on the page'),
        (LIGHT['textSecondary'], LIGHT['surfaceAlt'], 'body text on a tinted well'),
        (LIGHT['success'], LIGHT['successSoft'], 'success text on a soft badge'),
        (LIGHT['warning'], LIGHT['warningSoft'], 'warning text on a soft badge'),
        (LIGHT['textSecondary'], LIGHT['surface'], 'body text on a card'),
    ],
)

print('\nDARK palette - current')
report(
    'dark: current failures',
    [
        (DARK['onAccent'], DARK['accent'], 'primary button label'),
        ('#8C8C8C', DARK['bg'], 'textTertiary (35% white) on the page'),
        ('#8C8C8C', DARK['surface'], 'textTertiary (35% white) on a card'),
        (DARK['textSecondary'], DARK['surface'], 'body text on a card'),
        (DARK['accent'], DARK['surface'], 'accent text on a card'),
    ],
)

# --- candidates -------------------------------------------------------------
print('\n\nCANDIDATES')
candidates = {
    'accent light  #C2410C (orange-700)': '#C2410C',
    'accent light  #B8430F': '#B8430F',
    'accent light  #E85B22 (current)': '#E85B22',
    'accent light  #FF6A2B (spec)': '#FF6A2B',
    'onAccent      #111827 (ink)': '#111827',
    'onAccent      #FFFFFF (current)': '#FFFFFF',
    'textTertiary  #6B7280': '#6B7280',
    'textTertiary  #707A8C': '#707A8C',
    'textTertiary  #98A2B3 (current)': '#98A2B3',
    'textSecondary #5B6472': '#5B6472',
    'textSecondary #667085 (current)': '#667085',
}

print('\n--- accent as TEXT on surfaces (needs 4.5 for body) ---')
for name, value in candidates.items():
    if 'accent' not in name:
        continue
    print(f'{name:>36} on surface {ratio(value, LIGHT["surface"]):5.2f}'
          f'  on bg {ratio(value, LIGHT["bg"]):5.2f}'
          f'  on accentSoft {ratio(value, LIGHT["accentSoft"]):5.2f}')

print('\n--- accent as a BUTTON FILL: label colour on it ---')
for accent_name, accent in (('#E85B22 (current)', '#E85B22'), ('#FF6A2B (spec)', '#FF6A2B'),
                             ('#C2410C', '#C2410C'), ('#B8430F', '#B8430F')):
    for label_name, label in (('#FFFFFF', '#FFFFFF'), ('#111827', '#111827')):
        r = ratio(label, accent)
        print(f'  {label_name} on {accent_name:>20} = {r:5.2f}  '
              f'{"PASS" if r >= 4.5 else "fail"}')

print('\n--- tertiary text (captions/placeholders) ---')
for name, value in candidates.items():
    if 'textTertiary' not in name:
        continue
    print(f'{name:>36} on surface {ratio(value, LIGHT["surface"]):5.2f}'
          f'  on bg {ratio(value, LIGHT["bg"]):5.2f}'
          f'  on surfaceAlt {ratio(value, LIGHT["surfaceAlt"]):5.2f}')

print('\n--- secondary text ---')
for name, value in candidates.items():
    if 'textSecondary' not in name:
        continue
    print(f'{name:>36} on surface {ratio(value, LIGHT["surface"]):5.2f}'
          f'  on surfaceAlt {ratio(value, LIGHT["surfaceAlt"]):5.2f}')

print('\n--- dark: tertiary 35% white on the dark page/surface ---')
for alpha in (0.35, 0.45, 0.55, 0.62):
    blended = blend(f'#FFFFFF', DARK['bg'], alpha)
    print(f'  white {int(alpha * 100):>3}% -> {blended}  on bg {ratio(blended, DARK["bg"]):5.2f}'
          f'  on surface {ratio(blended, DARK["surface"]):5.2f}')

print('\n--- dark: onAccent on the dark accent ---')
for label in ('#FFFFFF', '#1A0E05'):
    print(f'  {label} on #FF6A2B = {ratio(label, "#FF6A2B"):5.2f}')

print('\n\n=== PROPOSED PALETTE (all pairs must reach 4.5 for body text) ===')
print('\n--- dark accent candidates: white label must pass on the fill ---')
for value in ('#FF6A2B', '#F2611F', '#E85B22', '#DC551C', '#D6500D', '#CE4A08', '#C2410C'):
    print(f'  {value}: white on it {ratio("#FFFFFF", value):5.2f} | '
          f'as text on bg {ratio(value, "#0B0B0C"):5.2f} | '
          f'on surface {ratio(value, "#161618"):5.2f}')

print('\n--- light textTertiary candidates ---')
for value in ('#98A2B3', '#6B7280', '#656E7E', '#616A7A', '#5F6777'):
    print(f'  {value}: surface {ratio(value, "#FFFFFF"):5.2f} | '
          f'bg {ratio(value, "#F6F7FB"):5.2f} | '
          f'surfaceAlt {ratio(value, "#EEF1F6"):5.2f} | '
          f'accentSoft {ratio(value, "#FFF0E8"):5.2f}')

proposed_light = {
    'bg': '#F6F7FB', 'surface': '#FFFFFF', 'surfaceAlt': '#EEF1F6',
    'surfaceMuted': '#E5E9F0',
    'textPrimary': '#111827', 'textSecondary': '#5B6472', 'textTertiary': '#616A7A',
    'accent': '#C2410C', 'accentSoft': '#FFF0E8', 'onAccent': '#FFFFFF',
    'success': '#0F6B46', 'successSoft': '#E8F7F0',
    'warning': '#8A5200', 'warningSoft': '#FFF5D9',
    'danger': '#B42318', 'dangerSoft': '#FDECEC',
}
proposed_dark = {
    'bg': '#0B0B0C', 'surface': '#161618', 'surfaceAlt': '#1C1C20',
    'surfaceMuted': '#141416',
    'textPrimary': '#F5F5F4', 'textSecondary': '#A8A29E', 'textTertiary': '#919192',
    'accent': '#F2611F', 'accentSoft': 'rgba(255,106,43,0.14)', 'onAccent': '#FFFFFF',
    'success': '#3DD68C', 'warning': '#F5B83D', 'danger': '#FF5C5C',
}

print('\n--- light: every critical pair ---')
report(
    'proposed light',
    [
        (proposed_light['onAccent'], proposed_light['accent'], 'button label on the orange fill'),
        (proposed_light['accent'], proposed_light['surface'], 'accent text/icon on a card'),
        (proposed_light['accent'], proposed_light['bg'], 'accent text/icon on the page'),
        (proposed_light['accent'], proposed_light['accentSoft'], 'accent text on a soft badge'),
        (proposed_light['textTertiary'], proposed_light['surface'], 'caption / placeholder'),
        (proposed_light['textTertiary'], proposed_light['bg'], 'caption on the page'),
        (proposed_light['textSecondary'], proposed_light['surface'], 'body text on a card'),
        (proposed_light['textSecondary'], proposed_light['surfaceAlt'], 'body text on a tinted well'),
        (proposed_light['success'], proposed_light['successSoft'], 'success on a soft badge'),
        (proposed_light['warning'], proposed_light['warningSoft'], 'warning on a soft badge'),
        (proposed_light['danger'], proposed_light['dangerSoft'], 'danger on a soft badge'),
        (proposed_light['textPrimary'], proposed_light['surface'], 'title on a card'),
    ],
)

print('\n--- dark: every critical pair ---')
report(
    'proposed dark',
    [
        (proposed_dark['onAccent'], proposed_dark['accent'], 'button label on the orange fill'),
        (proposed_dark['accent'], proposed_dark['surface'], 'accent text/icon on a card'),
        (proposed_dark['accent'], proposed_dark['bg'], 'accent text/icon on the page'),
        (proposed_dark['textTertiary'], proposed_dark['bg'], 'caption on the page'),
        (proposed_dark['textTertiary'], proposed_dark['surface'], 'caption on a card'),
        (proposed_dark['textSecondary'], proposed_dark['surface'], 'body text on a card'),
        (proposed_dark['textSecondary'], proposed_dark['bg'], 'body text on the page'),
        (proposed_dark['success'], proposed_dark['surface'], 'success text'),
        (proposed_dark['warning'], proposed_dark['surface'], 'warning text'),
        (proposed_dark['danger'], proposed_dark['surface'], 'danger text'),
        (proposed_dark['textPrimary'], proposed_dark['surface'], 'title on a card'),
    ],
)
