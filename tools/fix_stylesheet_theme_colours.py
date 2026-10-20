"""Removes the theme-dependent colour from a StyleSheet entry.

The style objects are created once at module load, so they cannot read the
runtime theme. The colour has to be applied where the style is used, from
`useAppTheme()`. This strips the colour from the style and reports the
places that need it.

    python tools/fix_stylesheet_theme_colours.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# (file, style name) -> the style entry to clean
TARGETS = [
    ('app/(tabs)/index.tsx', 'mailBadgeText'),
    ('app/(tabs)/index.tsx', 'mailAvatarText'),
    ('app/(tabs)/timetable.tsx', 'professorInitials'),
    ('app/mail.tsx', 'avatarText'),
    ('app/mail.tsx', 'avatarTextLarge'),
]

COLOUR = re.compile(r'\n\s*color: colors\.onAccent,')


def main() -> None:
    for relative, style in TARGETS:
        path = ROOT / relative
        if not path.exists():
            print(f'MISSING {relative}')
            continue
        text = path.read_text(encoding='utf-8')
        pattern = re.compile(
            rf'({re.escape(style)}: \{{)(.*?)(\n\s*\}})', re.DOTALL
        )
        match = pattern.search(text)
        if not match:
            print(f'not found: {relative} :: {style}')
            continue
        body = match.group(2)
        if 'colors.onAccent' not in body:
            print(f'already clean: {relative} :: {style}')
            continue
        cleaned = COLOUR.sub('', body)
        text = text[: match.start()] + match.group(1) + cleaned + match.group(3) + text[match.end():]
        path.write_text(text, encoding='utf-8')
        print(f'cleaned: {relative} :: {style}')


if __name__ == '__main__':
    main()
