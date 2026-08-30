import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAuth } from '../../context/auth';
import { useConfirm } from '../../context/confirm';
import { useToast } from '../../context/toast';
import { AskSession, deleteSession, fetchSessions } from '../../lib/askSessions';
import { haptics } from '../../lib/haptics';
import { useThemeColors } from '../../theme';
import { Sheet, Touchable } from '../ui';

/**
 * Past conversations.
 *
 * Chats have been written to ask_sessions since the tables landed, with
 * nothing to reopen them — which made the storage pointless: a record nobody
 * can reach is the same as no record.
 *
 * Ordered by last activity rather than creation, so a chat you return to rises
 * back to where you left it instead of sinking under newer, shorter ones.
 * Titles come from the first question, which is what people actually remember
 * a conversation by.
 */
export function HistorySheet({
  visible,
  onClose,
  onOpen,
  currentId,
}: {
  visible: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
  currentId: string | null;
}) {
  const c = useThemeColors();
  const toast = useToast();
  const confirm = useConfirm();
  const { userId } = useAuth();

  const [sessions, setSessions] = useState<AskSession[] | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try { setSessions(await fetchSessions(userId)); }
    catch { setSessions([]); }
  }, [userId]);

  // Reloaded on open rather than once: the list is stale the moment you have
  // said anything since last looking at it.
  useEffect(() => { if (visible) load(); }, [visible, load]);

  const remove = async (s: AskSession) => {
    const ok = await confirm({
      title: 'Delete this chat?',
      message: s.title ?? 'This conversation',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    // Optimistic: a delete you have already confirmed should not make you wait
    // to see it gone.
    setSessions((prev) => (prev ?? []).filter((x) => x.id !== s.id));
    try { await deleteSession(s.id); } catch { toast.show('Could not delete that chat'); load(); }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Your chats">
      {sessions === null ? (
        <View className="items-center py-10">
          <ActivityIndicator color={c.accent} />
        </View>
      ) : sessions.length === 0 ? (
        <View className="items-center px-6 py-10">
          <Ionicons name="chatbubbles-outline" size={30} color={c.subtle} />
          <Text className="mt-3 font-sans-sb text-[15px] text-ink">No chats yet</Text>
          <Text className="font-sans mt-1 text-center text-[13px] text-subtle">
            Ask Saathi something and it will be saved here.
          </Text>
        </View>
      ) : (
        <View className="gap-1 pb-2">
          {sessions.map((s) => {
            const current = s.id === currentId;
            return (
              <View key={s.id} className="flex-row items-center gap-1">
                <View style={{ flex: 1 }}>
                  <Touchable
                    haptic={null}
                    onPress={() => { haptics.select(); onOpen(s.id); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: current }}
                    accessibilityLabel={s.title ?? 'Untitled chat'}
                  >
                    <View
                      pointerEvents="none"
                      className="flex-row items-center gap-2.5 rounded-xl px-3 py-2.5"
                      style={{ backgroundColor: current ? c.accentSoft : 'transparent' }}
                    >
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={16}
                        color={current ? c.accent : c.subtle}
                      />
                      <View className="min-w-0 flex-1">
                        <Text
                          className="text-[14px] font-sans-md"
                          numberOfLines={1}
                          style={{ color: current ? c.accent : c.ink }}
                        >
                          {s.title ?? 'Untitled chat'}
                        </Text>
                        <Text className="mt-0.5 text-[11.5px] font-sans" style={{ color: c.subtle }}>
                          {relativeDay(s.updated_at)}
                        </Text>
                      </View>
                    </View>
                  </Touchable>
                </View>

                <Touchable
                  haptic={null}
                  onPress={() => remove(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${s.title ?? 'chat'}`}
                >
                  <View pointerEvents="none" className="h-9 w-9 items-center justify-center rounded-full">
                    <Ionicons name="trash-outline" size={15} color={c.subtle} />
                  </View>
                </Touchable>
              </View>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

/** "Today" / "Yesterday" / a date — people locate a chat by when, not by clock time. */
function relativeDay(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const days = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) / 86400000,
  );
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
