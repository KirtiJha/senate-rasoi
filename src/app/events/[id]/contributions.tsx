import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Container, ScreenHeader, Sheet } from '../../../components/ui';
import { useAuth } from '../../../context/auth';
import { useConfirm } from '../../../context/confirm';
import { useToast } from '../../../context/toast';
import { fetchDirectory } from '../../../lib/directory';
import {
  Contribution, ContributionStatus, EventTeamMember, PayMethod, SocietyEvent,
  computeTotals, fetchContributions, fetchEvent, fetchTeam, generateRoster, rupees,
  setContributionStatus, subscribeEvent, upsertContribution,
} from '../../../lib/events';
import { useThemeColors } from '../../../theme';


const STATUS_META: Record<ContributionStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#6B7280' },
  initiated: { label: 'Paying', color: '#F59E0B' },
  received: { label: 'Received', color: '#16A34A' },
  waived: { label: 'Waived', color: '#94A3B8' },
};

type Filter = 'all' | 'pending' | 'received';

export default function ContributionsScreen() {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const toast = useToast();
  const confirm = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, communityId, isAdmin } = useAuth();

  const [event, setEvent] = useState<SocietyEvent | null>(null);
  const [team, setTeam] = useState<EventTeamMember[]>([]);
  const [rows, setRows] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<Contribution | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMethod, setEditMethod] = useState<PayMethod>('upi');
  const [editNote, setEditNote] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [ev, t, cs] = await Promise.all([
        fetchEvent(id), fetchTeam(id).catch(() => []), fetchContributions(id).catch(() => []),
      ]);
      setEvent(ev); setTeam(t); setRows(cs);
    } catch { /* keep */ } finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => {
    load();
    return id ? subscribeEvent(id, load) : undefined;
  }, [load, id]));

  const myRole = team.find((t) => t.user_id === userId)?.role ?? null;
  const canManage = myRole === 'treasurer' || myRole === 'lead' || !!isAdmin;
  const locked = event?.status === 'completed';
  const totals = computeTotals(event, rows, []);
  const treasurer = team.find((t) => t.role === 'treasurer') ?? team.find((t) => t.role === 'lead');

  const visible = useMemo(() => {
    if (filter === 'pending') return rows.filter((r) => r.status === 'pending' || r.status === 'initiated');
    if (filter === 'received') return rows.filter((r) => r.status === 'received');
    return rows;
  }, [rows, filter]);

  // Seed one row per flat from the resident directory.
  const buildRoster = async () => {
    if (!event || !communityId || !userId) return;
    const ok = await confirm({
      title: 'Build the flat list?',
      message: 'Adds every flat from the resident directory to this list. Flats already here are left untouched.',
      confirmLabel: 'Build list',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const residents = await fetchDirectory(communityId, userId, !!isAdmin);
      // One entry per flat; if two residents share a flat, the first with an
      // account is used so the contribution can't be collected twice.
      const byFlat = new Map<string, { flat: string; userId: string | null }>();
      for (const r of residents) {
        const flat = [r.block, r.flat].filter(Boolean).join('-').trim();
        if (!flat) continue;
        const existing = byFlat.get(flat);
        if (!existing || (!existing.userId && r.userId)) byFlat.set(flat, { flat, userId: r.userId });
      }
      const added = await generateRoster(
        event.id, communityId, [...byFlat.values()], event.suggested_contribution,
      );
      await load();
      toast.show(added > 0 ? `Added ${added} flats` : 'Every flat is already listed');
    } catch { toast.show('Could not build the list'); } finally { setBusy(false); }
  };

  const openEdit = (row: Contribution) => {
    setEditing(row);
    setEditAmount(String(row.amount ?? ''));
    setEditMethod(row.method ?? 'upi');
    setEditNote(row.note ?? '');
  };

  const saveEdit = async (status: ContributionStatus) => {
    if (!editing || !userId || !event || saving) return;
    setSaving(true);
    try {
      await upsertContribution({
        eventId: event.id,
        communityId,
        flat: editing.flat,
        contributorUserId: editing.contributor_user_id,
        amount: Number(editAmount) || 0,
        status,
        method: status === 'received' ? editMethod : null,
        note: editNote || null,
        recordedBy: userId,
      });
      setEditing(null);
      await load();
      toast.show(status === 'received' ? 'Recorded ✓' : 'Updated');
    } catch (e) {
      toast.show(e instanceof Error && /closed/i.test(e.message) ? 'Accounts are closed' : 'Could not save');
    } finally { setSaving(false); }
  };

  const quickReceive = async (row: Contribution) => {
    if (!userId || saving) return;
    setSaving(true);
    try {
      await setContributionStatus(row.id, 'received', userId, row.method ?? 'cash');
      await load();
      toast.show(`${row.flat} marked received ✓`);
    } catch { toast.show('Could not update'); } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="wallet-outline" title="Contributions" showBack hideSociety />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={c.muted} /></View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="wallet-outline"
        title="Contributions"
        showBack
        hideSociety
        subBar={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {(['all', 'pending', 'received'] as Filter[]).map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                className="rounded-full px-3 py-1.5"
                style={{ backgroundColor: filter === f ? ACCENT : c.inset }}
              >
                <Text className="text-[12px] font-sans-sb" style={{ color: filter === f ? '#fff' : c.muted }}>
                  {f === 'all' ? 'All flats' : f === 'pending' ? 'Not paid' : 'Paid'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* Summary */}
          <View className="mb-4 card p-4">
            <Text className="font-sans-bold text-[20px]" style={{ color: ACCENT }}>{rupees(totals.collected)}</Text>
            <Text className="font-sans text-[12px] text-muted">
              collected from {totals.flatsPaid} of {totals.flatsTotal} flats
              {totals.pending > 0 ? ` · ${rupees(totals.pending)} expected` : ''}
            </Text>
            {treasurer ? (
              <Text className="font-sans mt-2 text-[12px] text-faint">
                Collected by {treasurer.profile?.name ?? 'the treasurer'}
                {treasurer.profile?.flat ? `, ${treasurer.profile.flat}` : ''}. Money goes directly to
                them — Aangan only keeps the record.
              </Text>
            ) : null}
          </View>

          {locked ? (
            <View className="mb-4 flex-row items-start gap-2 rounded-2xl border px-3.5 py-3"
                  style={{ borderColor: '#0891B255', backgroundColor: '#0891B212' }}>
              <Ionicons name="lock-closed-outline" size={16} color="#0891B2" />
              <Text className="font-sans flex-1 text-[12px] leading-[17px]" style={{ color: '#0E7490' }}>
                The accounts are published and closed. Contributions can no longer be changed.
              </Text>
            </View>
          ) : null}

          {rows.length === 0 ? (
            <View className="items-center py-16">
              <Ionicons name="people-outline" size={40} color={c.faint} />
              <Text className="mt-3 font-sans-sb text-[15px] text-ink">No flats listed yet</Text>
              <Text className="font-sans mt-1 max-w-xs text-center text-[13px] text-muted">
                Build the list from your resident directory, then mark each flat as it pays.
              </Text>
              {canManage && !locked ? (
                <Button label="Build flat list" icon="people" size="md" loading={busy} onPress={buildRoster} />
              ) : null}
            </View>
          ) : (
            <>
              {canManage && !locked ? (
                <Pressable
                  onPress={buildRoster}
                  className="mb-3 flex-row items-center justify-center gap-1.5 card py-2.5 active:opacity-70"
                >
                  <Ionicons name="refresh-outline" size={14} color={c.muted} />
                  <Text className="text-[12px] font-sans-sb text-muted">Refresh flat list from directory</Text>
                </Pressable>
              ) : null}

              <View className="gap-2">
                {visible.map((row) => {
                  const m = STATUS_META[row.status];
                  return (
                    <Pressable
                      key={row.id}
                      onPress={() => (canManage && !locked ? openEdit(row) : undefined)}
                      className="flex-row items-center gap-3 card p-3.5"
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: c.accentSoft }}>
                        <Text className="text-[11px] font-sans-bold" style={{ color: c.accent }}>
                          {row.flat.slice(0, 4)}
                        </Text>
                      </View>

                      <View className="min-w-0 flex-1">
                        <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>
                          {row.flat}
                          {row.contributor?.name ? ` · ${row.contributor.name}` : ''}
                        </Text>
                        <View className="mt-0.5 flex-row items-center gap-1.5">
                          <View className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: c.accentSoft }}>
                            <Text className="text-[10px] font-sans-sb" style={{ color: c.accent }}>{m.label}</Text>
                          </View>
                          {row.method ? <Text className="font-sans text-[11px] text-faint">{row.method}</Text> : null}
                        </View>
                      </View>

                      <View className="items-end">
                        <Text className="font-sans-bold text-[14px] text-ink">{rupees(Number(row.amount))}</Text>
                        {canManage && !locked && row.status !== 'received' && row.status !== 'waived' ? (
                          <Pressable onPress={() => quickReceive(row)} disabled={saving} hitSlop={6} className="mt-1">
                            <Text className="text-[11px] font-sans-sb" style={{ color: ACCENT, opacity: saving ? 0.5 : 1 }}>Mark paid</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </Container>
      </ScrollView>

      {/* Edit one flat */}
      <Sheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Flat ${editing.flat}` : 'Contribution'}
        footer={
          <View className="gap-2">
            <Button label="Mark received" icon="checkmark" fullWidth loading={saving} onPress={() => saveEdit('received')} />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button label="Still pending" variant="outline" fullWidth disabled={saving} onPress={() => saveEdit('pending')} />
              </View>
              <View className="flex-1">
                <Button label="Waive" variant="outline" fullWidth disabled={saving} onPress={() => saveEdit('waived')} />
              </View>
            </View>
          </View>
        }
      >
        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Amount</Text>
        <TextInput
          value={editAmount} onChangeText={setEditAmount} keyboardType="numeric"
          placeholder="1000" placeholderTextColor={c.faint}
          className="mb-3 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink"
          style={{ outline: 'none' } as any}
        />

        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">How did they pay?</Text>
        <View className="mb-3 flex-row gap-2">
          {(['upi', 'cash', 'bank'] as PayMethod[]).map((mth) => (
            <Pressable
              key={mth}
              onPress={() => setEditMethod(mth)}
              className="flex-1 items-center rounded-xl py-2.5"
              style={{ backgroundColor: editMethod === mth ? ACCENT : c.inset }}
            >
              <Text className="text-[12px] font-sans-sb" style={{ color: editMethod === mth ? '#fff' : c.muted }}>
                {mth === 'upi' ? 'UPI' : mth === 'cash' ? 'Cash' : 'Bank'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Note (optional)</Text>
        <TextInput
          value={editNote} onChangeText={setEditNote}
          placeholder="e.g. paid in cash to treasurer on 2 Nov"
          placeholderTextColor={c.faint} multiline
          className="rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink"
          style={{ minHeight: 60, outline: 'none' } as any}
        />
        <Text className="font-sans mt-3 text-[12px] leading-[17px] text-faint">
          "Waive" is for flats that aren't contributing — they're removed from the expected
          total instead of showing as unpaid forever.
        </Text>
      </Sheet>
    </View>
  );
}
