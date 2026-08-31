import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { useAuth } from '../../context/auth';
import {
  FEEDBACK_FLOW,
  FEEDBACK_KINDS,
  FEEDBACK_STATUS,
  FeedbackItem,
  FeedbackStatus,
  fetchFeedbackCounts,
  fetchFeedbackQueue,
} from '../../lib/feedback';
import { useThemeColors } from '../../theme';
import { Badge, Container, ErrorState, ScreenHeader, Touchable } from '../../components/ui';

/**
 * The queue.
 *
 * Sorted so untouched reports come first and finished ones sink — a dashboard
 * that buries this week's open bugs under last month's fixed ones stops being
 * opened, and then the reports stop being answered, and then they stop coming.
 *
 * Deliberately not a table of counts. The number of open bugs is not the job;
 * the list of them is, so the counts are one row at the top and the reports
 * take the rest of the screen.
 */
export default function AdminFeedbackScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const { communityId, isAdmin } = useAuth();

  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [counts, setCounts] = useState<Record<FeedbackStatus, number> | null>(null);
  const [filter, setFilter] = useState<FeedbackStatus | null>(null);

  const load = useCallback(async () => {
    if (!communityId) return;
    try {
      const [q, n] = await Promise.all([
        fetchFeedbackQueue(communityId, filter ? { status: filter } : undefined),
        fetchFeedbackCounts(communityId),
      ]);
      setItems(q);
      setCounts(n);
    } catch {
      setItems([]);
    }
  }, [communityId, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!isAdmin) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader title="Resident feedback" showBack backHref="/settings" />
        <ErrorState message="Only society admins can open this." />
      </View>
    );
  }

  const open = (counts?.open ?? 0) + (counts?.in_progress ?? 0);

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader title="Resident feedback" showBack backHref="/settings" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          <Text className="font-sans mb-3 text-[13.5px]" style={{ color: c.subtle }}>
            {open === 0
              ? 'Nothing waiting on you.'
              : `${open} report${open === 1 ? '' : 's'} waiting on a reply.`}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            className="mb-4" contentContainerStyle={{ gap: 6 }}>
            {([null, ...FEEDBACK_FLOW] as (FeedbackStatus | null)[]).map((s) => {
              const on = filter === s;
              const label = s === null ? 'All' : FEEDBACK_STATUS[s].label;
              const n = s === null ? null : counts?.[s] ?? 0;
              return (
                <Touchable key={s ?? 'all'} onPress={() => setFilter(s)}
                  accessibilityRole="button" accessibilityLabel={label}>
                  <View pointerEvents="none" className="rounded-full px-3.5 py-2"
                    style={{
                      backgroundColor: on ? c.accent : c.inset,
                      borderWidth: 1,
                      borderColor: on ? c.accent : c.line,
                    }}>
                    <Text className="font-sans-sb text-[12.5px]" style={{ color: on ? c.onAccent : c.muted }}>
                      {label}{n !== null ? ` ${n}` : ''}
                    </Text>
                  </View>
                </Touchable>
              );
            })}
          </ScrollView>

          {items === null ? (
            <View className="items-center py-10"><ActivityIndicator color={c.accent} /></View>
          ) : items.length === 0 ? (
            <Text className="font-sans py-8 text-center text-[13px]" style={{ color: c.faint }}>
              Nothing here.
            </Text>
          ) : (
            items.map((it) => (
              <Touchable key={it.id} onPress={() => router.push(`/feedback/${it.id}` as never)}
                accessibilityRole="button" accessibilityLabel={it.title}>
                <View pointerEvents="none" className="mb-2 card p-3.5">
                  <View className="flex-row items-start gap-2">
                    <View style={{ flex: 1 }}>
                      <Text className="font-sans-sb text-[14.5px] text-ink" numberOfLines={2}>{it.title}</Text>
                      <Text className="font-sans mt-0.5 text-[12px]" style={{ color: c.faint }}>
                        {FEEDBACK_KINDS.find((k) => k.key === it.kind)?.label}
                        {it.author?.name ? ` · ${it.author.name}` : ''}
                        {it.author?.flat ? ` · ${it.author.flat}` : ''}
                      </Text>
                    </View>
                    <Badge label={FEEDBACK_STATUS[it.status].label} tone={FEEDBACK_STATUS[it.status].tone} />
                  </View>
                </View>
              </Touchable>
            ))
          )}
        </Container>
      </ScrollView>
    </View>
  );
}
