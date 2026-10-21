"""
Checks whether the app's modals actually reach the screen on Android.

A transparent React Native Modal paints a dim backdrop over the whole window.
If the modal is not composited on top, the mean brightness of the upper part
of the screen stays at the un-dimmed level. This script measures that for the
class detail sheet and the notice sheet and prints the window stack.

    python tools/diagnose_modal.py
"""
import os
import re
import subprocess
import time

from PIL import Image

SERIAL = os.environ.get('GBU_EMULATOR', 'emulator-5554')
PACKAGE = 'in.gbu.one'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'docs', 'qa', 'emulator')
DUMP = os.path.join(HERE, '..', 'qa_ui.xml')


def adb(*args):
    return subprocess.run(['adb', '-s', SERIAL, *args], capture_output=True, text=True)


def dump():
    adb('shell', 'uiautomator', 'dump', '/sdcard/qa.xml')
    adb('pull', '/sdcard/qa.xml', DUMP)
    try:
        with open(DUMP, encoding='utf-8') as f:
            return f.read()
    except OSError:
        return ''


def texts(xml):
    return [m.group(1) for m in re.finditer(r'text="([^"]+)"', xml)]


def find(xml, label, exact=False):
    for m in re.finditer(
        r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml
    ):
        hit = m.group(1) == label if exact else label in m.group(1)
        if hit:
            x1, y1, x2, y2 = (int(m.group(i)) for i in range(2, 6))
            return ((x1 + x2) // 2, (y1 + y2) // 2)
    return None


def tap_text(label, exact=False, settle=2.0, required=False):
    pos = find(dump(), label, exact)
    if pos is None:
        if required:
            print(f'  ! not found: {label}')
        return False
    adb('shell', 'input', 'tap', str(pos[0]), str(pos[1]))
    time.sleep(settle)
    return True


def shot(name):
    os.makedirs(OUT, exist_ok=True)
    adb('shell', 'screencap', '-p', '/sdcard/qa.png')
    path = os.path.join(OUT, f'{name}.png')
    adb('pull', '/sdcard/qa.png', path)
    return path


def upper_brightness(path):
    """Mean brightness of the upper half of the screen."""
    im = Image.open(path).convert('L')
    w, h = im.size
    top = im.crop((0, 0, w, int(h * 0.5)))
    pixels = list(top.getdata())
    return sum(pixels) / len(pixels)


def window_stack():
    out = adb('shell', 'dumpsys', 'window', 'windows').stdout
    rows = []
    for block in out.split('Window #'):
        if PACKAGE in block:
            head = block.splitlines()[0].strip() if block.strip() else ''
            m = re.search(r'Window\{[^}]*\}', block)
            attrs = {
                'name': (re.search(r'mSurface=(.*)', block) or [None, '?'])[1] if 'mSurface=' in block else '?',
                'visible': 'mViewVisibility=0x0' in block or 'isVisible=true' in block,
                'has_drawn': 'HAS_DRAWN' in block,
                'frame': (re.search(r'Frames: parent=(\S+) display=(\S+) mCurrentFocus=(\S+)', block) or [None, '?'])[1]
                if 'Frames:' in block else '?',
            }
            rows.append((m.group(0) if m else head[:60], attrs))
    return rows


def report(label, path):
    b = upper_brightness(path)
    dimmed = b < 180
    print(f'  {label}: upper brightness {b:.0f} -> {"DIMMED (modal on top)" if dimmed else "NOT DIMMED"}')
    return dimmed


def main():
    print('launching')
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1')
    time.sleep(12)

    xml = dump()
    pos = find(xml, "Don't Show Again")
    if pos:
        print('dismissing the 16 KB notice')
        adb('shell', 'input', 'tap', str(pos[0]), str(pos[1]))
        time.sleep(3)

    print('timetable')
    tap_text('Timetable', exact=True, settle=7.0)
    base = shot('modal_baseline')
    report('baseline', base)

    xml = dump()
    m = re.search(
        r'text="(Scientific Computing with Python Lab|Data Structures Lab)"'
        r'[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
        xml,
    )
    if m:
        cx = (int(m.group(2)) + int(m.group(4))) // 2
        cy = (int(m.group(3)) + int(m.group(5))) // 2
        adb('shell', 'input', 'tap', str(cx), str(cy))
        time.sleep(4)
        p = shot('modal_class_sheet')
        report('class sheet', p)
        print('  window stack:')
        for head, attrs in window_stack():
            print('   ', head, attrs)
    else:
        print('  no class card found; screen text:', ' | '.join(texts(xml)[:20]))

    print('notices')
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
    time.sleep(2)
    tap_text('Notices', exact=True, settle=6.0)
    xml = dump()
    titles = [t for t in texts(xml) if len(t) > 25 and not t.startswith('http')]
    if titles:
        pos = find(xml, titles[0], exact=True)
        if pos:
            adb('shell', 'input', 'tap', str(pos[0]), str(pos[1]))
            time.sleep(4)
            p = shot('modal_notice_sheet')
            report('notice sheet', p)
    else:
        print('  no notice card found')


if __name__ == '__main__':
    main()
