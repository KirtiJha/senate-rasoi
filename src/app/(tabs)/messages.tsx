import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { Avatar, Button, ErrorState, RowSkeleton, ScreenHeader } from '../../components/ui';
import { Empty } from '../../components/Empty';
import { useAuth } from '../../context/auth';
import { InboxThread, fetchInbox, subscribeToInbox } from '../../lib/dm';
import { qk } from '../../lib/queryClient';
import { useThemeColors, layout } from '../../theme';

/**
 * The inbox, from the cache first.
 *
 * This screen used to fetch on every focus and hold the result in local
 * state, so coming back from a thread meant a skeleton and a round-trip
 * before the list you had just been looking at reappeared. It reads the
 * cache now: the list is on screen in the same frame, and a refetch runs
 * behind it. Realtime no longer refetches by hand — it invalidates the key
 * and the query does the rest.
 */
export default function MessagesInboxScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const inbox = useQuery({
    queryKey: qk.inbox(userId ?? ''),
    queryFn: () => fetchInbox(userId!),
    enabled: !!userId,
  });

  useFocusEffect(useCallback(() => {
    if (!userId) return undefined;
    const key = qk.inbox(userId);
    queryClient.invalidateQueries({ queryKey: key });
    return subscribeToInbox(() => queryClient.invalidateQueries({ queryKey: key }));
  }, [userId, queryClient]));

  const threads: InboxThread[] = inbox.data ?? [];
  const loading = inbox.isPending;
  const failed = inbox.isError && !inbox.data;

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="mail-outline"
        title="Messages"
        hideSociety
        onAdd={() => router.push('/messages/new' as any)}
        addLabel="New message"
      />

      {/* Virtualised: an inbox grows without bound, and a ScrollView drew
          every thread on each visit. */}
      <FlashList
        data={threads}
        keyExtractor={(t) => t.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={inbox.isFetching && !loading} onRefresh={() => inbox.refetch()} />}
        ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
        ListEmptyComponent={
          <View className="w-full self-center" style={{ maxWidth: layout.maxContent }}>
            {loading ? (
              <View className="overflow-hidden card"><RowSkeleton count={6} /></View>
            ) : failed ? (
              <ErrorState
                title="Couldn't load your messages"
                message="Nothing has been lost — we just couldn't reach them. Try again."
                onRetry={() => inbox.refetch()}
                retrying={inbox.isFetching}
              />
            ) : (
              <Empty
                icon="chatbubbles-outline"
                title="No messages yet"
                action={<Button label="New message" icon="create-outline" onPress={() => router.push('/messages/new' as any)} />}
              >
                Start a private conversation with a neighbour — or open their profile and tap Message.
              </Empty>
            )}
          </View>
        }
        renderItem={({ item: t }) => (
          <View className="w-full self-center" style={{ maxWidth: layout.maxContent }}>
            <Pressable
              onPress={() => router.push(`/messages/${t.id}` as any)}
              className="flex-row items-center gap-3 rounded-2xl p-3 active:bg-inset"
              accessibilityRole="button"
              accessibilityLabel={`Conversation with ${t.other.name}`}
            >
              <Avatar name={t.other.name} userId={t.other.id} size={46} />
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="flex-1 font-sans-bold text-[15px] text-ink" numberOfLines={1}>
                    {t.other.name}{t.other.flat ? <Text className="font-sans-md text-[12px] text-faint"> · Flat {t.other.flat}</Text> : null}
                  </Text>
                  <Text className="font-sans text-[11px] text-faint">{timeAgo(t.lastMessageAt)}</Text>
                </View>
                <Text className="font-sans mt-0.5 text-[13px] text-muted" numberOfLines={1}>
                  {t.lastMessage ?? 'Say hello 👋'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={c.faint} />
            </Pressable>
          </View>
        )}
      />
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
