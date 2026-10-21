"""Plots the frame timeline of the last app start, so the jank can be located."""
import re
import subprocess

S = 'emulator-5554'
out = subprocess.run(
    ['adb', '-s', S, 'shell', 'dumpsys', 'gfxinfo', 'in.gbu.one', 'framestats'],
    capture_output=True, text=True,
).stdout

lines = out.splitlines()
start = None
for i, line in enumerate(lines):
    if line.startswith('---PROFILEDATA---'):
        start = i
        break
if start is None:
    print('no profile data')
    raise SystemExit(1)

header = lines[start + 1].split(',')
cols = {name.strip(): index for index, name in enumerate(header)}
frames = []
for line in lines[start + 2:]:
    if not line.strip() or line.startswith('---'):
        break
    parts = line.split(',')
    if len(parts) < len(header):
        continue
    try:
        intended = int(parts[cols['IntendedVsync']])
        completed = int(parts[cols['FrameCompleted']])
        duration = completed - intended
    except (ValueError, KeyError):
        continue
    if intended <= 0:
        continue
    frames.append((intended, completed, duration))

if not frames:
    print('no frames')
    raise SystemExit(1)

base = frames[0][0]
buckets = {}
for intended, actual, duration in frames:
    at = (intended - base) / 1_000_000
    slot = int(at * 4) / 4
    buckets.setdefault(slot, []).append(duration / 1_000_000)

print(f'{len(frames)} frames, {at:.2f}s span')
print('  time    frames  slow(>17ms)  worst')
for slot in sorted(buckets):
    durations = buckets[slot]
    slow = [d for d in durations if d > 17]
    print(
        f'  {slot:5.2f}s   {len(durations):4d}      {len(slow):4d}      {max(durations):6.1f}ms',
    )
