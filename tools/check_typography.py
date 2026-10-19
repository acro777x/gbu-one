import os
import re

font_pattern = re.compile(r"fontFamily:\s*['\"]([^'\"]+)['\"]")
valid_fonts = {'Poppins-Bold', 'Inter-Regular', 'Inter-Medium', 'Inter-SemiBold', 'Inter-Bold', 'System'}

found = {}
files_with_invalid = {}

for root, dirs, files in os.walk('.'):
    if any(p in root for p in ['node_modules', '.git', 'android', 'dist']):
        continue
    for f in files:
        if f.endswith(('.tsx', '.ts', '.js', '.jsx')):
            filepath = os.path.join(root, f)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as fp:
                content = fp.read()
                matches = font_pattern.findall(content)
                for m in matches:
                    found[m] = found.get(m, 0) + 1
                    if m not in valid_fonts:
                        if m not in files_with_invalid:
                            files_with_invalid[m] = []
                        files_with_invalid[m].append(filepath)

print("Font family analysis across codebase:")
for k, v in sorted(found.items()):
    status = "VALID" if k in valid_fonts else "INVALID"
    print(f"  {k}: {v} usages ({status})")

if files_with_invalid:
    print("\nFiles with invalid font families:")
    for k, files in files_with_invalid.items():
        print(f"  {k}: {len(files)} files -> {files[:3]}")
else:
    print("\nAll font families in codebase are 100% VALID and mapped to bundled fonts!")
