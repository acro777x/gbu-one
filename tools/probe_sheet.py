"""Taps a label and reports what the screen shows, with a screenshot."""
import io
import os
import re
import subprocess
import sys
import time

S = os.environ.get('GBU_SERIAL', 'emulator-5554')
OUT = 'docs/qa/emulator'


def adb(*a):
    return subprocess.run(['adb', '-s', S, *a], capture_output=True, text=True).stdout


def dump():
    adb('shell', 'uiautomator', 'dump', '/sdcard/qa.xml')
    adb('pull', '/sdcard/qa.xml', 'qa_ui.xml')
    try:
        with open('qa_ui.xml', encoding='utf-8', errors='replace') as f:
            return f.read()
    except OSError:
        return ''


def texts(xml):
    return [m.group(1) for m in re.finditer(r'text="([^"]+)"', xml)]


def find(xml, label, exact=False):
    pat = r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
    for m in re.finditer(pat, xml):
        hit = m.group(1) == label if exact else label in m.group(1)
        if hit:
            x1, y1, x2, y2 = (int(m.group(i)) for i in range(2, 6))
            return ((x1 + x2) // 2, (y1 + y2) // 2)
    return None


def shot(name):
    os.makedirs(OUT, exist_ok=True)
    adb('shell', 'screencap', '-p', '/sdcard/qa.png')
    adb('pull', '/sdcard/qa.png', f'{OUT}/{name}.png')


xml = dump()
print('screen:', ' | '.join(texts(xml)[:10]))

for label in sys.argv[1:]:
    pos = find(dump(), label, exact=False)
    if pos is None:
        print(f'  ! not found: {label}')
        continue
    print(f'  tap {label} at {pos}')
    adb('shell', 'input', 'tap', str(pos[0]), str(pos[1]))
    time.sleep(5)

xml = dump()
print('now:', ' | '.join(texts(xml)[:26]))
shot('probe_sheet')
