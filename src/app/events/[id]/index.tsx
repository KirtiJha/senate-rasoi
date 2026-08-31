import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar, Button, Container, ScreenHeader, Segmented, Sheet, Touchable, formatTimeLabel } from '../../../components/ui';
import { DetailsTab } from '../../../components/celebrations/DetailsTab';
import { ProgrammeTab } from '../../../components/celebrations/ProgrammeTab';
import { MoneyTab } from '../../../components/celebrations/MoneyTab';
import { TasksTab } from '../../../components/celebrations/TasksTab';
import { useAuth } from '../../../context/auth';
import { useConfirm } from '../../../context/confirm';
import { useToast } from '../../../context/toast';
import { Resident, fetchDirectory } from '../../../lib/directory';
import {
  Contribution, EVENT_STATUS_META, EventStatus, EventTeamMember, Expense, SocietyEvent, TeamRole,
  Sponsorship,
  computeTotals, deleteEvent, fetchContributions, fetchEvent, fetchExpenses, fetchSponsorships, fetchTeam,
  removeTeamMember, rupees, setTeamMember, subscribeEvent, updateEvent,
} from '../../../lib/events';
import { useThemeColors } from '../../../theme';


const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'details', label: 'Details' },
  { key: 'programme', label: 'Programme' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'money', label: 'Money' },
] as const;

const ROLE_LABEL: Record<TeamRole, string> = {
  lead: 'Lead',
  treasurer: 'Treasurer',
  member: 'Team',
};

export default function EventDetailScreen() {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, communityId, isAdmin } = useAuth();

  const [event, setEvent] = useState<SocietyEvent | null>(null);
  const [team, setTeam] = useState<EventTeamMember[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sponsors, setSponsors] = useState<Sponsorship[]>([]);
  const [loading, setLoading] = useState(true);

  const [showTeam, setShowTeam] = useState(false);
  const [tab, setTab] = useState<'overview' | 'details' | 'programme' | 'tasks' | 'money'>('overview');
  const [showStatus, setShowStatus] = useState(false);
  const [residents, setResidents] = useState<Resident[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const ev = await fetchEvent(id);
      setEvent(ev);
      if (ev) {
        const [t, cs, ex, sp] = await Promise.all([
          fetchTeam(id).catch(() => []),
          fetchContributions(id).catch(() => []),
          fetchExpenses(id).catch(() => []),
          fetchSponsorships(id).catch(() => []),
        ]);
        setTeam(t); setContributions(cs); setExpenses(ex); setSponsors(sp);
      }
    } catch { /* keep */ } finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => {
    load();
    return id ? subscribeEvent(id, load) : undefined;
  }, [load, id]));

  const myRole = team.find((t) => t.user_id === userId)?.role ?? null;
  const isLead = myRole === 'lead' || !!isAdmin;
  // Mirrors can_manage_event() in 0082, so the UI never offers an action the
  // database will refuse.
  const canManage = !!myRole || !!isAdmin;
  const totals = computeTotals(event, contributions, expenses, sponsors);

  const openTeamPicker = async () => {
    setShowTeam(true);
    if (!residents.length && communityId) {
      try { setResidents(await fetchDirectory(communityId, userId, !!isAdmin)); }
      catch { toast.show('Could not load residents'); }
    }
  };

  const changeStatus = async (status: EventStatus) => {
    if (!event) return;
    setShowStatus(false);
    // Completing publishes the accounts to everyone and closes the books.
    if (status === 'completed') {
      const ok = await confirm({
        title: 'Publish the accounts?',
        message: 'Everyone gets the full income and expense report, and contributions and expenses can no longer be edited.',
        confirmLabel: 'Publish',
      });
      if (!ok) return;
    }
    try {
      await updateEvent(event.id, { status });
      setEvent({ ...event, status });
      toast.show(status === 'completed' ? 'Accounts published 📊' : 'Updated ✓');
    } catch { toast.show('Could not update'); }
  };

  const removeEvent = async () => {
    if (!event) return;
    const ok = await confirm({
      title: 'Delete function',
      message: 'This removes the celebration and all its contributions and expenses. This cannot be undone.',
      confirmLabel: 'Delete', destructive: true,
    });
    if (!ok) return;
    try {
      await deleteEvent(event.id);
      router.canGoBack() ? router.back() : router.replace('/events' as any);
    } catch { toast.show('Could not delete'); }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="sparkles-outline" title="Celebration" showBack hideSociety />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={c.muted} /></View>
      </View>
    );
  }

  if (!event) {
    const goBack = () => router.canGoBack() ? router.back() : router.replace('/events' as any);
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="sparkles-outline" title="Celebration" showBack hideSociety />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color={c.faint} />
          <Text className="mt-3 text-center font-sans-bold text-[16px] text-ink">Celebration removed</Text>
          <Pressable onPress={goBack} className="mt-5 rounded-xl border border-line bg-surface px-5 py-2.5 active:bg-inset">
            <Text className="font-sans-sb text-[14px] text-ink">Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const meta = EVENT_STATUS_META[event.status];
  const pct = totals.budget && totals.budget > 0
    ? Math.min(100, Math.round((totals.collected / totals.budget) * 100))
    : null;

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="sparkles-outline"
        title={event.title}
        showBack
        hideSociety
        right={canManage ? (
          <Touchable onPress={() => router.push(`/events/${event.id}/edit` as never)}
            accessibilityRole="button" accessibilityLabel="Edit celebration">
            <View pointerEvents="none" className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: c.inset }}>
              <Ionicons name="pencil" size={15} color={c.muted} />
            </View>
          </Touchable>
        ) : undefined}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          <View className="mb-4">
            <Segmented items={TABS} value={tab} onChange={setTab} />
          </View>

          {tab === 'programme' ? (
            <ProgrammeTab
              eventId={event.id}
              communityId={event.community_id}
              eventDate={event.event_date}
              canManage={canManage}
            />
          ) : tab === 'details' ? (
            <DetailsTab
              eventId={event.id}
              communityId={event.community_id}
              canManage={canManage}
            />
          ) : tab === 'tasks' ? (
            <TasksTab
              eventId={event.id}
              communityId={event.community_id}
              team={team}
              canManage={canManage}
            />
          ) : tab === 'money' ? (
            <MoneyTab
              event={event}
              contributions={contributions}
              totals={totals}
              canManage={canManage}
              onChanged={load}
            />
          ) : (
          <>
          {event.cover_photo_url ? (
            <View className="mb-4 overflow-hidden rounded-2xl" style={{ height: 180, backgroundColor: c.inset }}>
              <Image
                source={{ uri: event.cover_photo_url }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            </View>
          ) : null}

          {/* Status + date */}
          <View className="flex-row flex-wrap items-center gap-1.5">
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.accentSoft }}>
              <Text className="text-[11px] font-sans-sb" style={{ color: c.accent }}>{meta.label}</Text>
            </View>
            {event.event_date ? (
              <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.inset }}>
                <Text className="text-[11px] font-sans-sb text-muted">{formatDate(event.event_date)}</Text>
              </View>
            ) : null}
            {event.start_time ? (
              <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.inset }}>
                <Text className="text-[11px] font-sans-sb text-muted">
                  🕐 {formatTimeLabel(event.start_time.slice(0, 5))}
                  {event.end_time ? ` – ${formatTimeLabel(event.end_time.slice(0, 5))}` : ''}
                </Text>
              </View>
            ) : null}
            {event.venue ? (
              <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.inset }}>
                <Text className="text-[11px] font-sans-sb text-muted">📍 {event.venue}</Text>
              </View>
            ) : null}
          </View>

          {event.description ? (
            <Text className="font-sans mt-3 text-[14px] leading-[21px] text-muted">{event.description}</Text>
          ) : null}

          {/* Money at a glance */}
          <View className="mt-4 card p-4">
            <View className="flex-row">
              <Stat label="Collected" value={rupees(totals.collected)} color={c.accent} />
              <Stat label="Spent" value={rupees(totals.spent)} color={c.danger} />
              <Stat
                label="Balance"
                value={rupees(totals.balance)}
                color={totals.balance < 0 ? '#EF4444' : ACCENT}
              />
            </View>

            {pct != null ? (
              <View className="mt-3">
                <View className="mb-1 flex-row justify-between">
                  <Text className="font-sans text-[11px] text-faint">Against budget {rupees(totals.budget!)}</Text>
                  <Text className="text-[11px] font-sans-sb text-muted">{pct}%</Text>
                </View>
                <View className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: c.inset }}>
                  <View style={{ width: `${pct}%`, height: '100%', backgroundColor: ACCENT }} />
                </View>
              </View>
            ) : null}

            {totals.flatsTotal > 0 ? (
              <Text className="font-sans mt-3 text-[12px] text-muted">
                {totals.flatsPaid} flat{totals.flatsPaid === 1 ? '' : 's'} have contributed
                {totals.pending > 0 ? ` · ${rupees(totals.pending)} still expected` : ''}
              </Text>
            ) : null}
          </View>

          {/* The accounts report stays here: it is the thing a resident who is
              not on the committee comes looking for, and making them go via a
              Money tab they cannot edit would be strange. */}
          <View className="mt-4">
            <NavRow
              icon="stats-chart-outline" color={ACCENT}
              title="Accounts report"
              sub="Open to every resident"
              onPress={() => router.push(`/events/${event.id}/report` as any)}
              c={c}
            />
          </View>

          {/* Core team */}
          <View className="mt-6">
            <View className="mb-2 flex-row items-center justify-between px-1">
              <Text className="text-[11px] font-sans-sb uppercase tracking-wider text-muted">Core team</Text>
              {isLead ? (
                <Pressable onPress={openTeamPicker} hitSlop={8}>
                  <Text className="text-[12px] font-sans-sb" style={{ color: ACCENT }}>Manage</Text>
                </Pressable>
              ) : null}
            </View>

            {team.length === 0 ? (
              <Text className="font-sans px-1 text-[13px] text-faint">Nobody added yet.</Text>
            ) : (
              <View className="gap-2">
                {team.map((t) => (
                  <View key={t.user_id} className="flex-row items-center gap-3 card p-3">
                    <Avatar name={t.profile?.name ?? '?'} size={34} />
                    <View className="min-w-0 flex-1">
                      <Text className="font-sans-sb text-[14px] text-ink" numberOfLines={1}>
                        {t.profile?.name ?? 'A neighbour'}
                      </Text>
                      <Text className="font-sans text-[12px] text-muted">
                        {t.profile?.flat ? `Flat ${t.profile.flat}` : 'Neighbour'}
                      </Text>
                    </View>
                    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: ACCENT + '18' }}>
                      <Text className="text-[10px] font-sans-sb" style={{ color: ACCENT }}>{ROLE_LABEL[t.role]}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Lead controls */}
          {isLead ? (
            <View className="mt-6 card p-4">
              <Text className="mb-2 text-[12px] font-sans-sb uppercase tracking-wider text-muted">Organiser</Text>
              <Button
                label={`Status: ${meta.label}`}
                icon="flag-outline"
                variant="outline"
                fullWidth
                onPress={() => setShowStatus(true)}
              />
              {isAdmin ? (
                <Pressable onPress={removeEvent} className="mt-2 flex-row items-center justify-center gap-1.5 py-2 active:opacity-60">
                  <Ionicons name="trash-outline" size={15} color={c.danger} />
                  <Text className="text-[13px] font-sans-sb text-nonveg">Delete celebration</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          </>
          )}
        </Container>
      </ScrollView>

      {/* Status sheet */}
      <Sheet visible={showStatus} onClose={() => setShowStatus(false)} title="Celebration status">
        <Text className="font-sans mb-3 text-[13px] leading-[19px] text-muted">
          Moving to <Text className="font-sans-sb">Collecting</Text> notifies everyone that
          contributions are open. <Text className="font-sans-sb">Completed</Text> publishes the
          accounts and closes the books.
        </Text>
        <View className="gap-2">
          {(['draft', 'collecting', 'ongoing', 'completed', 'cancelled'] as EventStatus[]).map((s) => {
            const m = EVENT_STATUS_META[s];
            const on = event.status === s;
            return (
              <Pressable
                key={s}
                onPress={() => changeStatus(s)}
                className="flex-row items-center gap-3 rounded-2xl border px-3.5 py-3"
                style={{ borderColor: on ? m.color : c.line, backgroundColor: on ? c.accentSoft : c.surface }}
              >
                <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.accent }} />
                <Text className="flex-1 font-sans-sb text-[14px] text-ink">{m.label}</Text>
                {on ? <Ionicons name="checkmark" size={16} color={c.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      {/* Team picker */}
      <Sheet visible={showTeam} onClose={() => setShowTeam(false)} title="Core team">
        <Text className="font-sans mb-3 text-[13px] leading-[19px] text-muted">
          The <Text className="font-sans-sb">lead</Text> runs the celebration.
          The <Text className="font-sans-sb">treasurer</Text> is the only one who can confirm money received.
        </Text>

        {team.map((t) => (
          <View key={t.user_id} className="mb-2 card p-3">
            <View className="mb-2 flex-row items-center gap-2">
              <Avatar name={t.profile?.name ?? '?'} size={28} />
              <Text className="flex-1 font-sans-sb text-[13px] text-ink" numberOfLines={1}>
                {t.profile?.name ?? 'A neighbour'}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Clear"
                onPress={async () => {
                  try { await removeTeamMember(event.id, t.user_id); setTeam((p) => p.filter((x) => x.user_id !== t.user_id)); }
                  catch { toast.show('Could not remove'); }
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={c.faint} />
              </Pressable>
            </View>
            <View className="flex-row gap-1.5">
              {(['lead', 'treasurer', 'member'] as TeamRole[]).map((r) => (
                <Pressable
                  key={r}
                  onPress={async () => {
                    try {
                      await setTeamMember(event.id, t.user_id, r);
                      setTeam((p) => p.map((x) => (x.user_id === t.user_id ? { ...x, role: r } : x)));
                    } catch { toast.show('Could not update role'); }
                  }}
                  className="flex-1 items-center rounded-xl py-1.5"
                  style={{ backgroundColor: t.role === r ? ACCENT : c.inset }}
                >
                  <Text className="text-[11px] font-sans-sb" style={{ color: t.role === r ? '#fff' : c.muted }}>
                    {ROLE_LABEL[r]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Text className="mb-1.5 mt-4 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
          Add a neighbour
        </Text>
        <View className="gap-1.5">
          {residents
            .filter((r) => r.userId && !team.some((t) => t.user_id === r.userId))
            .slice(0, 40)
            .map((r) => (
              <Pressable accessibilityRole="button" accessibilityLabel="Add"
                key={r.key}
                onPress={async () => {
                  if (!r.userId) return;
                  try {
                    await setTeamMember(event.id, r.userId, 'member');
                    setTeam(await fetchTeam(event.id));
                  } catch { toast.show('Could not add'); }
                }}
                className="flex-row items-center gap-2.5 rounded-xl px-3 py-2 active:opacity-70"
                style={{ backgroundColor: c.inset }}
              >
                <Avatar name={r.name} size={26} />
                <Text className="font-sans flex-1 text-[13px] text-ink" numberOfLines={1}>{r.name}</Text>
                <Text className="font-sans text-[11px] text-faint">{[r.block, r.flat].filter(Boolean).join('-')}</Text>
                <Ionicons name="add-circle-outline" size={18} color={ACCENT} />
              </Pressable>
            ))}
          {residents.length === 0 ? (
            <Text className="font-sans text-[12px] text-faint">Loading residents…</Text>
          ) : null}
        </View>
      </Sheet>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="flex-1">
      <Text className="font-sans text-[11px] text-faint">{label}</Text>
      <Text className="font-sans-bold text-[17px]" style={{ color }}>{value}</Text>
    </View>
  );
}

function NavRow({
  icon, color, title, sub, onPress, c,
}: {
  icon: string; color: string; title: string; sub: string; onPress: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open"
      onPress={onPress}
      className="flex-row items-center gap-3 card p-3.5 active:opacity-80"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: color + '20' }}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-sans-bold text-[14px] text-ink">{title}</Text>
        <Text className="font-sans text-[12px] text-muted" numberOfLines={1}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.faint} />
    </Pressable>
  );
}

function formatDate(d: string): string {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return d; }
}
