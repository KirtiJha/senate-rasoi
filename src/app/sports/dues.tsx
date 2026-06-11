import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Container, ScreenHeader } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import {
  CollectionPlayer, DueItem, cancelMyPayment, fetchBookerCollections, fetchMyDues,
  markPaymentReceived, payDues, subscribeCourtPayments,
} from '../../lib/courts';
import { upiUri } from '../../lib/payments';
import { useThemeColors } from '../../theme';

const ACCENT = '#16A34A';

function fmtDate(iso: string): string {
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  catch { return iso; }
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  due: { label: 'Due', color: '#DC2626' },
  initiated: { label: 'Paid · awaiting confirm', color: '#CA8A04' },
  paid: { label: 'Settled', color: '#16A34A' },
  cancelled: { label: 'Cancelled', color: '#9CA3AF' },
};

export default function DuesScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const { userId, communityId } = useAuth();
  const [tab, setTab] = useState<'owe' | 'collect'>('owe');
  const [dues, setDues] = useState<DueItem[]>([]);
  const [collections, setCollections] = useState<CollectionPlayer[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [d, col] = await Promise.all([fetchMyDues(userId), fetchBookerCollections(userId)]);
      setDues(d); setCollections(col);
      setSelected(new Set(d.filter((x) => x.status === 'due').map((x) => x.session_id)));
    } catch { /* ignore */ }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => subscribeCourtPayments(load), [load]);

  // ── I owe: grouped by the person I owe (one UPI payee per group) ──
  const byBooker = new Map<string, DueItem[]>();
  for (const d of dues) {
    if (!byBooker.has(d.booker_user_id)) byBooker.set(d.booker_user_id, []);
    byBooker.get(d.booker_user_id)!.push(d);
  }

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const pay = async (items: DueItem[]) => {
    if (!userId || !communityId) return;
    const chosen = items.filter((it) => it.status === 'due' && selected.has(it.session_id));
    if (!chosen.length) return toast.show('Select at least one session to pay');
    const total = chosen.reduce((s, it) => s + it.amount, 0);
    const booker = chosen[0];
    if (booker.booker_upi) {
      const note = `Badminton · ${chosen.length} session${chosen.length > 1 ? 's' : ''}`;
      Linking.openURL(upiUri(booker.booker_upi, booker.booker_name ?? 'Booker', total, note)).catch(() => {});
    } else {
      toast.show('Booker has no UPI set — pay them directly');
    }
    try {
      await payDues(chosen.map((it) => ({ sessionId: it.session_id, groupId: it.group_id, amount: it.amount })), userId, booker.booker_user_id, communityId, booker.booker_upi);
      toast.show(`Marked ₹${total.toFixed(0)} as paid — awaiting confirmation`);
      await load();
    } catch { toast.show('Could not record payment'); }
  };

  const undo = async (id: string) => { try { await cancelMyPayment(id); await load(); } catch { toast.show('Could not undo'); } };
  const confirmReceived = async (id: string) => {
    try { const ok = await markPaymentReceived(id); if (ok) { toast.show('Marked received ✓'); await load(); } }
    catch { toast.show('Could not confirm'); }
  };

  // ── Owed to me: grouped by member ──
  const byMember = new Map<string, CollectionPlayer[]>();
  for (const p of collections) {
    if (!byMember.has(p.user_id)) byMember.set(p.user_id, []);
    byMember.get(p.user_id)!.push(p);
  }

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="wallet-outline" iconColor={ACCENT} title="Booking dues" showBack hideSociety />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* tabs */}
          <View className="mb-4 flex-row gap-2">
            {(['owe', 'collect'] as const).map((t) => (
              <Pressable key={t} onPress={() => setTab(t)} className="flex-1 items-center rounded-xl border py-2.5" style={{ borderColor: tab === t ? ACCENT : c.line, backgroundColor: tab === t ? ACCENT + '14' : c.surface }}>
                <Text className="text-[13px] font-sans-sb" style={{ color: tab === t ? ACCENT : c.muted }}>{t === 'owe' ? 'I owe' : 'Owed to me'}</Text>
              </Pressable>
            ))}
          </View>

          {tab === 'owe' ? (
            byBooker.size === 0 ? (
              <Empty icon="checkmark-done-outline" text="You have no court dues. Nicely settled!" c={c} />
            ) : (
              [...byBooker.entries()].map(([bid, items]) => {
                const selectedTotal = items.filter((it) => it.status === 'due' && selected.has(it.session_id)).reduce((s, it) => s + it.amount, 0);
                return (
                  <View key={bid} className="mb-4 rounded-2xl border border-line bg-surface p-4">
                    <Text className="mb-2 font-sans-bold text-[14px] text-ink">Pay {items[0].booker_name ?? 'Booker'}</Text>
                    <View className="gap-1.5">
                      {items.map((it) => {
                        const meta = STATUS_META[it.status];
                        const sel = selected.has(it.session_id);
                        const payable = it.status === 'due';
                        return (
                          <Pressable key={it.session_id} disabled={!payable} onPress={() => toggle(it.session_id)} className="flex-row items-center gap-2.5 rounded-xl bg-inset px-3 py-2.5">
                            {payable ? (
                              <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={18} color={sel ? ACCENT : c.faint} />
                            ) : <Ionicons name="ellipse" size={8} color={meta.color} style={{ marginHorizontal: 5 }} />}
                            <View className="flex-1">
                              <Text className="text-[13px] font-sans-sb text-ink">{it.title ?? 'Court session'} · {fmtDate(it.session_date)}</Text>
                              <Text className="text-[11px]" style={{ color: meta.color }}>{meta.label}</Text>
                            </View>
                            <Text className="font-sans-bold text-[14px] text-ink">₹{it.amount.toFixed(0)}</Text>
                            {it.status === 'initiated' && it.payment_id ? (
                              <Pressable onPress={() => undo(it.payment_id!)} hitSlop={6}><Text className="ml-1 text-[11px] text-faint underline">undo</Text></Pressable>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                    {selectedTotal > 0 ? (
                      <Pressable onPress={() => pay(items)} className="mt-3 flex-row items-center justify-center gap-2 rounded-xl py-3" style={{ backgroundColor: ACCENT }}>
                        <Ionicons name="cash-outline" size={16} color="#fff" />
                        <Text className="font-sans-sb text-[14px] text-white">Pay ₹{selectedTotal.toFixed(0)} via UPI</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            )
          ) : (
            byMember.size === 0 ? (
              <Empty icon="people-outline" text="No one owes you yet. Book a court and split the cost." c={c} />
            ) : (
              [...byMember.entries()].map(([mid, items]) => {
                const dueTotal = items.filter((p) => p.status === 'due' || p.status === 'initiated').reduce((s, p) => s + p.amount, 0);
                return (
                  <View key={mid} className="mb-4 rounded-2xl border border-line bg-surface p-4">
                    <View className="mb-2 flex-row items-center justify-between">
                      <Text className="font-sans-bold text-[14px] text-ink">{items[0].name ?? 'Member'}{items[0].flat ? ` · ${items[0].flat}` : ''}</Text>
                      {dueTotal > 0 ? <Text className="text-[12px] font-sans-sb text-nonveg">₹{dueTotal.toFixed(0)} pending</Text> : <Text className="text-[12px] font-sans-sb text-success">All settled</Text>}
                    </View>
                    <View className="gap-1.5">
                      {items.map((p) => {
                        const meta = STATUS_META[p.status];
                        return (
                          <View key={p.session_id} className="flex-row items-center gap-2.5 rounded-xl bg-inset px-3 py-2.5">
                            <Ionicons name="ellipse" size={8} color={meta.color} />
                            <View className="flex-1">
                              <Text className="text-[13px] font-sans-sb text-ink">{p.title ?? 'Court session'} · {fmtDate(p.session_date)}</Text>
                              <Text className="text-[11px]" style={{ color: meta.color }}>{meta.label}</Text>
                            </View>
                            <Text className="font-sans-bold text-[14px] text-ink">₹{p.amount.toFixed(0)}</Text>
                            {p.status === 'initiated' && p.payment_id ? (
                              <Pressable onPress={() => confirmReceived(p.payment_id!)} className="ml-1 rounded-full px-2.5 py-1" style={{ backgroundColor: ACCENT }}>
                                <Text className="text-[11px] font-sans-sb text-white">Received</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function Empty({ icon, text, c }: { icon: keyof typeof Ionicons.glyphMap; text: string; c: ReturnType<typeof useThemeColors> }) {
  return (
    <View className="items-center py-16">
      <Ionicons name={icon} size={38} color={c.faint} />
      <Text className="mt-3 max-w-[260px] text-center text-[14px] text-muted">{text}</Text>
    </View>
  );
}
