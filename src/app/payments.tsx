import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar, Container, RowSkeleton, ScreenHeader } from '../components/ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { useConfirm } from '../context/confirm';
import { markPaymentReceived as courtMarkReceived, revertPayment as courtRevert } from '../lib/courts';
import { PaymentRow, cancelPayment, fetchMyPayments, markReceived, subscribePayments } from '../lib/payments';
import { isSupabaseConfigured } from '../lib/supabase';
import { layout, useThemeColors } from '../theme';

type Filter = 'all' | 'sent' | 'received';

const STATUS_META: Record<string, { label: string; color: string }> = {
  initiated: { label: 'Awaiting', color: '#D97706' },
  received: { label: 'Received', color: '#16A34A' },
  cancelled: { label: 'Cancelled', color: '#94A3B8' },
};

export default function PaymentsScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const confirm = useConfirm();
  const { userId } = useAuth();

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) { setLoading(false); return; }
    try { setRows(await fetchMyPayments()); }
    catch { toast.show('Could not load payments'); }
    finally { setLoading(false); }
  }, [userId, toast]);

  useFocusEffect(useCallback(() => {
    load();
    const unsub = subscribePayments(load);
    return unsub;
  }, [load]));

  const filtered = useMemo(() => rows.filter((p) => {
    if (filter === 'sent') return p.payer_id === userId;
    if (filter === 'received') return p.payee_id === userId;
    return true;
  }), [rows, filter, userId]);

  const onReceived = async (p: PaymentRow) => {
    try {
      const ok = p.source === 'court' ? await courtMarkReceived(p.id) : await markReceived(p.id);
      if (ok) { toast.show('Marked received ✓'); load(); }
      else toast.show('Not allowed');
    } catch { toast.show('Could not update'); }
  };

  const onCancel = (p: PaymentRow) => {
    const run = async () => {
      try { if (p.source === 'court') await courtRevert(p.id); else await cancelPayment(p.id); load(); }
      catch { toast.show('Could not cancel'); }
    };
    const isCourt = p.source === 'court';
    confirm({
      title: isCourt ? 'Undo payment' : 'Remove payment',
      message: isCourt ? 'Mark this share as unpaid again?' : 'Remove this payment record?',
      confirmLabel: isCourt ? 'Undo' : 'Remove', destructive: true,
    }).then((ok) => { if (ok) run(); });
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'sent', label: 'I paid' },
    { key: 'received', label: 'To me' },
  ];

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="wallet-outline"
        iconColor="#16A34A"
        title="Payments"
        showBack
        subBar={
          <View className="flex-row gap-2">
            {FILTERS.map((f) => (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} className={`rounded-full px-3.5 py-1.5 ${filter === f.key ? 'bg-accent' : 'bg-inset'}`}>
                <Text className={`text-[12px] font-sans-sb ${filter === f.key ? 'text-on-accent' : 'text-muted'}`}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View className="w-full self-center" style={{ maxWidth: layout.maxContent }}>
          {loading ? (
            <View className="overflow-hidden rounded-2xl border border-line bg-surface"><RowSkeleton count={5} /></View>
          ) : filtered.length === 0 ? (
            <View className="items-center py-16">
              <Ionicons name="wallet-outline" size={42} color={c.faint} />
              <Text className="mt-3 font-display text-xl text-ink mb-1">No payments yet</Text>
              <Text className="text-[14px] text-muted text-center max-w-xs">When you pay a neighbour (or someone pays you), it shows up here to track.</Text>
            </View>
          ) : (
            <View className="overflow-hidden rounded-2xl border border-line bg-surface">
              {filtered.map((p, i) => {
                const iPaid = p.payer_id === userId;
                const other = iPaid ? p.payee : p.payer;
                const st = STATUS_META[p.status] ?? STATUS_META.initiated;
                const amt = Number(p.amount);
                return (
                  <View key={p.id} className={`flex-row items-center gap-3 px-3.5 py-3 ${i === 0 ? '' : 'border-t border-line'}`}>
                    <Avatar name={other?.name ?? '?'} size={38} />
                    <View className="flex-1" style={{ minWidth: 0 }}>
                      <View className="flex-row items-center gap-1.5">
                        <Ionicons name={iPaid ? 'arrow-up' : 'arrow-down'} size={13} color={iPaid ? '#EF4444' : '#16A34A'} />
                        <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>
                          {iPaid ? `To ${other?.name ?? 'Neighbour'}` : `From ${other?.name ?? 'Neighbour'}`}
                        </Text>
                      </View>
                      <Text className="text-[12px] text-muted" numberOfLines={1}>{p.note || 'Payment'} · {timeAgo(p.created_at)}</Text>
                    </View>
                    <View className="items-end gap-1">
                      <Text className="font-display-x text-[16px] text-ink">₹{amt}</Text>
                      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: st.color + '20' }}>
                        <Text className="text-[10px] font-sans-sb uppercase" style={{ color: st.color }}>{st.label}</Text>
                      </View>
                    </View>
                    {/* Actions — works for neighbour payments and sports dues alike */}
                    {!iPaid && p.status === 'initiated' ? (
                      <Pressable onPress={() => onReceived(p)} className="ml-1 rounded-full bg-success px-3 py-1.5 active:opacity-90">
                        <Text className="text-[12px] font-sans-sb text-white">Received</Text>
                      </Pressable>
                    ) : iPaid && p.status === 'initiated' ? (
                      <Pressable onPress={() => onCancel(p)} hitSlop={6} className="ml-1 h-8 w-8 items-center justify-center rounded-full active:bg-inset">
                        <Ionicons name="close" size={16} color={c.faint} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
