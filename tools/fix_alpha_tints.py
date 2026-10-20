"""Replaces the manual alpha-composited colours with the semantic *Soft tokens.

The app used to build tints by concatenating an alpha suffix onto the accent
hex (`${colors.accent}15`). That produced a different shade from the
`accentSoft` token, so two badges next to each other had two different
backgrounds. This rewrites them to the tokens.

    python tools/fix_alpha_tints.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# file -> list of (old, new)
REPLACEMENTS: dict[str, list[tuple[str, str]]] = {
    'app/(tabs)/index.tsx': [
        ('{ backgroundColor: `${colors.accent}20` }', '{ backgroundColor: colors.accentSoft }'),
        (
            '{ borderColor: colors.accent, backgroundColor: `${colors.accent}20` }',
            '{ borderColor: colors.accent, backgroundColor: colors.accentSoft }',
        ),
        (
            '{ backgroundColor: colors.accentSoft, borderColor: `${colors.accent}44` }',
            '{ backgroundColor: colors.accentSoft, borderColor: colors.accent }',
        ),
    ],
    'app/(tabs)/pyq.tsx': [
        (
            '{ backgroundColor: colors.accentSoft, borderColor: `${colors.accent}44` }',
            '{ backgroundColor: colors.accentSoft, borderColor: colors.accent }',
        ),
    ],
    'app/(tabs)/timetable.tsx': [
        (
            'isSelected ? colors.accent : isToday ? `${colors.accent}88` : colors.borderGlass',
            'isSelected ? colors.accent : isToday ? colors.accent : colors.borderGlass',
        ),
        (
            '{ backgroundColor: colors.accentSoft, borderColor: `${colors.accent}44` }',
            '{ backgroundColor: colors.accentSoft, borderColor: colors.accent }',
        ),
        (
            '{ backgroundColor: colors.successSoft, borderColor: `${colors.success}44` }',
            '{ backgroundColor: colors.successSoft, borderColor: colors.success }',
        ),
        (
            '{ backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}44` }',
            '{ backgroundColor: colors.dangerSoft, borderColor: colors.danger }',
        ),
    ],
    'app/login.tsx': [
        (
            '{ backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}40` }',
            '{ backgroundColor: colors.dangerSoft, borderColor: colors.danger }',
        ),
        (
            '{ backgroundColor: colors.accentSoft, borderColor: `${colors.accent}40` }',
            '{ backgroundColor: colors.accentSoft, borderColor: colors.accent }',
        ),
        (
            '{ backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}40`, marginBottom: 12 }',
            '{ backgroundColor: colors.dangerSoft, borderColor: colors.danger, marginBottom: 12 }',
        ),
        (
            '{ backgroundColor: colors.accentSoft, borderColor: `${colors.accent}40`, marginBottom: 12 }',
            '{ backgroundColor: colors.accentSoft, borderColor: colors.accent, marginBottom: 12 }',
        ),
    ],
    'app/mail.tsx': [
        (
            '{ backgroundColor: colors.accentSoft, borderColor: `${colors.accent}40` }',
            '{ backgroundColor: colors.accentSoft, borderColor: colors.accent }',
        ),
        (
            'email.isUnread && { borderColor: `${colors.accent}66` }',
            'email.isUnread && { borderColor: colors.accent }',
        ),
    ],
    'app/onboarding.tsx': [
        (
            '{ backgroundColor: colors.accentSoft, borderColor: `${colors.accent}30` }',
            '{ backgroundColor: colors.accentSoft, borderColor: colors.accent }',
        ),
        ('{ backgroundColor: `${colors.accent}15` }', '{ backgroundColor: colors.accentSoft }'),
        ('borderColor: `${colors.accent}30`,', 'borderColor: colors.accent,'),
    ],
    'app/teamwork-preview.tsx': [
        (
            '{ backgroundColor: colors.accentSoft, borderColor: `${colors.accent}44` }',
            '{ backgroundColor: colors.accentSoft, borderColor: colors.accent }',
        ),
    ],
    'src/components/ui/AttendanceBatteryCard.tsx': [
        (
            'borderColor: isHealthy ? `${colors.success}33` : `${colors.danger}33`,',
            'borderColor: isHealthy ? colors.success : colors.danger,',
        ),
        (
            '{ backgroundColor: colors.successSoft, borderColor: `${colors.success}44` }',
            '{ backgroundColor: colors.successSoft, borderColor: colors.success }',
        ),
        (
            '{ backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}44` }',
            '{ backgroundColor: colors.dangerSoft, borderColor: colors.danger }',
        ),
    ],
    'src/components/ui/FloatingTabBar.tsx': [
        ('borderColor: `${colors.accent}40`,', 'borderColor: colors.accent,'),
    ],
    'src/components/ui/GlassCard.tsx': [
        ('? `${colors.accent}88`', '? colors.accent'),
    ],
    'src/components/ui/NoticeCard.tsx': [
        ('{ backgroundColor: `${colors.accent}15` }', '{ backgroundColor: colors.accentSoft }'),
    ],
}

# Any remaining alpha-composited tint, whatever the alpha.
ALPHA_TINT = re.compile(r'`\$\{colors\.(accent|success|danger|warning)\}\d{2}`')


def main() -> None:
    changed = 0
    for relative, pairs in REPLACEMENTS.items():
        path = ROOT / relative
        if not path.exists():
            print(f'MISSING {relative}')
            continue
        text = path.read_text(encoding='utf-8')
        original = text
        for old, new in pairs:
            text = text.replace(old, new)
        if text != original:
            path.write_text(text, encoding='utf-8')
            changed += 1
            print(f'updated {relative}')

    # Report anything the table did not cover.
    leftovers: list[str] = []
    for path in list(ROOT.glob('app/**/*.tsx')) + list(ROOT.glob('src/**/*.tsx')):
        for number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
            if ALPHA_TINT.search(line):
                leftovers.append(f'{path.relative_to(ROOT)}:{number}  {line.strip()}')

    print(f'\n{changed} file(s) updated')
    if leftovers:
        print(f'\n{len(leftovers)} alpha tint(s) still to review:')
        for line in leftovers:
            print(f'  {line}')
    else:
        print('no alpha-composited tints left')


if __name__ == '__main__':
    main()
