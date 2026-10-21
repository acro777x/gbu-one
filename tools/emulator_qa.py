"""
Drive the GBU One app on the emulator for a QA pass.

    python tools/emulator_qa.py [--apk <path>] [--fresh] [--shots <dir>]

Runs a scripted walk-through (onboarding -> class setup -> home -> every tab
-> notice detail -> PYQ upload sheet -> moderation queue) and saves a
screenshot of each step.
"""
import os
import subprocess
import sys
import time

SERIAL = os.environ.get('GBU_EMULATOR', 'emulator-5554')
PACKAGE = 'in.gbu.one'


def adb(*args, **kwargs):
    return subprocess.run(
        ['adb', '-s', SERIAL, *args],
        capture_output=True, text=True, **kwargs,
    )


def tap(x, y, settle=1.2):
    adb('shell', 'input', 'tap', str(x), str(y))
    time.sleep(settle)


def swipe(x1, y1, x2, y2, ms=400, settle=1.5):
    adb('shell', 'input', 'swipe', str(x1), str(y1), str(x2), str(y2), str(ms))
    time.sleep(settle)


def dump():
    adb('shell', 'uiautomator', 'dump', '/sdcard/qa.xml')
    adb('pull', '/sdcard/qa.xml', os.environ.get('GBU_DUMP', 'qa_ui.xml'))
    path = os.environ.get('GBU_DUMP', 'qa_ui.xml')
    try:
        with open(path, encoding='utf-8') as f:
            return f.read()
    except OSError:
        return ''


def texts(xml):
    import re
    return [m.group(1) for m in re.finditer(r'text="([^"]+)"', xml)]


def find(xml, label, exact=False):
    """Returns the centre of the node with the given text, or None."""
    import re
    for m in re.finditer(
        r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml
    ):
        text = m.group(1)
        hit = text == label if exact else label in text
        if hit:
            x1, y1, x2, y2 = (int(m.group(i)) for i in range(2, 6))
            return ((x1 + x2) // 2, (y1 + y2) // 2)
    return None


def tap_text(label, exact=False, settle=1.5, required=True):
    xml = dump()
    pos = find(xml, label, exact)
    if pos is None:
        if required:
            print(f'  ! not found: {label}')
        return False
    tap(pos[0], pos[1], settle)
    return True


def shot(out_dir, name):
    """Captures a settled screenshot.

    `screencap` can return a frame while SurfaceFlinger still holds an older
    layer, which shows up as a stray shape over the screen. Waiting for the
    screen to be idle and capturing a few times keeps only a settled frame.
    """
    os.makedirs(out_dir, exist_ok=True)
    target = os.path.join(out_dir, f'{name}.png')
    time.sleep(1.5)
    for _ in range(3):
        adb('shell', 'screencap', '-p', '/sdcard/qa_tmp.png')
        time.sleep(0.7)
        adb('pull', '/sdcard/qa_tmp.png', target)
    return target


def dismiss_16kb_dialog():
    """Android 15+ shows a 16 KB page-size notice; dismiss it once."""
    xml = dump()
    pos = find(xml, "Don't Show Again")
    if pos:
        tap(pos[0], pos[1], settle=2.5)
        adb('shell', 'am', 'force-stop', PACKAGE)
        time.sleep(1)
        adb('shell', 'monkey', '-p', PACKAGE, '-c',
            'android.intent.category.LAUNCHER', '1')
        time.sleep(12)
        return True
    return False


def allow_notifications():
    """Answers the Android notification prompt the onboarding asks for."""
    xml = dump()
    pos = find(xml, 'Allow', exact=True)
    if pos:
        tap(pos[0], pos[1], settle=3.0)
        return True
    return False


def main():
    args = sys.argv[1:]
    shots = 'docs/qa/emulator'
    apk = None
    if '--apk' in args:
        apk = args[args.index('--apk') + 1]
    if '--shots' in args:
        shots = args[args.index('--shots') + 1]
    fresh = '--fresh' in args

    if apk:
        print('installing', apk)
        adb('uninstall', PACKAGE)
        print(adb('install', apk).stdout.strip())
    if fresh:
        adb('shell', 'pm', 'clear', PACKAGE)

    print('launching')
    adb('shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1')
    time.sleep(14)
    dismiss_16kb_dialog()

    steps = []

    # Onboarding: three welcome slides, then the class setup screen.
    for _ in range(2):
        tap_text('Next', exact=True, settle=1.5, required=False)
    tap_text('Get started', exact=True, settle=2.5, required=False)
    steps.append(('onboarding_class_setup', shot(shots, 'onboarding_class_setup')))

    # Class setup: pick a class so the app has a section.
    tap_text('B.Tech (CS)', settle=1.5, required=False)
    tap_text('2nd Year', settle=1.5, required=False)
    tap_text('B', exact=True, settle=1.0, required=False)
    shot(shots, 'class_setup_filled')
    tap_text('Confirm', exact=True, settle=6.0, required=False)
    tap_text('Get started', exact=True, settle=6.0, required=False)
    allow_notifications()
    steps.append(('home', shot(shots, 'home')))


    for label, name in (
        ('Timetable', 'tab_timetable'),
        ('Notices', 'tab_notices'),
        ('PYQ', 'tab_pyq'),
        ('Profile', 'tab_profile'),
    ):
        tap_text(label, exact=True, settle=3.5, required=False)
        steps.append((name, shot(shots, name)))

    # Notice detail with the extracted document text.
    tap_text('Notices', exact=True, settle=3.5, required=False)
    tap_text('Revised Mid-Semester Exam Datesheet', settle=3.5, required=False)
    steps.append(('notice_detail', shot(shots, 'notice_detail')))
    adb('shell', 'input', 'keyevent', '4')
    time.sleep(2)

    # PYQ upload sheet.
    tap_text('PYQ', exact=True, settle=3.5, required=False)
    tap_text('Upload', exact=True, settle=2.5, required=False)
    steps.append(('pyq_upload_sheet', shot(shots, 'pyq_upload_sheet')))
    adb('shell', 'input', 'keyevent', '4')
    time.sleep(2)

    # The moderation queue (owner / moderator only) and the notification
    # preferences, both of which sit further down the profile.
    tap_text('Profile', exact=True, settle=3.5, required=False)
    for _ in range(3):
        swipe(540, 1700, 540, 700, 400)
    shot(shots, 'profile_preferences')
    tap_text('PYQ Moderation Queue', settle=3.5, required=False)
    steps.append(('moderation_queue', shot(shots, 'moderation_queue')))

    print('\n'.join(f'{n}' for n, _ in steps if n))


if __name__ == '__main__':
    main()
