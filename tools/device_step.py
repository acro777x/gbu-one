"""Dismisses the 16 KB dialog (exactly matching the button) and opens a tab."""
import re
import subprocess
import sys
import time

S = 'emulator-5554'


def adb(*args):
    return subprocess.run(['adb', '-s', S, *args], capture_output=True, text=True).stdout


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


pos = find(dump(), "Don't Show Again", exact=True)
if pos:
    print('dismissing the 16 KB dialog at', pos)
    adb('shell', 'input', 'tap', str(pos[0]), str(pos[1]))
    time.sleep(3)
else:
    print('no 16 KB dialog')

for label in sys.argv[1:]:
    time.sleep(1)
    pos = find(dump(), label, exact=True)
    if not pos:
        print('  ! not found:', label)
        continue
    print('  tap', label, pos)
    adb('shell', 'input', 'tap', str(pos[0]), str(pos[1]))
    time.sleep(3)

print('screen:', ' | '.join(texts(dump())[:24]))
