import io
import re

text = io.open('qa_ui.xml', encoding='utf-8', errors='replace').read()
print('dump size', len(text))
for m in re.finditer(r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', text):
    label = m.group(1)
    if any(key in label for key in ('Exam', 'Mail', 'Schedule', 'Calendar', 'View details')):
        x = (int(m.group(2)) + int(m.group(4))) // 2
        y = (int(m.group(3)) + int(m.group(5))) // 2
        print(repr(label), x, y)
