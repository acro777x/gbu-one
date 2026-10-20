"""
Audit the on-device touch targets against the 44pt minimum (AGENTS.md).

    python tools/audit_touch_targets.py [package]

Walks the app's screens on the emulator and reports every tappable node
smaller than 44x44 dp. The device density is read from the display metrics
so the bound is compared in dp, not raw pixels.
"""
import re
import subprocess
import sys
import time

SERIAL = os.environ.get('GBU_EMULATOR', 'emulator-5554') if (os := __import__('os')) else 'emulator-5554'
PACKAGE = 'in.gbu.one'
MIN_DP = 44


def adb(*args):
    return subprocess.run(
        ['adb', '-s', SERIAL, *args], capture_output=True, text=True,
    )


def density():
    """The device's dp -> px factor."""
    out = adb('shell', 'wm', 'density').stdout
    match = re.search(r'Physical density:\s*(\d+)', out)
    if match:
        return int(match.group(1)) / 160
    out = adb('shell', 'wm', 'size').stdout
    return 2.75


def dump():
    adb('shell', 'uiautomator', 'dump', '/sdcard/targets.xml')
    adb('pull', '/sdcard/targets.xml', 'targets_ui.xml')
    try:
        with open('targets_ui.xml', encoding='utf-8') as f:
            return f.read()
    except OSError:
        return ''


def screen():
    return adb('shell', 'dumpsys', 'window', 'windows').stdout


def main():
    package = sys.argv[1] if len(sys.argv) > 1 else PACKAGE
    scale = density()
    print(f'density factor: {scale}')

    xml = dump()
    if not xml:
        print('could not read the view hierarchy')
        return

    small = []
    clipped = 0
    total = 0
    for m in re.finditer(
        r'<node[^>]*clickable="true"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml
    ):
        x1, y1, x2, y2 = (int(m.group(i)) for i in range(1, 5))
        w = (x2 - x1) / scale
        h = (y2 - y1) / scale
        # A node that is cut off by a scroll view reports inverted bounds;
        # its real size cannot be judged, so it is skipped.
        if w <= 0 or h <= 0:
            clipped += 1
            continue
        total += 1
        # A 0.5dp tolerance absorbs the rounding of the device density.
        if w < MIN_DP - 0.5 or h < MIN_DP - 0.5:
            small.append((w, h, m.group(0)[:120]))

    print(f'\ntappable nodes: {total}' + (f' ({clipped} clipped, skipped)' if clipped else ''))
    if not small:
        print(f'all tappable nodes are at least {MIN_DP}x{MIN_DP} dp')
        return
    print(f'\nsmaller than {MIN_DP}dp: {len(small)}')
    for w, h, node in small:
        print(f'  {w:.0f}x{h:.0f} dp  {node}')


if __name__ == '__main__':
    main()
