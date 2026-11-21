/**
 * A student-picked alarm ringtone, played while GBU One is OPEN.
 *
 * Android 8+ ties a notification's sound to a NotificationChannel, and a
 * channel is immutable after creation. Its sound must be a raw resource
 * bundled at BUILD time - a song picked at runtime cannot be used as the OS
 * alarm sound. So there are two layers, and the UI must say so honestly:
 *
 *   1. When the app is CLOSED, Android plays the bundled official
 *      `class_alarm` through the high-priority `class_reminders` channel.
 *      That is the guaranteed wake-up and it is not changed here.
 *   2. When the app is OPEN and an alarm rings, this module plays the
 *      student's song from the FIRST SECOND to THIRTY SECONDS, then starts
 *      over - a loop of the first 30 seconds.
 *
 * Nothing here can make a force-stopped app ring: Android cancels its
 * alarms on force-stop. A swipe-away (background kill) is fine because the
 * OS-scheduled notification is still held by AlarmManager.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

export const CUSTOM_RINGTONE_KEY = '@gbu_one_custom_ringtone_uri';
/** Only the first 30 seconds are played, then it starts again. */
export const CLIP_SECONDS = 30;
const TICK_MS = 250;

let player: AudioPlayer | null = null;
let watcher: ReturnType<typeof setInterval> | null = null;

/** The saved ringtone URI, or null when the official sound is in use. */
export async function getCustomRingtoneUri(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(CUSTOM_RINGTONE_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * Lets the student pick an audio file and copies it into the app's own
 * documents directory, so the permission survives the picker's cache being
 * cleared. Returns the persisted file URI.
 */
export async function pickCustomRingtone(): Promise<{ uri: string; name: string } | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets?.length) return null;
  const asset = picked.assets[0];
  const safeName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  // expo-file-system 19 replaced documentDirectory/copyAsync with File+Paths.
  const target = new File(Paths.document, `ringtone_${Date.now()}_${safeName}`);
  target.create();
  new File(asset.uri).copy(target);
  await AsyncStorage.setItem(CUSTOM_RINGTONE_KEY, target.uri);
  return { uri: target.uri, name: asset.name };
}

/** Removes a custom ringtone and returns to the official university sound. */
export async function clearCustomRingtone(): Promise<void> {
  const existing = await getCustomRingtoneUri();
  stopRingtone();
  await AsyncStorage.removeItem(CUSTOM_RINGTONE_KEY);
  if (existing) {
    try {
      new File(existing).delete();
    } catch {
      // The file may already be gone; the preference is what matters.
    }
  }
}

/**
 * Plays the first CLIP_SECONDS of the file, then seeks back to zero and
 * plays again. Stops cleanly if the student snoozes or dismisses.
 */
export function startRingtone(uri: string): void {
  stopRingtone();
  try {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
    });
    player = createAudioPlayer({ uri });
    player.loop = false;
    player.play();
    watcher = setInterval(() => {
      if (!player) return;
      try {
        if (player.currentTime >= CLIP_SECONDS) {
          void player.seekTo(0);
          player.play();
        }
      } catch {
        stopRingtone();
      }
    }, TICK_MS);
  } catch {
    stopRingtone();
  }
}

/** Stops playback and releases the audio player. Safe to call repeatedly. */
export function stopRingtone(): void {
  if (watcher) {
    clearInterval(watcher);
    watcher = null;
  }
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch {
      // The player may already have been released.
    }
    player = null;
  }
}
