import io
import re

text = io.open('app/(tabs)/index.tsx', encoding='utf-8').read()
lines = text.split('\n')
for i, line in enumerate(lines):
    if re.search(r'Exam Hub|router\.push|View details|GBU Mail|Schedule|Calendar', line):
        print(f'{i + 1:4}: {line.rstrip()}')
