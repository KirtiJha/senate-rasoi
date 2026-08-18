import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Container, ScreenHeader, Sheet } from '../../../components/ui';
import { useAuth } from '../../../context/auth';
import { useConfirm } from '../../../context/confirm';
import { useToast } from '../../../context/toast';
import {
  EXPENSE_CATEGORIES, EventTeamMember, Expense, ExpenseCategory, SocietyEvent,
  addExpense, deleteExpense, fetchEvent, fetchExpenses, fetchTeam, rupees, subscribeEvent,
} from '../../../lib/events';
import { IMAGE_CACHE_PROPS } from '../../../lib/image';
import { uploadContentPhoto } from '../../../lib/photoUpload';
import { useThemeColors } from '../../../theme';

const ACCENT = '#EF4444';
const catMeta = (k: ExpenseCategory) =>
  EXPENSE_CATEGORIES.find((x) => x.key === k) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

function openUrl(u: string) { if (Platform.OS === 'web') window.open(u, '_blank'); else Linking.openURL(u); }

export default function ExpensesScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const confirm = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, communityId, isAdmin } = useAuth();

  const [event, setEvent] = useState<SocietyEvent | null>(null);
  const [team, setTeam] = useState<EventTeamMember[]>([]);
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('misc');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [spentOn, setSpentOn] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [ev, t, ex] = await Promise.all([
        fetchEvent(id), fetchTeam(id).catch(() => []), fetchExpenses(id).catch(() => []),
      ]);
      setEvent(ev); setTeam(t); setRows(ex);
    } catch { /* keep */ } finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => {
    load();
    return id ? subscribeEvent(id, load) : undefined;
  }, [load, id]));

  const onTeam = team.some((t) => t.user_id === userId) || !!isAdmin;
  const locked = event?.status === 'completed';
  const total = rows.reduce((s, e) => s + Number(e.amount), 0);
  const withoutBill = rows.filter((e) => !e.receipt_url).length;

  const pickReceipt = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!res.canceled) setReceipt(res.assets[0].uri);
  };

  const reset = () => {
    setTitle(''); setCategory('misc'); setAmount(''); setVendor(''); setSpentOn(''); setReceipt(null);
  };

  const submit = async () => {
    if (!userId || !event) return;
    if (!title.trim()) return toast.show('What was the money spent on?');
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.show('Enter the amount');
    if (spentOn && !/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) return toast.show('Date must look like 2026-11-08');

    setSaving(true);
    try {
      // Upload the bill first — an expense without its receipt is the thing
      // residents question later.
      let receiptUrl: string | null = null;
      if (receipt) {
        try {
          receiptUrl = await uploadContentPhoto(receipt, `events/${event.id}/receipt-${Date.now()}.jpg`);
        } catch { toast.show('Bill upload failed — saving the expense without it'); }
      }
      await addExpense({
        eventId: event.id,
        communityId,
        title,
        category,
        amount: amt,
        vendor: vendor || null,
        spentOn: spentOn || null,
        paidByUserId: userId,
        receiptUrl,
        createdBy: userId,
      });
      setOpen(false);
      reset();
      await load();
      toast.show('Expense recorded ✓');
    } catch (e) {
      toast.show(e instanceof Error && /closed/i.test(e.message) ? 'Accounts are closed' : 'Could not save');
    } finally { setSaving(false); }
  };

  const remove = async (e: Expense) => {
    const ok = await confirm({
      title: 'Delete expense', message: `Remove "${e.title}"?`, confirmLabel: 'Delete', destructive: true,
    });
    if (!ok) return;
    try { await deleteExpense(e.id); await load(); }
    catch { toast.show('Could not delete'); }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="receipt-outline" iconColor={ACCENT} title="Expenses" showBack hideSociety />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={c.muted} /></View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="receipt-outline"
        iconColor={ACCENT}
        title="Expenses & bills"
        showBack
        hideSociety
        onAdd={onTeam && !locked ? () => setOpen(true) : undefined}
        addLabel="Add"
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          <View className="mb-4 rounded-2xl border border-line bg-surface p-4">
            <Text className="font-sans-bold text-[20px]" style={{ color: ACCENT }}>{rupees(total)}</Text>
            <Text className="text-[12px] text-muted">
              across {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
            </Text>
            {withoutBill > 0 ? (
              <Text className="mt-1.5 text-[12px]" style={{ color: '#B45309' }}>
                ⚠️ {withoutBill} {withoutBill === 1 ? 'entry has' : 'entries have'} no bill attached
              </Text>
            ) : null}
          </View>

          {locked ? (
            <View className="mb-4 flex-row items-start gap-2 rounded-2xl border px-3.5 py-3"
                  style={{ borderColor: '#0891B255', backgroundColor: '#0891B212' }}>
              <Ionicons name="lock-closed-outline" size={16} color="#0891B2" />
              <Text className="flex-1 text-[12px] leading-[17px]" style={{ color: '#0E7490' }}>
                The accounts are published and closed. Expenses can no longer be changed.
              </Text>
            </View>
          ) : null}

          {rows.length === 0 ? (
            <View className="items-center py-16">
              <Ionicons name="receipt-outline" size={40} color={c.faint} />
              <Text className="mt-3 font-sans-sb text-[15px] text-ink">No expenses yet</Text>
              <Text className="mt-1 max-w-xs text-center text-[13px] text-muted">
                Record every payment with its bill so the final accounts hold up.
              </Text>
              {onTeam && !locked ? (
                <Button label="Add first expense" icon="add" size="md" onPress={() => setOpen(true)} />
              ) : null}
            </View>
          ) : (
            <View className="gap-2">
              {rows.map((e) => {
                const m = catMeta(e.category);
                const mine = e.created_by === userId;
                return (
                  <View key={e.id} className="rounded-2xl border border-line bg-surface p-3.5">
                    <View className="flex-row items-center gap-3">
                      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: m.color + '20' }}>
                        <Ionicons name={m.icon as any} size={19} color={m.color} />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{e.title}</Text>
                        <Text className="text-[12px] text-muted" numberOfLines={1}>
                          {m.label}
                          {e.vendor ? ` · ${e.vendor}` : ''}
                          {e.spent_on ? ` · ${e.spent_on}` : ''}
                        </Text>
                      </View>
                      <Text className="font-sans-bold text-[15px]" style={{ color: ACCENT }}>
                        {rupees(Number(e.amount))}
                      </Text>
                    </View>

                    <View className="mt-2 flex-row items-center gap-2">
                      {e.receipt_url ? (
                        <Pressable
                          onPress={() => openUrl(e.receipt_url!)}
                          className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1 active:opacity-70"
                          style={{ backgroundColor: c.inset }}
                        >
                          <Ionicons name="document-attach-outline" size={13} color={c.muted} />
                          <Text className="text-[11px] font-sans-sb text-muted">View bill</Text>
                        </Pressable>
                      ) : (
                        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: '#F59E0B18' }}>
                          <Text className="text-[11px] font-sans-sb" style={{ color: '#B45309' }}>No bill</Text>
                        </View>
                      )}
                      {e.paid_by?.name ? (
                        <Text className="text-[11px] text-faint">Paid by {e.paid_by.name}</Text>
                      ) : null}
                      <View className="flex-1" />
                      {(mine || isAdmin) && !locked ? (
                        <Pressable onPress={() => remove(e)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={15} color={c.faint} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Container>
      </ScrollView>

      {/* Add expense */}
      <Sheet
        visible={open}
        onClose={() => { setOpen(false); reset(); }}
        title="Add an expense"
        footer={<Button label="Save expense" icon="checkmark" fullWidth loading={saving} onPress={submit} />}
      >
        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Bill / receipt</Text>
        <Pressable
          onPress={pickReceipt}
          className="mb-1.5 h-28 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface active:opacity-70"
        >
          {receipt ? (
            <Image source={{ uri: receipt }} style={{ width: '100%', height: '100%' }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={24} color={ACCENT} />
              <Text className="mt-1 text-[12px] text-muted">Photograph the bill</Text>
            </>
          )}
        </Pressable>
        <Text className="mb-3 text-[12px] text-faint">
          Optional, but an expense without a bill is the one residents ask about.
        </Text>

        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">What was it for?</Text>
        <TextInput
          value={title} onChangeText={setTitle}
          placeholder="e.g. Flower decoration" placeholderTextColor={c.faint}
          className="mb-3 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink"
          style={{ outline: 'none' } as any}
        />

        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Category</Text>
        <View className="mb-3 flex-row flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map((cat) => {
            const on = category === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setCategory(cat.key)}
                className="flex-row items-center gap-1 rounded-full border px-3 py-1.5"
                style={{ borderColor: on ? cat.color : c.line, backgroundColor: on ? cat.color : c.surface }}
              >
                <Ionicons name={cat.icon as any} size={12} color={on ? '#fff' : c.muted} />
                <Text className="text-[12px] font-sans-sb" style={{ color: on ? '#fff' : c.muted }}>{cat.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Amount</Text>
        <TextInput
          value={amount} onChangeText={setAmount} keyboardType="numeric"
          placeholder="4500" placeholderTextColor={c.faint}
          className="mb-3 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink"
          style={{ outline: 'none' } as any}
        />

        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Paid to (optional)</Text>
        <TextInput
          value={vendor} onChangeText={setVendor}
          placeholder="e.g. Sharma Flower Mart" placeholderTextColor={c.faint}
          className="mb-3 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink"
          style={{ outline: 'none' } as any}
        />

        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Date (optional)</Text>
        <TextInput
          value={spentOn} onChangeText={setSpentOn}
          placeholder="2026-11-08" placeholderTextColor={c.faint}
          className="rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink"
          style={{ outline: 'none' } as any}
        />
      </Sheet>
    </View>
  );
}
