/**
 * GBU One — Unified local storage layer.
 * Per docs/ARCHITECTURE.md: MMKV for fast key-value (prefs, small caches),
 * expo-sqlite for structured caches (notices, timetable snapshots), with an
 * AsyncStorage fallback so flows keep working in Jest and on any device
 * where the MMKV native module is unavailable.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

let mmkv: {
  set: (k: string, v: string) => void;
  getString: (k: string) => string | undefined;
  delete: (k: string) => void;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const { MMKV } = require('react-native-mmkv');
  mmkv = new MMKV({ id: 'gbu-one' });
} catch {
  // Jest / Expo Go without the native module: fall through to AsyncStorage.
  mmkv = null;
}

export const isMmkvAvailable = (): boolean => mmkv !== null;

export const kvStorage = {
  get(key: string): string | null {
    try {
      if (mmkv) return mmkv.getString(key) ?? null;
    } catch {
      // fall through to async path below
    }
    return null;
  },
  set(key: string, value: string): void {
    try {
      if (mmkv) {
        mmkv.set(key, value);
        return;
      }
    } catch {
      // fire-and-forget async fallback
    }
    void AsyncStorage.setItem(key, value).catch(() => {});
  },
  remove(key: string): void {
    try {
      if (mmkv) {
        mmkv.delete(key);
        return;
      }
    } catch {
      // ignore
    }
    void AsyncStorage.removeItem(key).catch(() => {});
  },
  async getAsync(key: string): Promise<string | null> {
    try {
      if (mmkv) {
        const v = mmkv.getString(key);
        if (v !== undefined) return v;
      }
    } catch {
      // ignore
    }
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
};

/**
 * zustand/middleware `persist` storage adapter backed by MMKV (sync when
 * available) with an AsyncStorage fallback. AsyncStorage-only methods are
 * async, which `persist` supports via `createJSONStorage(() => adapter)`.
 */
export const zustandStorage: StateStorage = {
  getItem: (name: string): string | null | Promise<string | null> => {
    try {
      if (mmkv) return mmkv.getString(name) ?? null;
    } catch {
      // ignore
    }
    return AsyncStorage.getItem(name);
  },
  setItem: (name: string, value: string): void | Promise<void> => {
    try {
      if (mmkv) {
        mmkv.set(name, value);
        return;
      }
    } catch {
      // ignore
    }
    return AsyncStorage.setItem(name, value).catch(() => {});
  },
  removeItem: (name: string): void | Promise<void> => {
    try {
      if (mmkv) {
        mmkv.delete(name);
        return;
      }
    } catch {
      // ignore
    }
    return AsyncStorage.removeItem(name).catch(() => {});
  },
};

export default kvStorage;
