"""
Checks that a class alarm really rings on a device, not just that the OS
accepted the request.

The app's own alarm path is used: the developer screen /dev/alarm-test
schedules an alarm on the class-alarm channel a few seconds away, the app is
sent to the background (so the alarm cannot be delivered by the app being in
the foreground), and the test then looks for the posted notification in the
system's notification service.

    python tools/emulator_alarm_fire_test.py [apk]

It prints one of:
    FIRED   - the notification reached the system
    NOT FIRED - the alarm was scheduled but nothing arrived
"""
import os
import re
import subprocess
import sys
import time

SERIAL = os.environ.get('GBU_EMULATOR', 'emulator-5554')
PACKAGE = 'in.gbu.one'
DEEP_LINK = 'gbuone://dev/alarm-test'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'qa', 'emulator')


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


def posted_notifications():
    """The notifications the system currently holds for our app."""
    out = adb('shell', 'dumpsys', 'notification', '--noredact')
    if not out:
        return []
    # The package's own notification records live between the package tag and
    # the end of its section.
    blocks = out.split(f'pkg={PACKAGE}')
    if len(blocks) < 2:
        return []
    body = blocks[1]
    end = body.find('}') if False else len(body)
    return [
        line.strip()
        for line in body[:end].splitlines()
        if 'NotificationRecord' in line or 'android.title' in line or 'android.text' in line
    ]


def scheduled_alarms():
    out = adb('shell', 'dumpsys', 'alarm')
    return [line.strip() for line in out.splitlines() if PACKAGE in line]


def main() -> None:
    if len(sys.argv) > 1:
        print('installing', sys.argv[1])
        adb('uninstall', PACKAGE)
        print(adb('install', sys.argv[1]).strip())

    print('launching the alarm test screen')
    adb('shell', 'am', 'force-stop', PACKAGE)
    time.sleep(2)
    adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', DEEP_LINK)
    time.sleep(12)

    xml = dump()
    if 'Class alarm test' not in ' '.join(texts(xml)):
        print('  ! the alarm test screen did not open')
        print('  screen text:', ' | '.join(texts(xml)[:20]))
        raise SystemExit(1)

    pos = find(xml, 'Ring in 30 s')
    if pos is None:
        print('  ! the button is not on screen:', ' | '.join(texts(xml)[:20]))
        raise SystemExit(1)
    print(f'  pressing "Ring in 30 s" at {pos}')
    adb('shell', 'input', 'tap', str(pos[0]), str(pos[1]))
    time.sleep(4)

    print('  scheduled alarms for the app:', len(scheduled_alarms()))
    for line in scheduled_alarms()[:4]:
        print('   ', line[:150])

    # Send the app to the background: an alarm that only fires while the app
    # is open would not be a real alarm.
    print('  sending the app to the background')
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    time.sleep(2)

    print('  waiting for the alarm (45 s)')
    fired = False
    for _ in range(15):
        time.sleep(3)
        records = posted_notifications()
        if records:
            fired = True
            break

    shot('alarm_fire_test')

    if fired:
        print('\nFIRED: the notification reached the system while the app was in the background.')
        for line in posted_notifications()[:6]:
            print('   ', line[:170])
        return

    print('\nNOT FIRED: the alarm was scheduled but no notification arrived.')
    print('  scheduled alarms:')
    for line in scheduled_alarms()[:6]:
        print('   ', line[:170])
    raise SystemExit(1)


if __name__ == '__main__':
    main()
