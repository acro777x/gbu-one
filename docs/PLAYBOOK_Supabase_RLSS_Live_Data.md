# GBU One — Supabase RLS & Live Data Connect Playbook

## 🔴 Step 1 — Apply RLS Policies to Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Paste the SQL below and click Run

```sql
-- 1. CREATE HELPER FUNCTION (run FIRST)
create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.moderators m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant execute on function public.is_moderator() to anon, authenticated;
```

## 🟡 Step 2 — Seed the Moderators Table
```sql
insert into public.moderators (email, role)
values ('ashishkhola56@gmail.com', 'owner');
```

## 🟢 Step 3 — Run the Full Gradle Build
```powershell
Get-Process -Name java -ErrorAction SilentlyContinue | Stop-Process -Force
cd C:/gbuone
python tools/build_android_apk.py
```
- Watch at C:/gbuone/android/gradle_out.txt
- APK: C:/gbuone/android/app/build/outputs/apk/debug/app-debug.apk
- Takes 10-15 minutes.

## 🔵 Step 4 — Re-test on Emulator
```powershell
& 'C:\Users\ashis\AppData\Local\Android\Sdk\emulator\emulator.exe' @UnoEmulator -no-snapshot-load
adb wait-for-device
adb uninstall in.gbu.one
adb install -r C:/gbuone/android/app/build/outputs/apk/debug/app-debug.apk
```

## 📋 Summary
| Step | Status |
|------|--------|
| RLS policies SQL | Ready |
| Moderators seed | Ready |
| Gradle build | Ready |
| Emulator test | Ready |
