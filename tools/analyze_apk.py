import zipfile
import re
import json

print("Analyzing base.apk...")
with zipfile.ZipFile("base.apk", "r") as z:
    dex_files = [n for n in z.namelist() if n.endswith(".dex")]
    print(f"Found {len(dex_files)} dex files: {dex_files}")
    
    found_urls = set()
    found_endpoints = set()
    found_strings = set()
    
    for df in dex_files:
        data = z.read(df)
        # Search for URLs
        matches = re.findall(b"https?://[^\s\x00\"\'<>]+", data)
        for m in matches:
            try:
                s = m.decode("utf-8", errors="ignore")
                found_urls.add(s)
            except:
                pass
                
        # Search for interesting path patterns like api.php, schd, etc.
        patterns = re.findall(b"[/a-zA-Z0-9_\-\.]+\.(?:php|json|html|do|jsp)[^\s\x00\"\'<>]*", data)
        for p in patterns:
            try:
                s = p.decode("utf-8", errors="ignore")
                if any(x in s.lower() for x in ["api", "schd", "gbu", "timetable"]):
                    found_endpoints.add(s)
            except:
                pass
                
        # Search for package names and class names
        pkg_matches = re.findall(b"Lcom/[a-zA-Z0-9_/]+;", data)
        for pkg in pkg_matches:
            try:
                s = pkg.decode("utf-8", errors="ignore")
                if "gbu" in s.lower() or "student" in s.lower() or "schd" in s.lower():
                    found_strings.add(s)
            except:
                pass

print("\n--- Relevant URLs ---")
for u in sorted(found_urls):
    if any(k in u.lower() for k in ["gbu", "schd", "firebase", "supabase", "samarth", "hostel", "exam"]):
        print(u)

print("\n--- Endpoints / Files ---")
for ep in sorted(found_endpoints):
    print(ep)

print("\n--- Relevant Classes / Packages ---")
for s in sorted(found_strings)[:30]:
    print(s)
