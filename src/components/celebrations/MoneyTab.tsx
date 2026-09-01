import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../context/auth';
import { useConfirm } from '../../context/confirm';
import { useToast } from '../../context/toast';
import {
  BudgetItem,
  Contribution,
  EventTotals,
  ExpenseCategory,
  SocietyEvent,
  Sponsorship,
  addBudgetItem,
  addSponsorship,
  computeSplit,
  deleteBudgetItem,
  deleteSponsorship,
  fetchBudgetItems,
  fetchSponsorships,
  rupees,
  setSponsorshipStatus,
  updateEvent,
} from '../../lib/events';
import { haptics } from '../../lib/haptics';
import { useThemeColors } from '../../theme';
import { MyFlatCard } from './MyFlatCard';
import { Button, Sheet, Touchable } from '../ui';

const CATEGORIES: ExpenseCategory[] = ['decor', 'food', 'sound', 'priest', 'prizes', 'venue', 'gifts', 'misc'];

/**
 * The money, in the order a committee actually thinks about it.
 *
 * What it will cost → what we already have → what we must therefore ask each
 * flat for → what has come in. Presented the other way round, the per-flat
 * number arrives before the reasoning that produced it, and the first question
 * anybody asks is "why that much?".
 */
export function MoneyTab({
  event,
  contributions,
  totals,
  canManage,
  onChanged,
}: {
  event: SocietyEvent;
  contributions: Contribution[];
  totals: EventTotals;
  canManage: boolean;
  onChanged: () => void;
}) {
  const c = useThemeColors();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { userId, communityId } = useAuth();

  const [budget, setBudget] = useState<BudgetItem[] | null>(null);
  const [sponsors, setSponsors] = useState<Sponsorship[] | null>(null);
  const [addingBudget, setAddingBudget] = useState(false);
  const [addingSponsor, setAddingSponsor] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([
        fetchBudgetItems(event.id).catch(() => []),
        fetchSponsorships(event.id).catch(() => []),
      ]);
      setBudget(b); setSponsors(s);
    } catch { setBudget([]); setSponsors([]); }
  }, [event.id]);
  useEffect(() => { load(); }, [load]);

  const estimated = (budget ?? []).reduce((s, b) => s + Number(b.estimated), 0);
  // Completed means the accounts are published and closed — see 0069 and, for
  // these tables specifically, 0091.
  const locked = event.status === 'completed';
  const canEdit = canManage && !locked;
  const plan = computeSplit(event, contributions, sponsors ?? []);

  if (budget === null || sponsors === null) {
    return <View className="items-center py-10"><ActivityIndicator color={c.accent} /></View>;
  }

  return (
    <View className="gap-5">
      {/* ── What it will cost ─────────────────────────────────── */}
      <View>
        <SectionHead
          title="Estimated budget"
          right={estimated > 0 ? rupees(estimated) : undefined}
          hint="What each part is expected to cost"
        />
        {budget.length === 0 ? (
          <EmptyLine text="No line items yet. A single total is a number nobody can question before it is spent." />
        ) : (
          <View className="overflow-hidden card">
            {budget.map((b, i) => (
              <View key={b.id}>
                {i > 0 ? <View className="ml-4 h-px bg-line" /> : null}
                <View className="flex-row items-center gap-3 px-4 py-2.5">
                  <View className="min-w-0 flex-1">
                    <Text className="font-sans-md text-[14px] text-ink" numberOfLines={1}>{b.title}</Text>
                    <Text className="text-[11.5px] font-sans" style={{ color: c.subtle }}>{b.category}</Text>
                  </View>
                  <Text className="font-sans-sb text-[14px] text-ink">{rupees(Number(b.estimated))}</Text>
                  {canEdit ? (
                    <Touchable haptic={null} accessibilityRole="button" accessibilityLabel={`Remove ${b.title}`}
                      onPress={async () => {
                        setBudget((prev) => (prev ?? []).filter((x) => x.id !== b.id));
                        try { await deleteBudgetItem(b.id); } catch { load(); }
                      }}>
                      <View pointerEvents="none" className="h-7 w-7 items-center justify-center rounded-full">
                        <Ionicons name="close" size={14} color={c.subtle} />
                      </View>
                    </Touchable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
        {canEdit ? (
          <View className="mt-2">
            <Button label="Add a line" icon="add" variant="outline" size="sm" onPress={() => setAddingBudget(true)} />
          </View>
        ) : null}
      </View>

      {/* ── What we already have ──────────────────────────────── */}
      {canEdit ? (
        <CarryForward event={event} onChanged={onChanged} />
      ) : Number(event.carry_in_used ?? 0) > 0 ? (
        <View className="card px-4 py-3">
          <Text className="text-[12.5px] font-sans" style={{ color: c.subtle }}>
            {rupees(Number(event.carry_in_used))} carried forward from a previous celebration
            {event.carry_in_note ? ` · ${event.carry_in_note}` : ''}
          </Text>
        </View>
      ) : null}

      {/* A resident's own two facts. Renders nothing for the committee, who
          edit any flat from the Collection screen instead. */}
      <MyFlatCard eventId={event.id} communityId={event.community_id} canManage={canManage} />

      {locked ? (
        <View className="mb-4 flex-row items-start gap-2 rounded-2xl px-3.5 py-3"
          style={{ borderWidth: 1, borderColor: c.accentLine, backgroundColor: c.accentSoft }}>
          <Ionicons name="lock-closed-outline" size={16} color={c.accent} />
          <Text className="font-sans flex-1 text-[12.5px] leading-[18px]" style={{ color: c.accent }}>
            The accounts are published and closed. Nothing here can be changed —
            reopen the celebration first if something is wrong.
          </Text>
        </View>
      ) : null}

      {/* ── Where the money stands ────────────────────────────── */}
      <View>
        <SectionHead title="Where it stands" hint="Amounts are set flat by flat, not divided automatically" />
        <View className="card p-4">
          <Row label="Budget (approximate)" value={rupees(Number(event.budget_amount ?? 0))} />
          {totals.carryIn > 0 ? <Row label="Carried forward" value={`− ${rupees(totals.carryIn)}`} tone="accent" /> : null}
          {totals.fromSponsors > 0 ? <Row label="Sponsored" value={`− ${rupees(totals.fromSponsors)}`} tone="accent" /> : null}
          <View className="my-2 h-px" style={{ backgroundColor: c.line }} />
          <Row label="To raise from residents" value={rupees(plan.target)} bold />
          <Row label="Collected so far" value={rupees(totals.fromFlats)} bold tone="accent" />
          {plan.target - totals.fromFlats > 0 ? (
            <Row label="Still short" value={rupees(plan.target - totals.fromFlats)} bold />
          ) : plan.target > 0 ? (
            <Row label="Over by" value={rupees(totals.fromFlats - plan.target)} bold tone="accent" />
          ) : null}

          {totals.optedOut > 0 ? (
            <Text className="font-sans mt-2 text-[12px]" style={{ color: c.subtle }}>
              {totals.optedOut} flat{totals.optedOut === 1 ? '' : 's'} opted out and owe nothing.
            </Text>
          ) : null}

          <Text className="font-sans mt-2 text-[12px] leading-[18px]" style={{ color: c.faint }}>
            The budget is a working figure — edit it from the pencil at the top.
            Each flat&apos;s amount is entered on the Collection screen as it is agreed.
          </Text>
        </View>
      </View>

      {/* ── Sponsorships ──────────────────────────────────────── */}
      <View>
        <SectionHead
          title="Sponsorships"
          hint="Money or things — both count as support"
          right={totals.fromSponsors > 0 ? rupees(totals.fromSponsors) : undefined}
        />
        {sponsors.length === 0 ? (
          <EmptyLine text="Nobody has sponsored anything yet." />
        ) : (
          <View className="overflow-hidden card">
            {sponsors.map((s, i) => (
              <View key={s.id}>
                {i > 0 ? <View className="ml-4 h-px bg-line" /> : null}
                <View className="flex-row items-center gap-3 px-4 py-2.5">
                  <Ionicons
                    name={s.kind === 'money' ? 'cash-outline' : 'gift-outline'}
                    size={17}
                    color={s.status === 'received' ? c.accent : c.subtle}
                  />
                  <View className="min-w-0 flex-1">
                    <Text className="font-sans-md text-[14px] text-ink" numberOfLines={1}>
                      {s.kind === 'money' ? rupees(Number(s.amount ?? 0)) : s.item}
                      {s.quantity ? ` · ${s.quantity}` : ''}
                    </Text>
                    <Text className="text-[11.5px] font-sans" style={{ color: c.subtle }} numberOfLines={1}>
                      {s.sponsor_name}{s.sponsor_flat ? ` · ${s.sponsor_flat}` : ''}
                      {s.status === 'pledged' ? ' · pledged' : ''}
                    </Text>
                  </View>
                  {canEdit ? (
                    <Touchable haptic={null} accessibilityRole="button"
                      accessibilityLabel={s.status === 'pledged' ? 'Mark received' : 'Mark pledged'}
                      onPress={async () => {
                        const next = s.status === 'pledged' ? 'received' : 'pledged';
                        setSponsors((prev) => (prev ?? []).map((x) => (x.id === s.id ? { ...x, status: next } : x)));
                        try { await setSponsorshipStatus(s.id, next); onChanged(); } catch { load(); }
                      }}>
                      <View pointerEvents="none" className="rounded-full px-2.5 py-1"
                        style={{ backgroundColor: s.status === 'received' ? c.accentSoft : c.inset }}>
                        <Text className="text-[11px] font-sans-sb" style={{ color: s.status === 'received' ? c.accent : c.muted }}>
                          {s.status === 'received' ? 'In hand' : 'Mark in hand'}
                        </Text>
                      </View>
                    </Touchable>
                  ) : null}
                  {canEdit ? (
                    <Touchable haptic={null} accessibilityRole="button" accessibilityLabel="Remove sponsorship"
                      onPress={async () => {
                        setSponsors((prev) => (prev ?? []).filter((x) => x.id !== s.id));
                        try { await deleteSponsorship(s.id); onChanged(); } catch { load(); }
                      }}>
                      <View pointerEvents="none" className="h-7 w-7 items-center justify-center rounded-full">
                        <Ionicons name="close" size={14} color={c.subtle} />
                      </View>
                    </Touchable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
        {canEdit ? (
          <View className="mt-2">
            <Button label="Record a sponsorship" icon="add" variant="outline" size="sm" onPress={() => setAddingSponsor(true)} />
          </View>
        ) : null}
      </View>

      {/* ── The two ledgers, which have their own screens ─────── */}
      <View className="gap-2">
        <LedgerLink
          icon="wallet-outline"
          title="Collection"
          detail={`${totals.flatsPaid} flat${totals.flatsPaid === 1 ? '' : 's'} · ${rupees(totals.fromFlats)} in`}
          onPress={() => router.push(`/events/${event.id}/contributions` as never)}
        />
        <LedgerLink
          icon="receipt-outline"
          title="Spending"
          detail={`${rupees(totals.spent)} spent${estimated > 0 ? ` of ${rupees(estimated)} estimated` : ''}`}
          onPress={() => router.push(`/events/${event.id}/expenses` as never)}
        />
      </View>

      <AddBudgetItem
        visible={addingBudget}
        onClose={() => setAddingBudget(false)}
        eventId={event.id}
        communityId={communityId ?? ''}
        userId={userId ?? ''}
        onAdded={() => { setAddingBudget(false); load(); }}
      />
      <AddSponsorship
        visible={addingSponsor}
        onClose={() => setAddingSponsor(false)}
        eventId={event.id}
        communityId={communityId ?? ''}
        userId={userId ?? ''}
        onAdded={() => { setAddingSponsor(false); load(); onChanged(); }}
      />
    </View>
  );
}

/**
 * Money left from last time.
 *
 * Two numbers, not one: "we have ₹8,000 left over" and "we are putting ₹5,000
 * of it into this one" are different facts, and a committee gets asked both.
 * Keeping the remainder visible is also the only way the next celebration
 * knows it exists.
 */
function CarryForward({ event, onChanged }: { event: SocietyEvent; onChanged: () => void }) {
  const c = useThemeColors();
  const toast = useToast();
  const [available, setAvailable] = useState(String(event.carry_in_available ?? 0));
  const [used, setUsed] = useState(String(event.carry_in_used ?? 0));
  const [note, setNote] = useState(event.carry_in_note ?? '');
  const [busy, setBusy] = useState(false);

  const dirty =
    Number(available) !== Number(event.carry_in_available ?? 0)
    || Number(used) !== Number(event.carry_in_used ?? 0)
    || note !== (event.carry_in_note ?? '');

  const save = async () => {
    const av = Math.max(0, Number(available) || 0);
    const us = Math.max(0, Number(used) || 0);
    if (us > av) { toast.show('Cannot use more than is left over'); return; }
    setBusy(true);
    try {
      await updateEvent(event.id, {
        carry_in_available: av, carry_in_used: us, carry_in_note: note.trim() || null,
      } as never);
      haptics.success();
      onChanged();
    } catch { toast.show('Could not save that'); }
    finally { setBusy(false); }
  };

  return (
    <View>
      <SectionHead title="From last time" hint="Left over from a previous celebration" />
      <View className="card p-4">
        <View className="flex-row gap-3">
          <View style={{ flex: 1 }}>
            <Text className="mb-1 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Available</Text>
            <TextInput
              value={available} onChangeText={setAvailable} keyboardType="number-pad"
              placeholder="0" placeholderTextColor={c.faint}
              className="rounded-xl px-3 py-2.5 text-[15px] text-ink"
              style={{ backgroundColor: c.inset, outline: 'none' } as never}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text className="mb-1 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Using here</Text>
            <TextInput
              value={used} onChangeText={setUsed} keyboardType="number-pad"
              placeholder="0" placeholderTextColor={c.faint}
              className="rounded-xl px-3 py-2.5 text-[15px] text-ink"
              style={{ backgroundColor: c.inset, outline: 'none' } as never}
            />
          </View>
        </View>
        <TextInput
          value={note} onChangeText={setNote}
          placeholder="From Diwali 2025" placeholderTextColor={c.faint}
          className="mt-2 rounded-xl px-3 py-2.5 text-[14px] text-ink"
          style={{ backgroundColor: c.inset, outline: 'none' } as never}
        />
        {dirty ? (
          <View className="mt-3">
            <Button label={busy ? 'Saving…' : 'Save'} size="sm" fullWidth loading={busy} onPress={save} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function AddBudgetItem({
  visible, onClose, eventId, communityId, userId, onAdded,
}: {
  visible: boolean; onClose: () => void; eventId: string; communityId: string; userId: string; onAdded: () => void;
}) {
  const c = useThemeColors();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('misc');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim() || !Number(amount) || busy) return;
    setBusy(true);
    try {
      await addBudgetItem({
        eventId, communityId, createdBy: userId,
        title, category, estimated: Number(amount),
      });
      haptics.success();
      setTitle(''); setAmount(''); setCategory('misc');
      onAdded();
    } catch { toast.show('Could not add that'); }
    finally { setBusy(false); }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Budget line">
      <View className="px-4 pb-2">
        <TextInput
          value={title} onChangeText={setTitle}
          placeholder="Pandal and decoration" placeholderTextColor={c.faint}
          className="rounded-xl px-3.5 py-3 text-[15px] text-ink"
          style={{ backgroundColor: c.inset, outline: 'none' } as never}
        />
        <TextInput
          value={amount} onChangeText={setAmount} keyboardType="number-pad"
          placeholder="Estimated ₹" placeholderTextColor={c.faint}
          className="mt-2 rounded-xl px-3.5 py-3 text-[15px] text-ink"
          style={{ backgroundColor: c.inset, outline: 'none' } as never}
        />
        <View className="mt-3 flex-row flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const on = category === cat;
            return (
              <Touchable key={cat} haptic={null} onPress={() => { haptics.select(); setCategory(cat); }}
                accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={cat}>
                <View pointerEvents="none" className="rounded-full px-3 py-1.5"
                  style={{ backgroundColor: on ? c.accentSoft : c.inset, borderWidth: 1, borderColor: on ? c.accentLine : 'transparent' }}>
                  <Text className="text-[12px] font-sans-md" style={{ color: on ? c.accent : c.muted }}>{cat}</Text>
                </View>
              </Touchable>
            );
          })}
        </View>
        <View className="mt-4">
          <Button label={busy ? 'Adding…' : 'Add line'} fullWidth loading={busy} onPress={save} />
        </View>
      </View>
    </Sheet>
  );
}

function AddSponsorship({
  visible, onClose, eventId, communityId, userId, onAdded,
}: {
  visible: boolean; onClose: () => void; eventId: string; communityId: string; userId: string; onAdded: () => void;
}) {
  const c = useThemeColors();
  const toast = useToast();
  const [kind, setKind] = useState<'money' | 'item'>('money');
  const [name, setName] = useState('');
  const [flat, setFlat] = useState('');
  const [amount, setAmount] = useState('');
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = name.trim() && (kind === 'money' ? Number(amount) > 0 : item.trim());

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await addSponsorship({
        eventId, communityId, recordedBy: userId,
        kind, sponsorName: name, sponsorFlat: flat,
        amount: kind === 'money' ? Number(amount) : null,
        item: kind === 'item' ? item : null,
        quantity,
      });
      haptics.success();
      setName(''); setFlat(''); setAmount(''); setItem(''); setQuantity('');
      onAdded();
    } catch { toast.show('Could not record that'); }
    finally { setBusy(false); }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Sponsorship">
      <View className="px-4 pb-2">
        <View className="flex-row gap-2">
          {(['money', 'item'] as const).map((k) => {
            const on = kind === k;
            return (
              <View key={k} style={{ flex: 1 }}>
                <Touchable haptic={null} onPress={() => { haptics.select(); setKind(k); }}
                  accessibilityRole="button" accessibilityState={{ selected: on }}
                  accessibilityLabel={k === 'money' ? 'Money' : 'Something else'}>
                  <View pointerEvents="none" className="items-center rounded-xl py-2.5"
                    style={{ backgroundColor: on ? c.accent : c.inset }}>
                    <Text className="text-[13px] font-sans-sb" style={{ color: on ? c.onAccent : c.muted }}>
                      {k === 'money' ? 'Money' : 'Prasad, items…'}
                    </Text>
                  </View>
                </Touchable>
              </View>
            );
          })}
        </View>

        <TextInput
          value={name} onChangeText={setName}
          placeholder="Who is sponsoring?" placeholderTextColor={c.faint}
          className="mt-3 rounded-xl px-3.5 py-3 text-[15px] text-ink"
          style={{ backgroundColor: c.inset, outline: 'none' } as never}
        />
        <TextInput
          value={flat} onChangeText={setFlat}
          placeholder="Flat (optional)" placeholderTextColor={c.faint}
          className="mt-2 rounded-xl px-3.5 py-3 text-[15px] text-ink"
          style={{ backgroundColor: c.inset, outline: 'none' } as never}
        />

        {kind === 'money' ? (
          <TextInput
            value={amount} onChangeText={setAmount} keyboardType="number-pad"
            placeholder="Amount ₹" placeholderTextColor={c.faint}
            className="mt-2 rounded-xl px-3.5 py-3 text-[15px] text-ink"
            style={{ backgroundColor: c.inset, outline: 'none' } as never}
          />
        ) : (
          <>
            <TextInput
              value={item} onChangeText={setItem}
              placeholder="What — prasad, flowers, sound system" placeholderTextColor={c.faint}
              className="mt-2 rounded-xl px-3.5 py-3 text-[15px] text-ink"
              style={{ backgroundColor: c.inset, outline: 'none' } as never}
            />
            <TextInput
              value={quantity} onChangeText={setQuantity}
              placeholder="How much (optional) — 200 packets" placeholderTextColor={c.faint}
              className="mt-2 rounded-xl px-3.5 py-3 text-[15px] text-ink"
              style={{ backgroundColor: c.inset, outline: 'none' } as never}
            />
          </>
        )}

        <Text className="font-sans mt-3 text-[12px] leading-[17px]" style={{ color: c.subtle }}>
          {kind === 'money'
            ? 'Recorded as pledged. Mark it in hand once the money arrives — only then does it count towards the collection.'
            : 'Tracked as support, never added to the money total.'}
        </Text>

        <View className="mt-4">
          <Button label={busy ? 'Saving…' : 'Record'} fullWidth loading={busy} onPress={save} />
        </View>
      </View>
    </Sheet>
  );
}

// ── Small pieces ────────────────────────────────────────────────────

function SectionHead({ title, hint, right }: { title: string; hint?: string; right?: string }) {
  const c = useThemeColors();
  return (
    <View className="mb-2 flex-row items-end justify-between px-1">
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-sans-sb uppercase tracking-wider text-muted">{title}</Text>
        {hint ? <Text className="font-sans mt-0.5 text-[11.5px]" style={{ color: c.subtle }}>{hint}</Text> : null}
      </View>
      {right ? <Text className="font-sans-sb text-[14px] text-ink">{right}</Text> : null}
    </View>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: 'accent' }) {
  const c = useThemeColors();
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className={bold ? 'font-sans-sb text-[14px] text-ink' : 'font-sans text-[13.5px]'}
        style={bold ? undefined : { color: c.muted }}>{label}</Text>
      <Text className={bold ? 'font-sans-sb text-[14px]' : 'font-sans-md text-[13.5px]'}
        style={{ color: tone === 'accent' ? c.accent : c.ink }}>{value}</Text>
    </View>
  );
}

function EmptyLine({ text }: { text: string }) {
  const c = useThemeColors();
  return (
    <View className="card px-4 py-3.5">
      <Text className="font-sans text-[12.5px] leading-[18px]" style={{ color: c.subtle }}>{text}</Text>
    </View>
  );
}

function LedgerLink({
  icon, title, detail, onPress,
}: { icon: string; title: string; detail: string; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Touchable haptic={null} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      <View pointerEvents="none" className="flex-row items-center gap-3 card px-4 py-3">
        <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: c.accentSoft }}>
          <Ionicons name={icon as never} size={17} color={c.accent} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-sans-sb text-[14px] text-ink">{title}</Text>
          <Text className="text-[12px] font-sans" style={{ color: c.subtle }} numberOfLines={1}>{detail}</Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color={c.faint} />
      </View>
    </Touchable>
  );
}
