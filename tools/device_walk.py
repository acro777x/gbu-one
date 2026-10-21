"""Drives a phone or emulator through a short UI path and captures what happens."""
import os
import re
import subprocess
import sys
import time

SERIAL = os.environ.get('GBU_SERIAL', '145983157H030860')
PACKAGE = 'in.gbu.one'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'qa', 'techno')


def adb(*args):
    return subprocess.run(['adb', '-s', SERIAL, *args], capture_output=True, text=True).stdout


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
    adb('pull', '/sdcard/qa.png', os.path.join(OUT, f'{name}.png'))


def tap(label, exact=False, settle=2.5, required=False):
    pos = find(dump(), label, exact)
    if pos is None:
        print(f'  ! not found: {label}')
        if required:
            raise SystemExit(1)
        return False
    print(f'  tap {label} at {pos}')
    adb('shell', 'input', 'tap', str(pos[0]), str(pos[1]))
    time.sleep(settle)
    return True


def main():
    print('launch')
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1')
    time.sleep(14)

    xml = dump()
    print('  screen:', ' | '.join(texts(xml)[:14]))

    for step in sys.argv[1:]:
        print(f'step: {step}')
        if ':' in step:
            label, exact = step.split(':')
            tap(label, exact=(exact == 'exact'))
        else:
            tap(step)
        shot(f'step_{step.replace(":", "_")}')
        print('  now:', ' | '.join(texts(dump())[:16]))


if __name__ == '__main__':
    main()
