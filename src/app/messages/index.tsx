import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Container, ScreenHeader } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { InboxThread, fetchInbox, subscribeToInbox } from '../../lib/dm';
import { useThemeColors } from '../../theme';

export default function MessagesInboxScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();

  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      setThreads(await fetchInbox(userId));
    } catch { toast.show('Could not load messages'); }
    finally { setLoading(false); }
  }, [userId, toast]);

  // Reload whenever the inbox regains focus (e.g. back from a thread).
  useFocusEffect(useCallback(() => {
    load();
    const unsub = subscribeToInbox(load);
    return unsub;
  }, [load]));

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="mail-outline" title="Messages" showBack onAdd={() => router.push('/messages/new' as any)} addLabel="New message" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {loading ? (
            <Text className="py-10 text-center text-[14px] text-muted">Loading…</Text>
          ) : threads.length === 0 ? (
            <View className="items-center px-6 py-20">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-inset">
                <Ionicons name="chatbubbles-outline" size={30} color={c.faint} />
              </View>
              <Text className="mb-1.5 font-display text-xl text-ink">No messages yet</Text>
              <Text className="mb-5 max-w-xs text-center text-[14px] leading-6 text-muted">
                Start a private conversation with a neighbour — or open their profile and tap Message.
              </Text>
              <Button label="New message" icon="create-outline" onPress={() => router.push('/messages/new' as any)} />
            </View>
          ) : (
            <View style={{ gap: 4 }}>
              {threads.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => router.push(`/messages/${t.id}` as any)}
                  className="flex-row items-center gap-3 rounded-2xl p-3 active:bg-inset"
                >
                  <Avatar name={t.other.name} size={46} />
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="flex-1 font-sans-bold text-[15px] text-ink" numberOfLines={1}>
                        {t.other.name}{t.other.flat ? <Text className="font-sans-md text-[12px] text-faint"> · Flat {t.other.flat}</Text> : null}
                      </Text>
                      <Text className="text-[11px] text-faint">{timeAgo(t.lastMessageAt)}</Text>
                    </View>
                    <Text className="mt-0.5 text-[13px] text-muted" numberOfLines={1}>
                      {t.lastMessage ?? 'Say hello 👋'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
