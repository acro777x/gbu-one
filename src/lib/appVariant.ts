import Constants from 'expo-constants';

/**
 * Returns true if this instance is running as the dedicated Admin APK (in.gbu.one.admin).
 * Returns false if running as the Public Student APK (in.gbu.one).
 *
 * In the public APK, all admin routes, buttons, credentials, moderation tools,
 * and admin navigation are completely excluded.
 */
export function isAdminApp(): boolean {
  if (process.env.EXPO_PUBLIC_APP_VARIANT === 'admin') return true;
  if (process.env.EXPO_PUBLIC_APP_VARIANT === 'public') return false;

  const pkg = Constants.expoConfig?.android?.package;
  return pkg === 'in.gbu.one.admin';
}
