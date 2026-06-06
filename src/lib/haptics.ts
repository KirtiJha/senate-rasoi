import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Thin haptics wrapper — gives native (iOS/Android) a tactile feel on key
// actions, and is a safe no-op on web.
const enabled = Platform.OS !== 'web';

export const haptics = {
  tap() {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  select() {
    if (enabled) Haptics.selectionAsync().catch(() => {});
  },
  success() {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warning() {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};
