"""Walk the app through every screen on the emulator and capture each one.

    python tools/release_walk.py

The app is installed fresh, the walk goes through onboarding, the class
setup, the home screen, every tab and every feature screen, and a
screenshot is saved for each step. The logcat of the app is captured at
the end, so a crash or a red-box is visible in the report.

The script only reads the screen and taps what it finds by its label, so
it never depends on a fixed layout.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import time

SERIAL = os.environ.get("GBU_EMULATOR", "emulator-5554")
PACKAGE = "in.gbu.one"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "qa", "release")


def adb(*args: str) -> str:
    return subprocess.run(
        ["adb", "-s", SERIAL, *args], capture_output=True, text=True, timeout=120
    ).stdout


def dump() -> str:
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    adb("pull", "/sdcard/ui.xml", os.path.join(OUT, "ui.xml"))
    try:
        with open(os.path.join(OUT, "ui.xml"), encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return ""


def labels(xml: str) -> list[str]:
    return [m.group(1) for m in re.finditer(r'text="([^"]+)"', xml) if m.group(1).strip()]


def find(xml: str, label: str) -> tuple[int, int] | None:
    """The centre of the node whose text contains `label`."""
    pattern = r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
    for m in re.finditer(pattern, xml):
        if label.lower() in m.group(1).lower():
            x1, y1, x2, y2 = (int(m.group(i)) for i in range(2, 6))
            return (x1 + x2) // 2, (y1 + y2) // 2
    return None


def tap(x: int, y: int, settle: float = 1.4) -> None:
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(settle)


def tap_label(label: str, settle: float = 1.4) -> bool:
    xml = dump()
    spot = find(xml, label)
    if not spot:
        return False
    tap(spot[0], spot[1], settle)
    return True


def shot(name: str) -> None:
    os.makedirs(OUT, exist_ok=True)
    adb("shell", "screencap", "-p", "/sdcard/shot.png")
    subprocess.run(
        ["adb", "-s", SERIAL, "pull", "/sdcard/shot.png", os.path.join(OUT, name)],
        capture_output=True,
        text=True,
    )
    print(f"  saved {name}")


def step(title: str) -> None:
    print(f"\n--- {title}")
    xml = dump()
    print("  on screen:", " | ".join(labels(xml)[:14]))


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    print("=== GBU One release walk")
    adb("shell", "pm", "clear", PACKAGE)
    adb("shell", "am", "start", "-n", f"{PACKAGE}/.MainActivity")
    time.sleep(14)

    # The 16 KB compatibility dialog is not ours, but it covers the screen.
    xml = dump()
    if "16 KB" in xml or "Compatibility" in xml:
        tap_label("OK")
        time.sleep(2)

    # 1. Onboarding
    step("onboarding")
    shot("01-onboarding.png")
    for _ in range(4):
        if not tap_label("Next"):
            break
        shot("01-onboarding-next.png")
    if tap_label("Skip", 2.0):
        print("  skipped the onboarding")
    time.sleep(2)

    # 2. The class setup
    step("class setup")
    shot("02-class-setup.png")

    # The setup asks for a school and a programme. The first screen that
    # offers a choice is used.
    for label in ("Select", "Choose", "Continue", "Next"):
        if tap_label(label, 1.6):
            step(f"after {label}")
            shot(f"02-class-setup-{label.lower()}.png")
            break

    # 3. Home
    step("home")
    shot("03-home.png")

    # 4. The tabs
    tabs = ["Notices", "Timetable", "PYQ", "Profile"]
    for index, tab in enumerate(tabs, start=4):
        if tap_label(tab, 2.2):
            step(f"tab {tab}")
            shot(f"0{index}-{tab.lower()}.png")

    # 5. The feature screens
    features = [
        ("Exams", "05-exams.png"),
        ("Calendar", "06-calendar.png"),
        ("Mail", "07-mail.png"),
        ("Events", "08-events.png"),
        ("Alarms", "09-alarms.png"),
        ("About", "10-about.png"),
    ]
    for label, name in features:
        if tap_label(label, 2.4):
            step(f"screen {label}")
            shot(name)

    # 6. Back home and take the last look at the home screen.
    adb("shell", "input", "keyevent", "KEYCODE_BACK")
    time.sleep(1.5)

    # 7. What did the app say in the log?
    log = adb("logcat", "-d", "-v", "brief", *([f"{PACKAGE}:E", "ReactNativeJS:V", "ReactNative:V", "AndroidRuntime:E"]) if False else ["-t", "4000"])
    with open(os.path.join(OUT, "logcat.txt"), "w", encoding="utf-8", errors="replace") as f:
        f.write(log)
    errors = [
        line
        for line in log.splitlines()
        if re.search(r"(FATAL|AndroidRuntime|ReactNativeJS.*Error|Invariant Violation|TypeError|ReferenceError)", line)
    ]
    print(f"\n=== logcat: {len(errors)} line(s) that look like an error")
    for line in errors[:20]:
        print("  ", line[:220])
    return 0


if __name__ == "__main__":
    sys.exit(main())
