import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Container, ScreenHeader } from '../components/ui';
import { useAuth } from '../context/auth';
import {
  EVENT_STATUS_META, SocietyEvent, fetchEvents,
} from '../lib/events';
import { useThemeColors } from '../theme';


export default function EventsScreen() {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const router = useRouter();
  const { communityId, isAdmin } = useAuth();

  const [rows, setRows] = useState<SocietyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setRows(await fetchEvents(communityId)); }
    catch { /* keep */ } finally { setLoading(false); }
  }, [communityId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const today = new Date().toLocaleDateString('en-CA');
  const { upcoming, past } = useMemo(() => {
    const up: SocietyEvent[] = [];
    const pa: SocietyEvent[] = [];
    for (const e of rows) {
      if (e.status === 'completed' || e.status === 'cancelled') pa.push(e);
      else if (e.event_date && e.event_date < today) pa.push(e);
      else up.push(e);
    }
    // Soonest first for upcoming; most recent first for past.
    up.sort((a, b) => (a.event_date ?? '9999').localeCompare(b.event_date ?? '9999'));
    return { upcoming: up, past: pa };
  }, [rows, today]);

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="sparkles-outline"
        title="Functions"
        showBack
        onAdd={isAdmin ? () => router.push('/events/new' as any) : undefined}
        addLabel="New"
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container>
          {loading ? (
            <View className="items-center py-16"><ActivityIndicator color={c.muted} /></View>
          ) : rows.length === 0 ? (
            <View className="items-center py-20">
              <Text style={{ fontSize: 44 }} className="mb-3">🎉</Text>
              <Text className="font-display text-xl text-ink mb-1">No functions yet</Text>
              <Text className="font-sans max-w-xs text-center text-[14px] text-muted">
                Diwali, Ganesh Chaturthi, Holi — plan it here, collect contributions,
                track every bill, and publish the accounts to everyone.
              </Text>
              {isAdmin ? (
                <Pressable
                  onPress={() => router.push('/events/new' as any)}
                  className="mt-6 rounded-2xl px-5 py-3 active:opacity-80"
                  style={{ backgroundColor: ACCENT }}
                >
                  <Text className="font-sans-sb text-[14px] text-white">Plan a function</Text>
                </Pressable>
              ) : (
                <Text className="font-sans mt-4 text-[12px] text-faint">Your society admin can start one.</Text>
              )}
            </View>
          ) : (
            <>
              {upcoming.length ? (
                <>
                  <Text className="mb-3 px-1 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
                    Upcoming
                  </Text>
                  <View className="mb-6 gap-3">
                    {upcoming.map((e) => <EventCard key={e.id} e={e} />)}
                  </View>
                </>
              ) : null}

              {past.length ? (
                <>
                  <Text className="mb-3 px-1 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
                    Past
                  </Text>
                  <View className="gap-3">
                    {past.map((e) => <EventCard key={e.id} e={e} />)}
                  </View>
                </>
              ) : null}
            </>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function EventCard({ e }: { e: SocietyEvent }) {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const router = useRouter();
  const meta = EVENT_STATUS_META[e.status];

  return (
    <Pressable
      onPress={() => router.push(`/events/${e.id}` as any)}
      className="overflow-hidden rounded-2xl border bg-surface active:opacity-90"
      style={{ borderColor: c.line }}
    >
      <View style={{ height: 4, backgroundColor: c.accent }} />
      <View className="p-4">
        <View className="mb-1.5 flex-row flex-wrap items-center gap-1.5">
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: c.accentSoft }}>
            <Text className="text-[10px] font-sans-sb" style={{ color: c.accent }}>{meta.label}</Text>
          </View>
          {e.event_date ? (
            <Text className="font-sans text-[11px] text-faint">{formatDate(e.event_date)}</Text>
          ) : null}
        </View>

        <Text className="font-sans-bold text-[16px] text-ink" numberOfLines={1}>{e.title}</Text>
        {e.description ? (
          <Text className="font-sans mt-0.5 text-[13px] text-muted" numberOfLines={2}>{e.description}</Text>
        ) : null}

        <View className="mt-2 flex-row items-center gap-3">
          {e.venue ? (
            <View className="flex-row items-center gap-1">
              <Ionicons name="location-outline" size={12} color={c.faint} />
              <Text className="font-sans text-[11px] text-faint" numberOfLines={1}>{e.venue}</Text>
            </View>
          ) : null}
          {e.suggested_contribution != null ? (
            <View className="flex-row items-center gap-1">
              <Ionicons name="wallet-outline" size={12} color={c.faint} />
              <Text className="font-sans text-[11px] text-faint">₹{e.suggested_contribution} / flat</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function formatDate(d: string): string {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return d; }
}
