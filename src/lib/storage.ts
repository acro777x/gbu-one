/**
 * GBU One ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Unified local storage layer.
 *
 * MMKV was removed on 2026-11-17. It was the last native library in the
 * APK linked for 4 KB pages, and Google Play requires every native library
 * to be 16 KB aligned for apps that target Android 15 (API 35). MMKV was
 * only a fast key/value store; AsyncStorage already implements the same
 * contract and is the fallback this file has always had, so removing it
 * costs no feature and makes the whole artifact Play-compliant.
 *
 * Structured caches (notices, timetable) live in expo-sqlite.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

export const isMmkvAvailable = (): boolean => false;

export const kvStorage = {
  get(key: string): string | null {
    // AsyncStorage is asynchronous; the synchronous read path is only used
    // by code that can tolerate a cold start without the cached value.
    return null;
  },
  set(key: string, value: string): void {
    void AsyncStorage.setItem(key, value).catch(() => {});
  },
  remove(key: string): void {
    void AsyncStorage.removeItem(key).catch(() => {});
  },
  async getAsync(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
};

/**
 * zustand/middleware 'persist' storage adapter backed by AsyncStorage.
 * 'persist' supports async methods via createJSONStorage(() => adapter).
 */
export const zustandStorage: StateStorage = {
  getItem: (name: string): Promise<string | null> => AsyncStorage.getItem(name),
  setItem: (name: string, value: string): Promise<void> =>
    AsyncStorage.setItem(name, value).catch(() => {}),
  removeItem: (name: string): Promise<void> =>
    AsyncStorage.removeItem(name).catch(() => {}),
};

export default kvStorage;
