import io

for path in ('app/index.tsx', 'app/(tabs)/_layout.tsx'):
    print('=' * 20, path)
    try:
        print(io.open(path, encoding='utf-8').read()[:1800])
    except OSError as error:
        print('missing', error)
