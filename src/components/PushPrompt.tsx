import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Linking, Platform, Text, View } from 'react-native';

import { useAuth } from '../context/auth';
import { canAskForPush, requestPush } from '../lib/push';
import { useThemeColors } from '../theme';
import { Button, Sheet } from './ui';

/**
 * Asking for notifications at a moment that earns it.
 *
 * The system prompt used to fire the instant someone signed in — before the
 * app had shown them a single thing a notification would follow from. iOS
 * grants that prompt once; decline it and only Settings can undo it, and
 * "asked at sign-in" is the timing most likely to be declined.
 *
 * Now the prompt is offered right after something that would produce one:
 * you sent a message (they will reply), you posted (people will respond), you
 * joined a group (there will be games). One line says what you would get,
 * with a plain "Not now" — and the system prompt only follows a yes.
 */
type Reason = 'message' | 'post' | 'group' | 'general';

const COPY: Record<Reason, { title: string; body: string }> = {
  message: { title: 'Know when they reply', body: 'Get a notification when your neighbour writes back, so you are not checking the app for it.' },
  post:    { title: 'Hear what neighbours say', body: 'Get a notification when someone replies to your post or orders from you.' },
  group:   { title: 'Never miss a game', body: 'Get told when a session is booked, when it needs players, and the evening before.' },
  general: { title: 'Stay in the loop', body: 'Messages, requests and society notices reach you as they happen — and you choose which.' },
};

const Ctx = createContext<{ offer: (reason?: Reason) => void }>({ offer: () => {} });

/** Call this after the thing a notification would follow from. */
export function usePushPrompt() {
  return useContext(Ctx);
}

export function PushPromptProvider({ children }: { children: ReactNode }) {
  const c = useThemeColors();
  const { userId } = useAuth();
  const [reason, setReason] = useState<Reason | null>(null);
  const [busy, setBusy] = useState(false);
  const shownThisSession = useRef(false);

  const offer = useCallback((r: Reason = 'general') => {
    // Once per session at most, and only when asking could change anything.
    if (shownThisSession.current || Platform.OS === 'web') return;
    canAskForPush().then((ok) => {
      if (!ok) return;
      shownThisSession.current = true;
      setReason(r);
    }).catch(() => {});
  }, []);

  const accept = async () => {
    if (!userId) { setReason(null); return; }
    setBusy(true);
    try { await requestPush(userId); } finally { setBusy(false); setReason(null); }
  };

  const value = useMemo(() => ({ offer }), [offer]);
  const copy = COPY[reason ?? 'general'];

  return (
    <Ctx.Provider value={value}>
      {children}
      <Sheet visible={reason !== null} onClose={() => setReason(null)} title={copy.title}>
        <View className="mb-4 flex-row items-start gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: c.accent + '1A' }}>
            <Ionicons name="notifications-outline" size={22} color={c.accent} />
          </View>
          <Text className="font-sans flex-1 text-[14.5px] leading-[21px] text-muted">{copy.body}</Text>
        </View>
        <Text className="font-sans mb-4 text-[12.5px] leading-[18px] text-faint">
          You can mute any category later in Settings. Emergency and blood requests always come through.
        </Text>
        <Button label="Turn on notifications" icon="notifications" fullWidth loading={busy} onPress={accept} />
        <View className="mt-2">
          <Button label="Not now" variant="ghost" fullWidth onPress={() => setReason(null)} />
        </View>
      </Sheet>
    </Ctx.Provider>
  );
}

/** For Settings: the way back once the answer was no. */
export function openSystemNotificationSettings(): void {
  Linking.openSettings().catch(() => {});
}
