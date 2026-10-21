"""
Builds the class-alarm chime.

The alarm needs a sound that is clearly a chime rather than a buzz, is short
enough not to annoy, and is ours to ship (no third-party ringtone). It is
written as a 44.1 kHz 16-bit mono WAV, which is what Android expects in
`res/raw` for a notification channel sound.

    python tools/build_alarm_sound.py

The result is `assets/sounds/class_alarm.wav`. The `expo-notifications`
config plugin copies it into `android/app/src/main/res/raw/class_alarm.wav`
(see the `sounds` option in `app.json`), and the notification channel then
refers to it by that name.
"""
import math
import os
import struct
import wave

SAMPLE_RATE = 44100
OUTPUT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sounds', 'class_alarm.wav'
)

# A bright A major triad (A5 - C#6 - E6). The intervals are what make it read
# as a chime instead of a beep.
NOTES = [
    (880.00, 0.00),   # A5
    (1108.73, 0.34),  # C#6
    (1318.51, 0.68),  # E6
]
NOTE_LENGTH = 0.30
TAIL = 0.55
PEAK = 0.84  # about -1.5 dBFS, so the phone's normaliser keeps some headroom


def envelope(position: float, length: float) -> float:
    """A fast attack and an exponential decay, so the note starts cleanly."""
    attack = 0.012
    if position < attack:
        return position / attack
    decay = math.exp(-3.4 * (position - attack) / max(0.001, length - attack))
    return decay


def build_samples() -> list[float]:
    total = NOTES[-1][1] + NOTE_LENGTH + TAIL
    count = int(total * SAMPLE_RATE)
    samples = [0.0] * count

    for frequency, start in NOTES:
        offset = int(start * SAMPLE_RATE)
        length = int(NOTE_LENGTH * SAMPLE_RATE)
        for i in range(length):
            index = offset + i
            if index >= count:
                break
            t = i / SAMPLE_RATE
            # The fundamental plus a quieter octave, which gives the bell
            # its edge without the harshness of a square wave.
            value = math.sin(2 * math.pi * frequency * t)
            value += 0.32 * math.sin(4 * math.pi * frequency * t)
            value += 0.12 * math.sin(6 * math.pi * frequency * t)
            samples[index] += value * envelope(i / SAMPLE_RATE, NOTE_LENGTH) * 0.34

    # A soft fade at the very end so the tail does not click.
    fade = int(0.05 * SAMPLE_RATE)
    for i in range(fade):
        index = count - 1 - i
        if 0 <= index < count:
            samples[index] *= i / fade

    loudest = max(abs(s) for s in samples) or 1.0
    return [s / loudest * PEAK for s in samples]


def main() -> None:
    samples = build_samples()
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with wave.open(OUTPUT, 'wb') as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(
            b''.join(struct.pack('<h', int(max(-1.0, min(1.0, s)) * 32767)) for s in samples)
        )
    size = os.path.getsize(OUTPUT)
    print(f'wrote {os.path.normpath(OUTPUT)} ({size} bytes, {len(samples) / SAMPLE_RATE:.2f}s)')


if __name__ == '__main__':
    main()
