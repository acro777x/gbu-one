"""
Walks the app from onboarding to the timetable and checks that the class the
student picked actually loads their schedule.

    python tools/emulator_class_flow.py [apk]

It reports the class code that was stored and the slots that came back, so a
regression in the class mapping shows up as "0 slots".
"""
import os
import re
import subprocess
import sys
import time

SERIAL = os.environ.get('GBU_EMULATOR', 'emulator-5554')
PACKAGE = 'in.gbu.one'
DUMP = os.path.join(os.path.dirname(__file__), '..', 'qa_ui.xml')


def adb(*args):
    return subprocess.run(
        ['adb', '-s', SERIAL, *args], capture_output=True, text=True,
    )


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


def tap_text(label, exact=False, settle=1.4, required=True):
    xml = dump()
    pos = find(xml, label, exact)
    if pos is None:
        if required:
            print(f'  ! not found: {label}')
        return False
    adb('shell', 'input', 'tap', str(pos[0]), str(pos[1]))
    time.sleep(settle)
    return True


def shot(name):
    out = os.path.join(os.path.dirname(__file__), '..', 'docs', 'qa', 'emulator')
    os.makedirs(out, exist_ok=True)
    adb('shell', 'screencap', '-p', '/sdcard/qa.png')
    adb('pull', '/sdcard/qa.png', os.path.join(out, f'{name}.png'))


def answer_permission_prompt():
    """Answers the Android notification prompt if it is on screen."""
    xml = dump()
    pos = find(xml, 'Allow', exact=True)
    if pos:
        print('answering the notification prompt')
        adb('shell', 'input', 'tap', str(pos[0]), str(pos[1]))
        time.sleep(4)
        return True
    return False


def main():
    if len(sys.argv) > 1:
        print('installing', sys.argv[1])
        adb('uninstall', PACKAGE)
        print(adb('install', sys.argv[1]).stdout.strip())

    print('launching')
    adb('shell', 'pm', 'clear', PACKAGE)
    adb('shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1')
    time.sleep(15)

    # The Android 16 KB compatibility notice, once.
    xml = dump()
    pos = find(xml, "Don't Show Again")
    if pos:
        print('dismissing the 16 KB notice')
        adb('shell', 'input', 'tap', str(pos[0]), str(pos[1]))
        time.sleep(3)
        adb('shell', 'am', 'force-stop', PACKAGE)
        time.sleep(1)
        adb('shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1')
        time.sleep(14)

    print('onboarding: skipping the slides')
    for _ in range(2):
        tap_text('Next', exact=True, settle=1.4, required=False)
    tap_text('Get started', exact=True, settle=3.0, required=False)

    # The notification prompt can appear right after onboarding.
    answer_permission_prompt()

    print('class setup')
    # The live class list loads over the network; give it a moment.
    for _ in range(6):
        xml = dump()
        if 'Loading classes' not in ' '.join(texts(xml)):
            break
        time.sleep(3)
    shot('class_setup_step1')
    tap_text('SOICT', exact=True, settle=1.2, required=False)
    tap_text('Continue to Programme', settle=2.0, required=False)
    shot('class_setup_step2')
    tap_text('B.Tech (CS)', exact=True, settle=1.6, required=False)
    tap_text('Continue to Year', settle=2.0, required=False)
    shot('class_setup_step3')
    tap_text('2nd Year', settle=1.6, required=False)
    tap_text('Continue to Section', settle=2.0, required=False)
    shot('class_setup_step4')
    tap_text('B', exact=True, settle=1.4, required=False)
    shot('class_setup_filled')

    xml = dump()
    print('class code shown:', [t for t in texts(xml) if t.startswith('BCS-')])

    tap_text('Complete Setup', settle=6.0, required=False)
    tap_text('Get started', exact=True, settle=6.0, required=False)
    answer_permission_prompt()

    print('timetable')
    tap_text('Timetable', exact=True, settle=7.0, required=False)
    shot('timetable_loaded')

    xml = dump()
    visible = texts(xml)
    slots = [t for t in visible if re.match(r'^[A-Z]{2,4}\d{3}', t)]
    print('subject codes on the timetable screen:', slots[:12])
    print('screen text sample:', ' | '.join(visible[:40]))

    # The class detail sheet carries the alarm controls.
    xml = dump()
    match = re.search(
        r'text="(Scientific Computing with Python Lab|Data Structures Lab)"'
        r'[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
        xml,
    )
    if match:
        cx = (int(match.group(2)) + int(match.group(4))) // 2
        cy = (int(match.group(3)) + int(match.group(5))) // 2
        print(f'opening the class sheet at {cx},{cy}')
        adb('shell', 'input', 'tap', str(cx), str(cy))
        time.sleep(5)
        shot('class_sheet')
        xml = dump()
        sheet = texts(xml)
        print('sheet text:', ' | '.join(sheet[:40]))
    else:
        print('could not find a class card to open')


if __name__ == '__main__':
    main()
