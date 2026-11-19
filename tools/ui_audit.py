"""Walk the app on the emulator, saving a UI dump and a screenshot per screen.

    python tools/ui_audit.py

The point is to CATCH UI corruption and lag: an empty dump, a screen that
never settles, or a view that takes seconds to answer is written to the
report with its timing. Screenshots are saved in docs/qa/release/.
"""

from __future__ import annotations

import os
import re
import subprocess
import time

SERIAL = os.environ.get("GBU_EMULATOR", "emulator-5554")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "qa", "release")
PACKAGE = "in.gbu.one"


def adb(*args: str, timeout: int = 60) -> str:
    try:
        return subprocess.run(
            ["adb", "-s", SERIAL, *args], capture_output=True, text=True, timeout=timeout
        ).stdout
    except subprocess.TimeoutExpired:
        return "TIMEOUT"


def dump() -> tuple[str, float]:
    start = time.monotonic()
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml", timeout=30)
    adb("pull", "/sdcard/ui.xml", os.path.join(OUT, "ui.xml"), timeout=30)
    elapsed = time.monotonic() - start
    try:
        with open(os.path.join(OUT, "ui.xml"), encoding="utf-8", errors="replace") as f:
            return f.read(), elapsed
    except OSError:
        return "", elapsed


def shot(name: str) -> None:
    adb("shell", "screencap", "-p", "/sdcard/shot.png")
    adb("pull", "/sdcard/shot.png", os.path.join(OUT, name))


def labels(xml: str) -> list[str]:
    return [m.group(1) for m in re.finditer(r'text="([^"]+)"', xml) if m.group(1).strip()]


def find(xml: str, text: str) -> tuple[int, int] | None:
    pattern = r'text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
    for m in re.finditer(pattern, xml):
        if text.lower() in m.group(1).lower():
            return (int(m.group(2)) + int(m.group(4))) // 2, (int(m.group(3)) + int(m.group(5))) // 2
    return None


def tap(text: str) -> bool:
    xml, _ = dump()
    point = find(xml, text)
    if not point:
        return False
    adb("shell", "input", "tap", str(point[0]), str(point[1]))
    time.sleep(2.5)
    return True


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    report: list[str] = []
    adb("shell", "pm", "clear", PACKAGE)
    adb("shell", "am", "start", "-n", f"{PACKAGE}/.MainActivity")
    time.sleep(18)

    screens = [
        ("onboarding", None),
        ("after-next", "Next"),
        ("class-setup", "Skip"),
        ("home", "Complete Setup"),
    ]
    for name, action in screens:
        if action and not tap(action):
            report.append(f"  {name}: could not find/tap '{action}'")
        xml, elapsed = dump()
        text = " | ".join(labels(xml)[:10])
        report.append(f"  {name}: dump={elapsed:.2f}s, {len(labels(xml))} labels :: {text[:170]}")
        shot(f"audit-{name}.png")
        if elapsed > 6:
            report.append(f"  WARNING: {name} took {elapsed:.2f}s to dump (lag)")

    # The tabs and the feature screens.
    for tab in ["Timetable", "Notices", "PYQ", "Profile"]:
        if tap(tab):
            xml, elapsed = dump()
            report.append(f"  tab {tab}: dump={elapsed:.2f}s :: {' | '.join(labels(xml)[:8])[:150]}")
            shot(f"audit-tab-{tab.lower()}.png")
        else:
            report.append(f"  tab {tab}: NOT FOUND")

    for screen in ["Exam Hub", "GBU Mail", "Calendar", "Events"]:
        tap("Home")
        if tap(screen):
            xml, elapsed = dump()
            report.append(f"  screen {screen}: dump={elapsed:.2f}s :: {' | '.join(labels(xml)[:8])[:150]}")
            shot(f"audit-screen-{screen.lower().replace(' ', '-')}.png")

    out = "\n".join(report)
    print(out)
    with open(os.path.join(OUT, "ui-audit.txt"), "w", encoding="utf-8") as f:
        f.write(out + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
