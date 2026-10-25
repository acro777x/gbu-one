import os
import zipfile

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUTPUT_ZIP = os.path.join(PROJECT_ROOT, 'gbu-one-full-codebase.zip')

EXCLUDE_DIRS = {
    '.git',
    'node_modules',
    'android',
    'apk',
    '.expo',
    '__pycache__',
    'checklist_extracted',
    'dist',
    'web-build',
    'ref',
}

EXCLUDE_EXTENSIONS = {
    '.zip',
    '.apk',
    '.pyc',
    '.bak',
}

def should_exclude(rel_path):
    parts = rel_path.replace('\\', '/').split('/')
    for p in parts:
        if p in EXCLUDE_DIRS:
            return True
    
    # Exclude screenshots in docs/qa
    if rel_path.replace('\\', '/').startswith('docs/qa/') and (rel_path.endswith('.png') or rel_path.endswith('.jpg')):
        return True

    ext = os.path.splitext(rel_path)[1].lower()
    if ext in EXCLUDE_EXTENSIONS:
        return True

    return False

def make_zip():
    print(f"Creating clean codebase zip: {OUTPUT_ZIP}")
    file_count = 0
    total_uncompressed_bytes = 0

    with zipfile.ZipFile(OUTPUT_ZIP, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(PROJECT_ROOT):
            # Prune directories in-place
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, PROJECT_ROOT)

                if should_exclude(rel_path):
                    continue

                zipf.write(full_path, rel_path)
                file_count += 1
                total_uncompressed_bytes += os.path.getsize(full_path)

    zip_size_bytes = os.path.getsize(OUTPUT_ZIP)
    zip_size_mb = zip_size_bytes / (1024 * 1024)
    print(f"Successfully packaged {file_count} files.")
    print(f"Total uncompressed: {total_uncompressed_bytes / (1024 * 1024):.2f} MB")
    print(f"Final Zip size: {zip_size_mb:.2f} MB ({zip_size_bytes} bytes)")

if __name__ == '__main__':
    make_zip()
