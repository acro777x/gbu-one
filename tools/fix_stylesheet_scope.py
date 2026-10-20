"""Fixes theme references that landed inside a module-level StyleSheet.

`StyleSheet.create` runs once at module load, so it cannot read the runtime
theme. A colour that belongs to a style object has to use the static `theme`
import; a colour applied at the usage site uses `colors` from `useAppTheme()`.

This moves the offending references from `colors.` to `theme.` inside style
objects, and adds the missing import.

    python tools/fix_stylesheet_scope.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# file -> the style names whose bodies must not use `colors.`
STYLE_SCOPES: dict[str, list[str]] = {
    'app/(tabs)/index.tsx': ['deadlineBadge'],
    'app/exams.tsx': ['examShiftBadge', 'statusPass', 'statusPcp'],
    'src/components/ui/BottomSheet.tsx': ['sheet'],
    'src/components/ui/FloatingTabBar.tsx': ['tab'],
}


def main() -> None:
    for relative, styles in STYLE_SCOPES.items():
        path = ROOT / relative
        if not path.exists():
            print(f'MISSING {relative}')
            continue
        text = path.read_text(encoding='utf-8')
        original = text

        for style in styles:
            pattern = re.compile(rf'({re.escape(style)}: \{{)(.*?)(\n\s*\}})', re.DOTALL)
            match = pattern.search(text)
            if not match:
                print(f'  not found: {relative} :: {style}')
                continue
            body = match.group(2)
            if 'colors.' not in body:
                continue
            cleaned = body.replace('colors.', 'theme.')
            text = (
                text[: match.start()]
                + match.group(1)
                + cleaned
                + match.group(3)
                + text[match.end():]
            )
            print(f'  fixed: {relative} :: {style}')

        if text != original:
            path.write_text(text, encoding='utf-8')


if __name__ == '__main__':
    main()
