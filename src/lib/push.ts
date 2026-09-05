import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { captureException } from './crash';
import { supabase } from './supabase';

// Free push via Expo. Tokens only exist on native builds (iOS/Android) on a real
// device; on web this is a no-op (in-app realtime + tap-to-WhatsApp cover web).

/**
 * Android notification channels.
 *
 * Android decides whether a notification interrupts by its CHANNEL, not by the
 * message. There used to be one — "Order updates", at DEFAULT importance — so
 * a blood request could not heads-up, and nobody could mute the marketplace at
 * the OS level. These four are what the server names (0136); the importance
 * here is what makes the name mean anything.
 */
export const CHANNELS = [
  { id: 'urgent',   name: 'Emergency & blood',   description: 'Blood requests and society emergencies. Always interrupts.', importance: Notifications.AndroidImportance.MAX },
  { id: 'messages', name: 'Messages',            description: 'Direct messages, group chat and orders on your dishes.',    importance: Notifications.AndroidImportance.HIGH },
  { id: 'mine',     name: 'Things for you',      description: 'Requests, results and reminders addressed to you.',        importance: Notifications.AndroidImportance.HIGH },
  { id: 'society',  name: 'Society noticeboard', description: 'New listings, dishes, polls, events and notices.',        importance: Notifications.AndroidImportance.DEFAULT },
] as const;

export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  for (const ch of CHANNELS) {
    await Notifications.setNotificationChannelAsync(ch.id, {
      name: ch.name,
      description: ch.description,
      importance: ch.importance,
      sound: 'default',
      vibrationPattern: ch.id === 'urgent' ? [0, 400, 200, 400] : [0, 250],
      enableVibrate: true,
    });
  }
  // The old single channel had a name from another era. Removing it takes its
  // settings row out of the system UI; anything still addressed to it falls
  // back to the app default.
  try { await Notifications.deleteNotificationChannelAsync('default'); } catch { /* already gone */ }
}

const ASKED_KEY = 'aangan:push-asked';

/** True when we may deliver pushes right now, without prompting. */
export async function hasPushPermission(): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Whether it is worth showing the system prompt: never asked, or Android
 * (which can be asked again), or iOS still undetermined. iOS grants one system
 * prompt; after a decline only Settings can change it.
 */
export async function canAskForPush(): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice) return false;
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return false;
  const asked = await AsyncStorage.getItem(ASKED_KEY);
  return canAskAgain !== false && !asked;
}

/**
 * Upload this device's token. Only when permission is already granted — this
 * never shows the system prompt. Asking is the pre-prompt's job (PushPrompt),
 * at a moment the resident has just done something a notification would
 * follow from.
 */
export async function registerPush(userId: string): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  try {
    if (!(await hasPushPermission())) return;
    await ensureChannels();

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await supabase.from('push_tokens').upsert({ user_id: userId, token, platform: Platform.OS });
  } catch (e) {
    // Push is best-effort; never block the app on it.
    captureException(e, { source: 'registerPush' });
  }
}

/** Show the system prompt (once), then register if granted. */
export async function requestPush(userId: string): Promise<'granted' | 'denied'> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'denied';
  await AsyncStorage.setItem(ASKED_KEY, new Date().toISOString());
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return 'denied';
  await registerPush(userId);
  return 'granted';
}
