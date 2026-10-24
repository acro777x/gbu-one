"""
Captures screenshots from the GBU One emulator and analyzes the UI.

Usage:
    python tools/check_ui.py [--apk path/to/app-debug.apk]
"""

import os
import re
import subprocess
import sys
import time
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / 'docs' / 'qa'
EMULATOR_SERIAL = os.environ.get('GBU_EMULATOR', 'emulator-5554')
PACKAGE = 'in.gbu.one'


def adb(*args):
    return subprocess.run(['adb', '-s', EMULATOR_SERIAL, *args],
                          capture_output=True, text=True).stdout


def dump():
    adb('shell', 'uiautomator', 'dump', '/sdcard/qa.xml')
    adb('pull', '/sdcard/qa.xml', str(OUT / 'qa.xml'))
    try:
        with open(OUT / 'qa.xml', encoding='utf-8', errors='replace') as f:
            return f.read()
    except OSError:
        return ''


def texts(xml):
    return [m.group(1) for m in re.finditer(r'text="([^"]+)"', xml)]


def find(xml, label, exact=False):
    pattern = r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
    for m in re.finditer(pattern, xml):
        hit = m.group(1) == label if exact else label in m.group(1)
        if hit:
            x1, y1, x2, y2 = (int(m.group(i)) for i in range(2, 6))
            return ((x1 + x2) // 2, (y1 + y2) // 2)
    return None


def shot(name):
    OUT.mkdir(parents=True, exist_ok=True)
    adb('shell', 'screencap', '-p', '/sdcard/qa.png')
    adb('pull', '/sdcard/qa.png', str(OUT / f'{name}.png'))


def tap(x, y, settle=2.5):
    adb('shell', 'input', 'tap', str(x), str(y))
    time.sleep(settle)


def tap_text(label, exact=False, settle=3.0):
    xml = dump()
    pos = find(xml, label, exact=exact)
    if not pos:
        print(f'  ! could not find text: "{label}"')
        return False
    x, y = pos
    print(f'  tapping "{label}" at ({x}, {y})')
    tap(x, y, settle)
    return True


def main():
    apk = None
    if len(sys.argv) > 1 and sys.argv[1] == '--apk':
        apk = sys.argv[2]
        if apk:
            print(f'installing {apk}')
            adb('uninstall', PACKAGE)
            print(adb('install', apk).strip())
        else:
            print('!! --apk path required')
            sys.exit(1)

    print('launching app')
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1')
    time.sleep(20)

    # Dismiss "Don't Show Again" dialog
    if tap_text("Don't Show Again"):
        time.sleep(3)

    # Home screen
    shot('home')

    # Timetable
    if tap_text('Timetable', exact=True):
        time.sleep(6)
        shot('timetable')

    # Notices
    if tap_text('Notices', exact=True):
        time.sleep(6)
        shot('notices')

    # PYQ
    if tap_text('PYQ', exact=True):
        time.sleep(6)
        shot('pyq')

    # Events
    if tap_text('Events', exact=True):
        time.sleep(6)
        shot('events')

    # Profile
    if tap_text('Profile', exact=True):
        time.sleep(6)
        shot('profile')

    print('\nDone. Screenshots in:', OUT)


if __name__ == '__main__':
    main()

# Fast QA snapshot + analysis for GBU One
