"""Replaces the hard-coded light-mode greys with the semantic tokens.

The app used `rgba(17, 24, 39, 0.06)` and friends in a dozen places. Those
are light-mode values, so they look wrong in dark mode, and they duplicate
tokens that already exist. This maps them onto the palette.

    python tools/fix_hardcoded_greys.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Literal -> token expression
MAP = {
    "'rgba(17, 24, 39, 0.03)'": 'colors.divider',
    "'rgba(17, 24, 39, 0.04)'": 'colors.divider',
    "'rgba(17, 24, 39, 0.05)'": 'colors.surfaceMuted',
    "'rgba(17, 24, 39, 0.06)'": 'colors.surfaceMuted',
    "'rgba(17, 24, 39, 0.08)'": 'colors.surfaceMuted',
    "'rgba(17, 24, 39, 0.10)'": 'colors.surfaceMuted',
    "'rgba(0, 0, 0, 0.04)'": 'colors.surfaceMuted',
    "'rgba(0, 0, 0, 0.06)'": 'colors.surfaceMuted',
    "'rgba(255, 255, 255, 0.75)'": 'colors.shimmer',
    "'#344054'": 'colors.borderStrong',
}

# Literal -> token expression, for the soft status tints that were built by hand
SOFT_MAP = {
    "'rgba(245, 184, 61, 0.12)'": 'colors.warningSoft',
    "'rgba(245, 184, 61, 0.16)'": 'colors.warningSoft',
    "'rgba(16, 185, 129, 0.15)'": 'colors.successSoft',
    "'rgba(245, 158, 11, 0.1)'": 'colors.warningSoft',
    "'rgba(245, 158, 11, 0.15)'": 'colors.warningSoft',
}

# Files where the styles are module-level (no `colors` in scope) - these keep
# the static theme import instead.
STATIC_FILES = {
    'src/components/ui/NoticeCard.tsx',
    'src/components/ui/AttendanceBatteryCard.tsx',
    'src/components/ui/Skeleton.tsx',
}


def main() -> None:
    files = list(ROOT.glob('app/**/*.tsx')) + list(ROOT.glob('src/**/*.tsx'))
    changed = 0
    leftovers: list[str] = []

    for path in files:
        relative = path.relative_to(ROOT).as_posix()
        text = path.read_text(encoding='utf-8')
        original = text

        for literal, token in {**MAP, **SOFT_MAP}.items():
            if literal not in text:
                continue
            replacement = token
            if relative in STATIC_FILES and token.startswith('colors.'):
                replacement = f'theme.{token}'
            text = text.replace(literal, replacement)

        if text != original:
            path.write_text(text, encoding='utf-8')
            changed += 1
            print(f'updated {relative}')

    print(f'\n{changed} file(s) updated')

    for path in files:
        relative = path.relative_to(ROOT).as_posix()
        for number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
            if re.search(r"rgba\(17, 24, 39|rgba\(245, 158, 11|rgba\(16, 185, 129|rgba\(245, 184, 61", line):
                leftovers.append(f'{relative}:{number}  {line.strip()}')

    if leftovers:
        print(f'\n{len(leftovers)} hard-coded grey(s) left:')
        for line in leftovers:
            print(f'  {line}')
    else:
        print('no hard-coded light greys left')


if __name__ == '__main__':
    main()
