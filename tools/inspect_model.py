import zipfile
import re

with zipfile.ZipFile("base.apk", "r") as z:
    for name in ["classes.dex", "classes2.dex", "classes3.dex"]:
        data = z.read(name)
        # Find occurrences of TimeTableDataModelItem
        idx = 0
        while True:
            idx = data.find(b"TimeTableDataModelItem", idx)
            if idx == -1:
                break
            start = max(0, idx - 100)
            end = min(len(data), idx + 800)
            chunk = data[start:end]
            # print printable strings
            strings = re.findall(b"[a-zA-Z0-9_]{3,}", chunk)
            print("FOUND near", idx, [s.decode('ascii', errors='ignore') for s in strings])
            idx += 22
