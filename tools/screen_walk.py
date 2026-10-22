"""Walks every screen in the app and reports which ones do not open."""
import re
import subprocess
import sys
import time

S = 'emulator-5554'
PKG = 'in.gbu.one'
SCHEME = 'gbuone'

ROUTES = [
    ('(tabs)', 'home'),
    ('exams', 'exams'),
    ('calendar', 'calendar'),
    ('mail', 'mail'),
    ('about', 'about'),
    ('login', 'login'),
    ('class-setup', 'class-setup'),
    ('moderation', 'moderation'),
    ('goal', 'goal'),
    ('boost', 'boost'),
    ('teamwork-preview', 'teamwork-preview'),
    ('onboarding', 'onboarding'),
    ('notice/1', 'notice'),
    ('pdf?url=https%3A%2F%2Fwww.gbu.ac.in%2Fpage%2Fnotices&title=Test', 'pdf'),
]


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


def focus():
    out = adb('shell', 'dumpsys', 'window')
    m = re.search(r'mCurrentFocus=Window\{[^}]*\s(u0\s+)?(\S+)\}', out)
    return m.group(2) if m else '?'


for route, name in ROUTES:
    url = f'{SCHEME}://{route}' if route.startswith('(') else f'{SCHEME}://{route}'
    if '/' in route and '?' not in route:
        url = f'{SCHEME}://{route}'
    adb('shell', 'am', 'force-stop', PKG)
    time.sleep(1)
    adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url)
    time.sleep(9)
    xml = dump()
    shown = texts(xml)
    ok = len(shown) > 3
    head = ' | '.join(shown[:6])[:110]
    print(f'{"OK  " if ok else "FAIL"} {name:12} {head}')
