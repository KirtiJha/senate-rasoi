import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Container, PhotoViewer, ScreenHeader, Sheet, Touchable } from '../../../components/ui';
import { useAuth } from '../../../context/auth';
import { useToast } from '../../../context/toast';
import { openPhotoPicker } from '../../../lib/photo';
import { uploadContentPhoto } from '../../../lib/photoUpload';
import {
  Contribution, ContributionStatus, EventTeamMember, PayMethod, SocietyEvent,
  computeTotals, fetchContributions, fetchEvent, fetchTeam, generateRoster, rupees,
  setContributionFacts, setContributionReceipt, setContributionStatus, subscribeEvent,
  upsertContribution,
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
  const [editName, setEditName] = useState('');
  const [editFlat, setEditFlat] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [editHeads, setEditHeads] = useState('');
  const [editOptedOut, setEditOptedOut] = useState(false);
  const [editReceipt, setEditReceipt] = useState<string | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string[] | null>(null);

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

  // No roster is generated from the directory any more. With 244 flats, most
  // of them still unoccupied, seeding a row per flat produced hundreds of
  // entries for people who do not live here yet — and every one of them read
  // as an unpaid debt. Contributions are added as they come in instead.
  // `generateRoster` remains in the lib for a society where that fits.

  const openEdit = (row: Contribution) => {
    setAddingNew(false);
    setEditing(row);
    setEditAmount(String(row.amount ?? ''));
    setEditMethod(row.method ?? 'upi');
    setEditNote(row.note ?? '');
    setEditName(row.contributor_name ?? row.contributor?.name ?? '');
    setEditFlat(row.flat);
    setEditHeads(row.head_count ? String(row.head_count) : '');
    setEditOptedOut(!!row.opted_out);
    setEditReceipt(row.receipt_url ?? null);
  };

  const openAdd = () => {
    if (!event) return;
    setAddingNew(true);
    setEditing({
      id: '', event_id: event.id, community_id: event.community_id,
      flat: '', contributor_user_id: null, amount: 0, status: 'pending',
      method: null, note: null, recorded_by: null, created_at: '', received_at: null,
    } as Contribution);
    setEditAmount('');
    setEditMethod('cash');
    setEditNote('');
    setEditName('');
    setEditFlat('');
    setEditHeads('');
    setEditOptedOut(false);
    setEditReceipt(null);
  };

  const saveEdit = async (status: ContributionStatus) => {
    if (!editing || !userId || !event || saving) return;
    // A row is keyed by its flat, so a new one without a flat has nowhere to go.
    if (!editFlat.trim() && !editing.flat) { toast.show('Which flat?'); return; }
    setSaving(true);
    try {
      await upsertContribution({
        eventId: event.id,
        communityId,
        flat: (editFlat.trim() || editing.flat),
        contributorUserId: editing.contributor_user_id,
        contributorName: editName || null,
        amount: editOptedOut ? 0 : (Number(editAmount) || 0),
        status,
        method: status === 'received' ? editMethod : null,
        note: editNote || null,
        recordedBy: userId,
      });
      const heads = editHeads.trim() ? Number(editHeads) : null;
      if (editing.id && editReceipt && !/^https?:/.test(editReceipt)) {
        try {
          const url = await uploadContentPhoto(editReceipt, `events/${event.id}/pay-${editing.id}.jpg`);
          await setContributionReceipt(editing.id, url);
        } catch { toast.show('Saved, but the screenshot did not upload'); }
      }
      if (editing.id) {
        await setContributionFacts(editing.id, {
          opted_out: editOptedOut,
          head_count: heads && heads > 0 ? heads : null,
        });
      }
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
              collected from {totals.flatsPaid} flat{totals.flatsPaid === 1 ? '' : 's'}
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
              <Text className="mt-3 font-sans-sb text-[15px] text-ink">Nothing collected yet</Text>
              <Text className="font-sans mt-1 max-w-xs text-center text-[13px] text-muted">
                Add each contribution as it comes in — name, flat and amount.
              </Text>
              {canManage && !locked ? (
                <View className="mt-4 w-full px-8">
                  <Button label="Add a contribution" icon="add" size="md" onPress={openAdd} />
                </View>
              ) : null}
            </View>
          ) : (
            <>
              {canManage && !locked ? (
                <View className="mb-3">
                  <Button label="Add a contribution" icon="add" variant="outline" size="sm" onPress={openAdd} />
                </View>
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
                          {row.contributor_name || row.contributor?.name || row.flat}
                          {(row.contributor_name || row.contributor?.name) ? (
                            <Text className="font-sans text-faint"> · {row.flat}</Text>
                          ) : null}
                        </Text>
                        <View className="mt-0.5 flex-row items-center gap-1.5">
                          <View className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: c.accentSoft }}>
                            <Text className="text-[10px] font-sans-sb" style={{ color: c.accent }}>{m.label}</Text>
                          </View>
                          {row.method ? <Text className="font-sans text-[11px] text-faint">{row.method}</Text> : null}
                          {row.receipt_url ? (
                            <Ionicons name="image-outline" size={12} color={c.faint} />
                          ) : null}
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

      <PhotoViewer photos={viewingReceipt} onClose={() => setViewingReceipt(null)} />

      {/* Edit one flat */}
      <Sheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={addingNew ? 'Add a contribution' : editing ? `Flat ${editing.flat}` : 'Contribution'}
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
        {/* The name is written down, not looked up. Most flats have no Aangan
            account, so deriving it left a treasurer reconciling cash against
            bare flat numbers. */}
        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Name</Text>
        <TextInput
          value={editName} onChangeText={setEditName}
          placeholder="Who paid" placeholderTextColor={c.faint}
          className="mb-3 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink"
          style={{ outline: 'none' } as any}
        />

        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Flat</Text>
        <TextInput
          value={editFlat} onChangeText={setEditFlat}
          placeholder="e.g. 149" placeholderTextColor={c.faint}
          className="mb-3 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink"
          style={{ outline: 'none' } as any}
        />

        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Amount</Text>
        <TextInput
          value={editAmount} onChangeText={setEditAmount} keyboardType="numeric"
          placeholder="1000" placeholderTextColor={c.faint}
          className="mb-3 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink"
          style={{ outline: 'none' } as any}
        />

        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
          People in this flat (optional)
        </Text>
        <TextInput
          value={editHeads} onChangeText={setEditHeads} keyboardType="number-pad"
          placeholder="e.g. 4" placeholderTextColor={c.faint}
          className="mb-3 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink"
          style={{ outline: 'none' } as any}
        />

        {/* Opting out zeroes the amount as well as setting the flag: a flat
            that owes nothing must not sit in the shortfall. */}
        <Pressable
          onPress={() => setEditOptedOut((v) => !v)}
          className="mb-3 flex-row items-center gap-2.5 rounded-2xl border border-line bg-inset px-3.5 py-3"
        >
          <Ionicons
            name={editOptedOut ? 'checkbox' : 'square-outline'}
            size={19}
            color={editOptedOut ? ACCENT : c.faint}
          />
          <Text className="flex-1 font-sans text-[14px] text-ink">Not taking part this time</Text>
        </Pressable>

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

        {/* Proof of payment. A UPI screenshot is what a neighbour actually
            has, and what settles a disagreement three weeks later. */}
        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
          Payment screenshot (optional)
        </Text>
        <View className="mb-3 flex-row items-center gap-2">
          {editReceipt ? (
            <>
              <Touchable
                onPress={() => (/^https?:/.test(editReceipt) ? setViewingReceipt([editReceipt]) : undefined)}
                accessibilityRole="button"
                accessibilityLabel="Open the screenshot"
              >
                <View pointerEvents="none">
                  <Image
                    source={{ uri: editReceipt }}
                    style={{ width: 66, height: 66, borderRadius: 10, backgroundColor: c.inset }}
                    contentFit="cover"
                  />
                </View>
              </Touchable>
              <View style={{ flex: 1 }}>
                <Button label="Remove" variant="ghost" size="sm" onPress={() => setEditReceipt(null)} />
              </View>
            </>
          ) : (
            <View style={{ flex: 1 }}>
              <Button
                label="Attach a screenshot"
                icon="image-outline"
                variant="outline"
                size="sm"
                onPress={async () => {
                  const r = await openPhotoPicker({ mediaTypes: ['images'], quality: 0.8 });
                  if (!r.canceled && r.assets?.[0]?.uri) setEditReceipt(r.assets[0].uri);
                }}
              />
            </View>
          )}
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
