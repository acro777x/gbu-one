"""Taps the home quick actions and reports which screens open."""
import re
import subprocess
import time

S = 'emulator-5554'


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


def find(xml, label, exact=True):
    pat = r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
    for m in re.finditer(pat, xml):
        hit = m.group(1) == label if exact else label in m.group(1)
        if hit:
            x1, y1, x2, y2 = (int(m.group(i)) for i in range(2, 6))
            return ((x1 + x2) // 2, (y1 + y2) // 2)
    return None


adb('shell', 'am', 'force-stop', 'in.gbu.one')
time.sleep(1)
adb('shell', 'am', 'start', '-n', 'in.gbu.one/.MainActivity')
time.sleep(16)

for label in ['GBU Mail', 'Schedule', 'Exam Hub', 'Calendar', 'View details']:
    xml = dump()
    pos = find(xml, label, exact=False)
    if pos is None:
        print(f'  ! not on the screen: {label}')
        continue
    before = ' | '.join(texts(xml)[:4])
    adb('shell', 'input', 'tap', str(pos[0]), str(pos[1]))
    time.sleep(5)
    after = texts(dump())
    print(f'  {label:14} -> {" | ".join(after[:6])[:100]}')
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
    time.sleep(2)
