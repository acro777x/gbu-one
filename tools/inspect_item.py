import zipfile
import re

with zipfile.ZipFile("base.apk", "r") as z:
    data = z.read("classes2.dex")
    # Search for all strings around "TimeTableDataModelItem.kt"
    pos = data.find(b"TimeTableDataModelItem.kt")
    if pos != -1:
        chunk = data[pos-1000:pos+3000]
        # find ASCII sequences
        print("Around TimeTableDataModelItem.kt:")
        for m in re.finditer(rb"[a-zA-Z0-9_]{2,}", chunk):
            print(m.group(0).decode("ascii", errors="ignore"))
