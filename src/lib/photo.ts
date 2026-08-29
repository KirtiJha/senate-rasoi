import * as ImagePicker from 'expo-image-picker';
import { Linking, Platform } from 'react-native';

/**
 * One guarded way to open the photo picker.
 *
 * WHY THIS EXISTS
 * There were 20 direct `launchImageLibraryAsync` calls in the app and not one
 * of them was wrapped. When the call rejected — the user declines the Android
 * permission dialog, the OS picker is unavailable, the activity is destroyed
 * while backgrounded — nothing caught it. The screen did not toast, did not
 * log, did not change. "Add a photo" simply did nothing, which is the single
 * most common way an app looks broken to the person using it.
 *
 * `launchImageLibraryAsync` needs no permission of its own (the platform photo
 * picker runs out of process), so this deliberately does NOT pre-request one —
 * that would add a dialog the user does not need. It exists to make failure
 * visible, not to add ceremony.
 *
 * Returns the same shape as ImagePicker so call sites keep their existing
 * `result.canceled` / `result.assets[0].uri` handling: a failure is reported
 * through the handler below and then reads as a cancel.
 */

type ErrorHandler = (message: string) => void;

let reportError: ErrorHandler = (message) => console.warn('[photo] ' + message);

/**
 * Point photo-picker failures at the app's toast. Called once from the root
 * layout — a module-level handler rather than a hook so that `pickPhoto` stays
 * callable from plain event handlers, exactly like the API it replaces.
 */
export function setPhotoErrorHandler(handler: ErrorHandler) {
  reportError = handler;
}

const CANCELLED: ImagePicker.ImagePickerResult = { canceled: true, assets: null };

export async function openPhotoPicker(
  options?: ImagePicker.ImagePickerOptions,
): Promise<ImagePicker.ImagePickerResult> {
  try {
    return await ImagePicker.launchImageLibraryAsync(options);
  } catch (e) {
    console.error('[photo] picker failed', e);
    reportError(
      Platform.OS === 'android'
        ? "Couldn't open your photos. Check Aangan's permissions in Settings."
        : "Couldn't open your photos. Try again.",
    );
    return CANCELLED;
  }
}

/** Same guard for the document picker on the Documents screen. */
export async function openAppSettings() {
  try {
    await Linking.openSettings();
  } catch (e) {
    console.error('[photo] could not open settings', e);
  }
}
