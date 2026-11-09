import re

with open('app/admin/index.tsx', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# 1. State definition for authGateMode
text = re.sub(
    r"useState<'sign_in'\s*\|\s*'initial_setup'\s*\|\s*'emergency'>\('sign_in'\);",
    "useState<'sign_in' | 'initial_setup'>('sign_in');",
    text
)

# 2. Remove the Emergency PIN button from the switcher
old_emergency_tab_pattern = r"<TouchableOpacity\s*onPress=\{\(\)\s*=>\s*\{\s*setAuthGateMode\('emergency'\);.*?</TouchableOpacity>"
text = re.sub(old_emergency_tab_pattern, '', text, flags=re.DOTALL)

# 3. Remove the emergency form block
old_emergency_form_pattern = r"\{authGateMode === 'emergency'\s*&&.*?\(.*?\)\s*\}"
text = re.sub(old_emergency_form_pattern, '', text, flags=re.DOTALL)

# 4. Remove emergency from button label
text = text.replace(
    ": authGateMode === 'emergency'\n                    ? 'Unlock via Emergency PIN'",
    ""
)
text = text.replace(
    ": authGateMode === 'emergency'\r\n                    ? 'Unlock via Emergency PIN'",
    ""
)

with open('app/admin/index.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Successfully updated app/admin/index.tsx to remove emergency PIN')
