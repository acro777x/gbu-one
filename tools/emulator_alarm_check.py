"""
Checks the class alarm end to end on a device: pick a future day, open a
class, choose a lead time, press the set button and confirm that the OS
registered an alarm for the app.

    python tools/emulator_alarm_check.py [apk]

The sheet is drawn inside the screen, so the uiautomator dump can see it.
"""
import os
import re
import subprocess
import sys
import time

SERIAL = os.environ.get('GBU_EMULATOR', 'emulator-5554')
PACKAGE = 'in.gbu.one'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'qa', 'emulator')
DUMP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'qa_ui.xml')

# The lead-time chips and the set button, in device pixels, for the class
# sheet. They move with the sheet, so they are re-read from the screen when
# a chip is picked.
CHIP_LABEL = '1 hour before'


def adb(*args):
    return subprocess.run(['adb', '-s', SERIAL, *args], capture_output=True, text=True).stdout


def dump():
    adb('shell', 'uiautomator', 'dump', '/sdcard/qa.xml')
    adb('pull', '/sdcard/qa.xml', DUMP)
    try:
        with open(DUMP, encoding='utf-8', errors='replace') as f:
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
    adb('pull', '/sdcard/qa.png', os.path.join(OUT, f'{name}.png'))


def tap(x, y, settle=2.5):
    adb('shell', 'input', 'tap', str(x), str(y))
    time.sleep(settle)


def alarms():
    out = adb('shell', 'dumpsys', 'alarm')
    return [ln.strip() for ln in out.splitlines() if PACKAGE in ln]


def main():
    if len(sys.argv) > 1:
        print('installing', sys.argv[1])
        adb('uninstall', PACKAGE)
        print(adb('install', sys.argv[1]).strip())

    print('launch')
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1')
    time.sleep(20)
    pos = find(dump(), "Don't Show Again")
    if pos:
        tap(pos[0], pos[1], 3)

    print('timetable')
    pos = find(dump(), 'Timetable', exact=True)
    if pos:
        tap(pos[0], pos[1], 8)

    print('a future day')
    pos = find(dump(), 'Thu', exact=True)
    if not pos:
        print('  ! no day strip')
        return
    tap(pos[0], pos[1], 4)

    print('open a class')
    xml = dump()
    m = re.search(
        r'text="([A-Z]{2,4}\d{3}[^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml
    )
    if not m:
        print('  ! no class on screen:', ' | '.join(texts(xml)[:20]))
        return
    tap((int(m.group(2)) + int(m.group(4))) // 2, (int(m.group(3)) + int(m.group(5))) // 2, 4)

    print(f'pick "{CHIP_LABEL}"')
    pos = find(dump(), CHIP_LABEL, exact=True)
    if not pos:
        print('  ! the lead-time chip is not on screen')
        return
    tap(pos[0], pos[1], 2)

    xml = dump()
    chosen = ' '.join(t for t in texts(xml) if 'before' in t or 'At start' in t)
    print('  chips now:', chosen[:120])
    shot('alarm_sheet')

    print('press the set button')
    pos = find(dump(), 'Set alarm')
    if not pos:
        print('  ! the set button is not on screen')
        return
    tap(pos[0], pos[1], 4)

    found = alarms()
    print('\nOS alarms for the app:', len(found))
    for line in found[:6]:
        print('   ', line[:170])
    if not found:
        print('  ! no alarm was registered')
        raise SystemExit(1)

    xml = dump()
    marked = [t for t in texts(xml) if 'Alarm set' in t or 'Cancel' in t]
    print('\nsheet state:', ' | '.join(marked[:4]) or ' | '.join(texts(xml)[:12]))
    shot('alarm_scheduled')
    print('\nOK: the alarm reached the OS')


if __name__ == '__main__':
    main()
