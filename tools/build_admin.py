import os
import shutil
import subprocess

build_gradle_path = r'C:\gbuone-build\android\app\build.gradle'
strings_xml_path = r'C:\gbuone-build\android\app\src\main\res\values\strings.xml'
app_json_path = r'C:\gbuone-build\app.json'

backup_dir = r'C:\gbuone-build\temp_backup'
os.makedirs(backup_dir, exist_ok=True)

gradle_bak = os.path.join(backup_dir, 'build.gradle.bak')
strings_bak = os.path.join(backup_dir, 'strings.xml.bak')
app_json_bak = os.path.join(backup_dir, 'app.json.bak')

print("Backing up config files to temp_backup...")
shutil.copy(build_gradle_path, gradle_bak)
shutil.copy(strings_xml_path, strings_bak)
shutil.copy(app_json_path, app_json_bak)

try:
    print("Configuring Admin build variant...")
    with open(build_gradle_path, 'r', encoding='utf-8') as f:
        gradle_content = f.read()
    gradle_content = gradle_content.replace("applicationId 'in.gbu.one'", "applicationId 'in.gbu.one.admin'")
    with open(build_gradle_path, 'w', encoding='utf-8') as f:
        f.write(gradle_content)

    with open(strings_xml_path, 'r', encoding='utf-8') as f:
        strings_content = f.read()
    strings_content = strings_content.replace('>GBU One<', '>GBU One Admin<')
    with open(strings_xml_path, 'w', encoding='utf-8') as f:
        f.write(strings_content)

    with open(app_json_path, 'r', encoding='utf-8') as f:
        app_json = f.read()
    app_json = app_json.replace('"package": "in.gbu.one"', '"package": "in.gbu.one.admin"')
    app_json = app_json.replace('"name": "GBU One"', '"name": "GBU One Admin"')
    with open(app_json_path, 'w', encoding='utf-8') as f:
        f.write(app_json)

    source_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # Ensure admin routes are available in BUILD for admin build
    src_admin = os.path.join(source_dir, 'app', 'admin')
    dst_admin = r'C:\gbuone-build\app\admin'
    if os.path.isdir(src_admin):
        shutil.copytree(src_admin, dst_admin, dirs_exist_ok=True)
        print("Injected app/admin into Admin build.")

    src_mod = os.path.join(source_dir, 'app', 'moderation.tsx')
    dst_mod = r'C:\gbuone-build\app\moderation.tsx'
    if os.path.exists(src_mod):
        shutil.copy2(src_mod, dst_mod)
        print("Injected app/moderation.tsx into Admin build.")

    var_file = r'C:\gbuone-build\src\lib\appVariant.ts'
    if os.path.exists(var_file):
        with open(var_file, 'w', encoding='utf-8') as f:
            f.write("export function isAdminApp(): boolean { return true; }\n")

    print("Running assembleDebug for Admin APK...")
    res = subprocess.run([r'cmd.exe', '/c', r'C:\gbuone-build\build_apk.bat'], check=True)
    print("Admin build finished with return code:", res.returncode)

    apk_src = r'C:\gbuone-build\android\app\build\outputs\apk\debug\app-debug.apk'
    apk_dst1 = r'C:\gbuone-build\apk\gbu-one-admin.apk'
    apk_dst2 = r'apk\gbu-one-admin.apk'

    shutil.copy(apk_src, apk_dst1)
    shutil.copy(apk_src, apk_dst2)
    print("Copied Admin APK to:", apk_dst1, "and", apk_dst2)

finally:
    print("Restoring original config files...")
    shutil.copy(gradle_bak, build_gradle_path)
    shutil.copy(strings_bak, strings_xml_path)
    shutil.copy(app_json_bak, app_json_path)
    shutil.rmtree(backup_dir, ignore_errors=True)

    # Clean up admin files from BUILD
    if os.path.isdir(r'C:\gbuone-build\app\admin'):
        shutil.rmtree(r'C:\gbuone-build\app\admin', ignore_errors=True)
    if os.path.exists(r'C:\gbuone-build\app\moderation.tsx'):
        os.remove(r'C:\gbuone-build\app\moderation.tsx')
    var_file = r'C:\gbuone-build\src\lib\appVariant.ts'
    if os.path.exists(var_file):
        with open(var_file, 'w', encoding='utf-8') as f:
            f.write("export function isAdminApp(): boolean { return false; }\n")
    print("Restored.")
