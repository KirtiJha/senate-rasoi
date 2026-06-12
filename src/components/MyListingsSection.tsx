import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { useConfirm } from '../context/confirm';
import { deleteDish, fetchDishes } from '../lib/dishes';
import { haptics } from '../lib/haptics';
import { fetchInquiryCountsForOwner } from '../lib/inquiries';
import { deleteListing, fetchMyListings, setListingStatus } from '../lib/listings';
import { getService } from '../lib/services';
import { deleteTiffinPlan, listMyTiffinPlans } from '../lib/tiffin';
import { DishRow, ListingRow, TiffinPlan } from '../lib/types';
import { useThemeColors } from '../theme';
import { Button, Container, RowSkeleton } from './ui';

const FOOD_COLOR = '#E8650A';
const TIFFIN_COLOR = '#F59E0B';

type MyItem =
  | { kind: 'listing'; id: string; raw: ListingRow }
  | { kind: 'dish'; id: string; raw: DishRow }
  | { kind: 'tiffin'; id: string; raw: TiffinPlan };

export function MyListingsSection() {
  const { userId, communityId } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const c = useThemeColors();

  const [items, setItems] = useState<MyItem[]>([]);
  const [inquiryCounts, setInquiryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [listings, dishes, plans] = await Promise.all([
        fetchMyListings(userId),
        fetchDishes(communityId).then((d) => d.filter((x) => x.chef_user_id === userId)).catch(() => [] as DishRow[]),
        listMyTiffinPlans(userId).catch(() => [] as TiffinPlan[]),
      ]);
      setItems([
        ...listings.map((l): MyItem => ({ kind: 'listing', id: l.id, raw: l })),
        ...dishes.map((d): MyItem => ({ kind: 'dish', id: d.id, raw: d })),
        ...plans.map((p): MyItem => ({ kind: 'tiffin', id: p.id, raw: p })),
      ]);
      fetchInquiryCountsForOwner(listings.map((l) => l.id)).then(setInquiryCounts).catch(() => {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId, communityId]);

  useEffect(() => { load(); }, [load]);

  const open = (it: MyItem) =>
    it.kind === 'listing' ? router.push(`/listing/${it.raw.id}` as any)
    : it.kind === 'dish' ? router.push(`/dish/${it.raw.id}` as any)
    : router.push('/food' as any);

  const confirmDelete = (title: string, run: () => Promise<unknown>) => {
    const doIt = async () => { await run(); haptics.success(); toast.show('Removed ✅'); load(); };
    confirm({ title: 'Remove', message: `Remove "${title}"?`, confirmLabel: 'Remove', destructive: true }).then((ok) => { if (ok) doIt(); });
  };

  const onDelete = (it: MyItem) => {
    if (it.kind === 'listing') confirmDelete(it.raw.title, () => deleteListing(it.raw.id));
    else if (it.kind === 'dish') confirmDelete(it.raw.dish_name, () => deleteDish(it.raw.id));
    else confirmDelete(it.raw.title, () => deleteTiffinPlan(it.raw.id));
  };

  const toggleSold = async (l: ListingRow) => {
    await setListingStatus(l.id, l.status === 'sold' ? 'active' : 'sold');
    haptics.tap();
    load();
  };

  if (loading) {
    return (
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
        <Container>
          <View className="overflow-hidden rounded-2xl border border-line bg-surface"><RowSkeleton count={5} /></View>
        </Container>
      </ScrollView>
    );
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center px-6 py-16">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-inset">
          <Text style={{ fontSize: 30 }}>📋</Text>
        </View>
        <Text className="mb-1.5 font-display text-xl text-ink">Nothing posted yet</Text>
        <Text className="mb-5 max-w-xs text-center text-[14px] leading-6 text-muted">
          Post a dish, tiffin, service or product and it'll show up here.
        </Text>
        <Button label="New post" icon="add" onPress={() => router.push('/post')} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <Container>
        {items.map((it) => (
          <MyItemRow
            key={`${it.kind}:${it.id}`}
            item={it}
            inquiries={it.kind === 'listing' ? inquiryCounts[it.id] ?? 0 : 0}
            c={c}
            onOpen={() => open(it)}
            onDelete={() => onDelete(it)}
            onToggleSold={it.kind === 'listing' && it.raw.category === 'market' ? () => toggleSold(it.raw) : undefined}
          />
        ))}
      </Container>
    </ScrollView>
  );
}

function MyItemRow({
  item, inquiries, c, onOpen, onDelete, onToggleSold,
}: {
  item: MyItem;
  inquiries: number;
  c: ReturnType<typeof useThemeColors>;
  onOpen: () => void;
  onDelete: () => void;
  onToggleSold?: () => void;
}) {
  let title: string, catLabel: string, color: string, icon: string, price: string | null, status: { text: string; good: boolean } | null;

  if (item.kind === 'dish') {
    const d = item.raw;
    title = d.dish_name; catLabel = 'Home Food'; color = FOOD_COLOR; icon = 'restaurant';
    price = `₹${d.price}`; status = { text: `${d.plates_left} left`, good: d.plates_left > 0 };
  } else if (item.kind === 'tiffin') {
    const t = item.raw;
    title = t.title; catLabel = 'Tiffin'; color = TIFFIN_COLOR; icon = 'repeat';
    price = `₹${t.price}/day`; status = { text: t.active ? 'active' : 'paused', good: !!t.active };
  } else {
    const l = item.raw; const cat = getService(l.category);
    title = l.title; catLabel = cat?.label ?? l.category; color = cat?.color ?? '#888'; icon = (cat?.icon as string) ?? 'grid-outline';
    price = l.price != null ? `₹${l.price.toLocaleString('en-IN')}` : null;
    status = { text: l.status, good: l.status === 'active' };
  }

  return (
    <Pressable onPress={onOpen} className="mb-3 overflow-hidden rounded-2xl bg-surface active:opacity-90" style={{ borderWidth: 1, borderColor: c.line }}>
      <View style={{ height: 3, backgroundColor: color }} />
      <View className="flex-row items-center gap-3 p-3.5">
        <View className="h-10 w-10 items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: color + '20' }}>
          <Ionicons name={icon as any} size={20} color={color} />
        </View>

        <View className="flex-1" style={{ minWidth: 0 }}>
          <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{title}</Text>
          <View className="mt-0.5 flex-row items-center gap-2 flex-wrap">
            <Text className="text-[11px] font-sans-md text-muted">{catLabel}</Text>
            {price ? <Text className="text-[11px] font-sans-sb text-accent">{price}</Text> : null}
            {status ? (
              <View className={`rounded-full px-1.5 py-0.5 ${status.good ? 'bg-[#E4F5EC]' : 'bg-inset'}`}>
                <Text className={`text-[10px] font-sans-sb uppercase ${status.good ? 'text-[#27AE60]' : 'text-muted'}`}>{status.text}</Text>
              </View>
            ) : null}
            {inquiries > 0 ? (
              <View className="flex-row items-center gap-1 rounded-full px-1.5 py-0.5" style={{ backgroundColor: c.accent + '1A' }}>
                <Ionicons name="people" size={10} color={c.accent} />
                <Text className="text-[10px] font-sans-sb" style={{ color: c.accent }}>{inquiries} interested</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View className="flex-row items-center gap-1.5">
          {onToggleSold ? (
            <Pressable onPress={onToggleSold} hitSlop={4} className="items-center justify-center rounded-xl border border-line px-2.5 py-1.5 active:opacity-70">
              <Text className="font-sans-sb text-[11px] text-muted">{item.kind === 'listing' && item.raw.status === 'sold' ? 'Unsell' : 'Sold'}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onDelete} hitSlop={4} className="items-center justify-center rounded-xl bg-[#FEEAEA] px-2.5 py-1.5 active:opacity-70">
            <Ionicons name="trash-outline" size={14} color="#E0322B" />
          </Pressable>
          <Ionicons name="chevron-forward" size={16} color={c.faint} />
        </View>
      </View>
    </Pressable>
  );
}
