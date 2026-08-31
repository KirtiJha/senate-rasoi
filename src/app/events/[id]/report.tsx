import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Container, ScreenHeader } from '../../../components/ui';
import { useAuth } from '../../../context/auth';
import {
  Contribution, EVENT_STATUS_META, EXPENSE_CATEGORIES, EventTeamMember, Expense, SocietyEvent,
  computeTotals, fetchContributions, fetchEvent, fetchExpenses, fetchTeam, rupees, subscribeEvent,
} from '../../../lib/events';
import { useThemeColors } from '../../../theme';

// Never assume a stored category still exists in the client list — an unknown
// category must fall back, not crash the whole accounts report.
const catMeta = (k: string) =>
  EXPENSE_CATEGORIES.find((x) => x.key === k) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
function openUrl(u: string) { if (Platform.OS === 'web') window.open(u, '_blank'); else Linking.openURL(u); }

/**
 * The transparency report. Deliberately a LIVE VIEW over the two ledgers rather
 * than an authored document — it cannot drift from what actually happened, and
 * it exists from day one instead of only at the end.
 *
 * Every resident can open this. That is the point.
 */
export default function EventReportScreen() {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();

  const [event, setEvent] = useState<SocietyEvent | null>(null);
  const [team, setTeam] = useState<EventTeamMember[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllFlats, setShowAllFlats] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [ev, t, cs, ex] = await Promise.all([
        fetchEvent(id),
        fetchTeam(id).catch(() => []),
        fetchContributions(id).catch(() => []),
        fetchExpenses(id).catch(() => []),
      ]);
      setEvent(ev); setTeam(t); setContributions(cs); setExpenses(ex);
    } catch { /* keep */ } finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => {
    load();
    return id ? subscribeEvent(id, load) : undefined;
  }, [load, id]));

  if (loading) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="stats-chart-outline" title="Accounts" showBack hideSociety />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={c.muted} /></View>
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="stats-chart-outline" title="Accounts" showBack hideSociety />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color={c.faint} />
          <Text className="mt-3 text-center font-sans-bold text-[16px] text-ink">Celebration removed</Text>
        </View>
      </View>
    );
  }

  const t = computeTotals(event, contributions, expenses);
  const paid = contributions.filter((x) => x.status === 'received');
  const unpaid = contributions.filter((x) => x.status === 'pending' || x.status === 'initiated');
  const treasurer = team.find((x) => x.role === 'treasurer') ?? team.find((x) => x.role === 'lead');
  const maxCat = t.byCategory[0]?.amount ?? 1;
  const isFinal = event.status === 'completed';

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="stats-chart-outline" title="Accounts" showBack hideSociety />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* Heading */}
          <Text className="font-display-x text-[22px] text-ink">{event.title}</Text>
          <Text className="font-sans mt-0.5 text-[13px] text-muted">
            {isFinal ? 'Final accounts' : 'Live accounts — updating as money moves'}
            {event.event_date ? ` · ${event.event_date}` : ''}
          </Text>

          {/* Headline numbers */}
          <View className="mt-4 overflow-hidden card">
            <View style={{ height: 4, backgroundColor: ACCENT }} />
            <View className="p-4">
              <View className="flex-row">
                <BigStat label="Collected" value={rupees(t.collected)} color={c.accent} />
                <BigStat label="Spent" value={rupees(t.spent)} color={c.danger} />
              </View>
              <View className="mt-3 border-t border-line pt-3">
                <Text className="font-sans text-[11px] text-faint">Balance remaining</Text>
                <Text className="font-sans-bold text-[26px]" style={{ color: t.balance < 0 ? '#EF4444' : ACCENT }}>
                  {rupees(t.balance)}
                </Text>
                {t.balance < 0 ? (
                  <Text className="font-sans mt-0.5 text-[12px] text-nonveg">
                    Spending has exceeded what's been collected.
                  </Text>
                ) : null}
              </View>

              {t.budget != null ? (
                <Text className="font-sans mt-2 text-[12px] text-muted">
                  Planned budget was {rupees(t.budget)}
                  {t.spent > t.budget ? ` · over by ${rupees(t.spent - t.budget)}` : ''}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Who collected it — never let the app look like it holds money */}
          {treasurer ? (
            <View className="mt-3 flex-row items-start gap-2 rounded-2xl border border-line bg-inset px-3.5 py-3">
              <Ionicons name="information-circle-outline" size={16} color={c.muted} />
              <Text className="font-sans flex-1 text-[12px] leading-[17px] text-muted">
                Collected and held by{' '}
                <Text className="font-sans-sb text-ink">
                  {treasurer.profile?.name ?? 'the treasurer'}
                  {treasurer.profile?.flat ? `, ${treasurer.profile.flat}` : ''}
                </Text>
                . Aangan does not hold any money — it only keeps this record.
              </Text>
            </View>
          ) : null}

          {/* Where it went */}
          {t.byCategory.length ? (
            <View className="mt-5">
              <Text className="mb-2 px-1 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
                Where the money went
              </Text>
              <View className="card p-4">
                {t.byCategory.map((row) => {
                  const meta = catMeta(row.category);
                  const pct = Math.round((row.amount / maxCat) * 100);
                  return (
                    <View key={row.category} className="mb-3 last:mb-0">
                      <View className="mb-1 flex-row items-center gap-1.5">
                        <Ionicons name={meta.icon as any} size={12} color={c.accent} />
                        <Text className="font-sans flex-1 text-[13px] text-ink">{meta.label}</Text>
                        <Text className="text-[13px] font-sans-sb text-ink">{rupees(row.amount)}</Text>
                      </View>
                      <View className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: c.inset }}>
                        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.accent }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Every expense with its bill */}
          <View className="mt-5">
            <Text className="mb-2 px-1 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
              Every expense ({expenses.length})
            </Text>
            {expenses.length === 0 ? (
              <Text className="font-sans px-1 text-[13px] text-faint">Nothing spent yet.</Text>
            ) : (
              <View className="gap-2">
                {expenses.map((e) => {
                  const meta = catMeta(e.category);
                  return (
                    <View key={e.id} className="card p-3.5">
                      <View className="flex-row items-center gap-2.5">
                        <View className="h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: c.accentSoft }}>
                          <Ionicons name={meta.icon as any} size={16} color={c.accent} />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="font-sans-sb text-[13px] text-ink" numberOfLines={1}>{e.title}</Text>
                          <Text className="font-sans text-[11px] text-faint" numberOfLines={1}>
                            {e.vendor ? `${e.vendor} · ` : ''}{e.spent_on ?? '—'}
                            {e.paid_by?.name ? ` · paid by ${e.paid_by.name}` : ''}
                          </Text>
                        </View>
                        <Text className="font-sans-bold text-[14px] text-ink">{rupees(Number(e.amount))}</Text>
                      </View>
                      {e.receipt_url ? (
                        <Pressable
                          onPress={() => openUrl(e.receipt_url!)}
                          className="mt-2 flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 active:opacity-70"
                          style={{ backgroundColor: c.inset }}
                        >
                          <Ionicons name="document-attach-outline" size={12} color={c.muted} />
                          <Text className="text-[11px] font-sans-sb text-muted">View bill</Text>
                        </Pressable>
                      ) : (
                        <Text className="font-sans mt-1.5 text-[11px]" style={{ color: '#B45309' }}>No bill attached</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Who contributed */}
          <View className="mt-5">
            <Text className="mb-2 px-1 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
              Contributions ({t.flatsPaid} flat{t.flatsPaid === 1 ? '' : 's'})
            </Text>
            <View className="card p-4">
              {paid.length === 0 ? (
                <Text className="font-sans text-[13px] text-faint">Nothing collected yet.</Text>
              ) : (
                (showAllFlats ? paid : paid.slice(0, 12)).map((row) => (
                  <View key={row.id} className="mb-2 flex-row items-center gap-2 last:mb-0">
                    <Text className="w-16 text-[12px] font-sans-sb text-ink">{row.flat}</Text>
                    <Text className="font-sans flex-1 text-[12px] text-muted" numberOfLines={1}>
                      {row.contributor?.name ?? '—'}
                      {row.method ? ` · ${row.method}` : ''}
                    </Text>
                    <Text className="text-[12px] font-sans-sb" style={{ color: '#16A34A' }}>
                      {rupees(Number(row.amount))}
                    </Text>
                  </View>
                ))
              )}

              {paid.length > 12 ? (
                <Pressable onPress={() => setShowAllFlats((v) => !v)} hitSlop={6} className="mt-2">
                  <Text className="text-[12px] font-sans-sb" style={{ color: ACCENT }}>
                    {showAllFlats ? 'Show less' : `Show all ${paid.length}`}
                  </Text>
                </Pressable>
              ) : null}

              {unpaid.length > 0 ? (
                <Text className="font-sans mt-3 border-t border-line pt-3 text-[12px] text-muted">
                  {unpaid.length} {unpaid.length === 1 ? 'flat has' : 'flats have'} not contributed yet
                  {' '}({rupees(t.pending)} expected).
                </Text>
              ) : null}
            </View>
          </View>

          <Text className="font-sans mt-6 text-center text-[11px] leading-[16px] text-faint">
            {isFinal
              ? 'These accounts are final and can no longer be edited.'
              : 'These figures update live as contributions and bills are recorded.'}
          </Text>
        </Container>
      </ScrollView>
    </View>
  );
}

function BigStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="flex-1">
      <Text className="font-sans text-[11px] text-faint">{label}</Text>
      <Text className="font-sans-bold text-[19px]" style={{ color }}>{value}</Text>
    </View>
  );
}
