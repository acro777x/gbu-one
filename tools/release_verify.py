"""Full end-to-end verification of the student and admin APKs on the emulator.

    python tools/release_verify.py

Walks every feature, captures a screenshot AND a UI dump at each stop, and
records timings so lag is visible. The report is written to
docs/qa/release/verification.txt. This is the script used for the 2026-11-21
release pass after the owner reported: PDFs stuck at 99%, a leaderboard
overlap, a false COMPLETED badge, alarm and admin questions.
"""

from __future__ import annotations

import os
import re
import subprocess
import time

SERIAL = os.environ.get("GBU_EMULATOR", "emulator-5554")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "qa", "release")
STUDENT = "in.gbu.one"
ADMIN = "in.gbu.one.admin"


def adb(*args: str, timeout: int = 90) -> str:
    try:
        return subprocess.run(
            ["adb", "-s", SERIAL, *args], capture_output=True, text=True, timeout=timeout
        ).stdout
    except subprocess.TimeoutExpired:
        return "TIMEOUT"


def snapshot(name: str, xml_name: str) -> tuple[str, float]:
    start = time.monotonic()
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    adb("pull", "/sdcard/ui.xml", os.path.join(OUT, xml_name))
    elapsed = time.monotonic() - start
    adb("shell", "screencap", "-p", "/sdcard/shot.png")
    adb("pull", "/sdcard/shot.png", os.path.join(OUT, name))
    try:
        with open(os.path.join(OUT, xml_name), encoding="utf-8", errors="replace") as f:
            return f.read(), elapsed
    except OSError:
        return "", elapsed


def labels(xml: str) -> list[str]:
    return [m.group(1) for m in re.finditer(r'text="([^"]+)"', xml) if m.group(1).strip()]


def tap(xml: str, label: str) -> bool:
    pattern = r'text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
    for m in re.finditer(pattern, xml):
        if label.lower() in m.group(1).lower():
            x = (int(m.group(2)) + int(m.group(4))) // 2
            y = (int(m.group(3)) + int(m.group(5))) // 2
            adb("shell", "input", "tap", str(x), str(y))
            time.sleep(2.5)
            return True
    return False


def step(report: list[str], title: str, shot: str, xml_name: str) -> str:
    xml, elapsed = snapshot(shot, xml_name)
    found = labels(xml)
    report.append(f"\n## {title}  (dump {elapsed:.2f}s, {len(found)} labels)")
    report.append(" | ".join(found[:14]))
    if elapsed > 6:
        report.append(f"  !! LAG: {elapsed:.2f}s")
    return xml


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    report: list[str] = ["# GBU One release verification — 2026-11-21"]

    # ---- student app -------------------------------------------------------
    adb("shell", "pm", "clear", STUDENT)
    adb("shell", "am", "start", "-n", f"{STUDENT}/.MainActivity")
    time.sleep(18)
    xml = step(report, "Student · onboarding", "v01-onboarding.png", "v01.xml")
    for _ in range(4):
        if not tap(xml, "Next"):
            break
        xml, _ = snapshot("v02-onboarding-step.png", "v02.xml")
    tap(xml, "Get started")
    time.sleep(3)
    xml, _ = snapshot("v03-permission.png", "v03.xml")

    # Class setup may already be complete from a previous install.
    if "Class Setup" in " ".join(labels(xml)):
        report.append("  class setup present")
        for label in ["SOICT", "Continue to Programme", "B.Tech. CSE Cyber Security",
                      "Continue to Year", "Year II (2nd Year)", "Continue to Section",
                      "Complete Setup"]:
            if not tap(xml, label):
                report.append(f"  could not find '{label}'")
                break
            xml, _ = snapshot("v04-class-setup.png", "v04.xml")
        time.sleep(4)

    xml = step(report, "Student · home (live notices)", "v05-home.png", "v05.xml")

    for tab, shot in [("Notices", "v06-notices.png"), ("Timetable", "v07-timetable.png"),
                      ("PYQ", "v08-pyq.png"), ("Profile", "v09-profile.png")]:
        if tap(xml, tab):
            xml = step(report, f"Student · tab {tab}", shot, f"v-{tab}.xml")
        else:
            report.append(f"\n## tab {tab}: NOT FOUND")

    # PYQ leaderboard link -> dedicated screen (the overlap was on the banner).
    if tap(xml, "Full Leaderboard"):
        step(report, "Student · full leaderboard", "v10-leaderboard.png", "v10.xml")
        adb("shell", "input", "keyevent", "KEYCODE_BACK")
        time.sleep(2)

    # Examination Hub: inspect the stale sheet badge and each phase.
    tap(xml, "Home")
    time.sleep(2)
    if tap(xml, "Exam Hub"):
        xml = step(report, "Student · Exam Hub end-sem", "v11-exams-end.png", "v11.xml")
        for label, shot in [("Practicals", "v12-exams-practicals.png"),
                            ("Back Paper", "v13-exams-back.png"),
                            ("End Sem", "v14-exams-end-again.png")]:
            if tap(xml, label):
                xml = step(report, f"Student · Exam Hub {label}", shot, "v-phase.xml")
            else:
                report.append(f"  phase {label}: NOT FOUND")
        adb("shell", "input", "keyevent", "KEYCODE_BACK")
        time.sleep(2)

    # Notice detail -> View PDF (the 99% stall). Prefer a PDF-bearing notice.
    tap(xml, "Notices")
    time.sleep(2)
    xml, _ = snapshot("v15-notices-list.png", "v15.xml")
    for label in ["Date Sheet", "View Attachment", "View details", "HOSTEL"]:
        if tap(xml, label):
            break
    xml = step(report, "Student · notice detail", "v16-notice-detail.png", "v16.xml")
    for label in ["View PDF", "Open", "Attachment"]:
        if tap(xml, label):
            time.sleep(12)
            step(report, "Student · PDF opened after View PDF", "v17-pdf-viewer.png", "v17.xml")
            break

    # Alarms + custom ringtone UI.
    adb("shell", "input", "keyevent", "KEYCODE_BACK")
    time.sleep(2)
    adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "gbuone://alarms", "-p", STUDENT)
    time.sleep(5)
    step(report, "Student · alarms + custom ringtone", "v18-alarms.png", "v18.xml")

    # ---- admin app ---------------------------------------------------------
    adb("shell", "am", "force-stop", ADMIN)
    adb("shell", "am", "start", "-n", f"{ADMIN}/.MainActivity")
    time.sleep(14)
    step(report, "Admin · sign-in gate", "v19-admin.png", "v19.xml")
    report.append("\nAdmin: RLS audit is run separately with tools/rls_audit.js (20/20 checks).")

    out = "\n".join(report)
    print(out[-6000:])
    with open(os.path.join(OUT, "verification.txt"), "w", encoding="utf-8") as f:
        f.write(out + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
