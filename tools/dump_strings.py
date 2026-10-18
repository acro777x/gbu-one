import zipfile
import re

with zipfile.ZipFile("base.apk", "r") as z:
    for name in ["classes.dex", "classes2.dex", "classes3.dex"]:
        data = z.read(name)
        # Find all strings related to api, schd, timetable, param
        matches = re.findall(b"[\x20-\x7E]{4,100}", data)
        for m in matches:
            s = m.decode("ascii", errors="ignore")
            if any(k in s.lower() for k in ["schd", "samay", "sameer", "mygbu", "api.php", "timetable"]):
                if not any(x in s for x in ["http://schemas", "android"]):
                    print(f"[{name}] {s}")
