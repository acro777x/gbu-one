import zipfile
import re

with zipfile.ZipFile("base.apk", "r") as z:
    for name in ["classes.dex", "classes2.dex", "classes3.dex"]:
        data = z.read(name)
        # Search for times like 8:30, 9:00, 9:30, 10:30, etc.
        times = re.findall(rb"\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?(?:\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)?", data)
        valid = set()
        for t in times:
            s = t.decode("ascii", errors="ignore")
            if any(h in s for h in ["8:", "9:", "10:", "11:", "12:", "1:", "2:", "3:", "4:", "5:"]):
                valid.add(s)
        if valid:
            print(f"[{name}] Found times:", sorted(valid))
