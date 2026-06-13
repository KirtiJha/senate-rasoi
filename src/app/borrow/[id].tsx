import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../components/T';
import { Avatar, Button, Container, ScreenHeader, Sheet } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { useConfirm } from '../../context/confirm';
import {
  BORROW_CATEGORIES,
  BorrowRequest,
  BorrowStatus,
  LendItem,
  LendStatus,
  deleteItem,
  fetchItem,
  fetchRequests,
  requestBorrow,
  setItemStatus,
  setRequestStatus,
  subscribeRequests,
  updateItem,
} from '../../lib/borrow';
import { IMAGE_CACHE_PROPS } from '../../lib/image';
import { waLink } from '../../lib/listings';
import { useThemeColors } from '../../theme';

const ACCENT = '#0891B2';
function openUrl(u: string) { if (Platform.OS === 'web') window.open(u, '_blank'); else Linking.openURL(u); }
const catMeta = (key: string | null) => BORROW_CATEGORIES.find((c) => c.key === key) ?? BORROW_CATEGORIES[BORROW_CATEGORIES.length - 1];

export default function LendItemDetailScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();

  const [item, setItem] = useState<LendItem | null>(null);
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReq, setShowReq] = useState(false);
  const [note, setNote] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCat, setEditCat] = useState('');
  const [saving, setSaving] = useState(false);

  const isOwner = !!item && item.owner_user_id === userId;
  const isOffer = !item || item.kind === 'offer';
  const myRequest = requests.find((r) => r.requester_id === userId);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const it = await fetchItem(id);
      setItem(it);
      if (it) setRequests(await fetchRequests(id).catch(() => []));
    } catch { /* keep */ } finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => {
    load();
    return id ? subscribeRequests(id, () => fetchRequests(id).then(setRequests).catch(() => {})) : undefined;
  }, [load, id]));

  const openEdit = () => {
    if (!item) return;
    setEditTitle(item.title);
    setEditDesc(item.description ?? '');
    setEditCat(item.category ?? 'other');
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await updateItem(item.id, { title: editTitle, description: editDesc || null, category: editCat });
      setItem({ ...item, title: editTitle, description: editDesc || null, category: editCat });
      setShowEdit(false);
      toast.show('Updated ✓');
    } catch { toast.show('Could not save — try again'); } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="swap-horizontal-outline" iconColor={ACCENT} title="Item" showBack hideSociety />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={c.muted} /></View>
      </View>
    );
  }

  if (!item) {
    const goBack = () => router.canGoBack() ? router.back() : router.replace('/borrow' as any);
    return (
      <View className="flex-1 bg-bg">
        <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
          <Pressable onPress={goBack} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color={c.faint} />
          <Text className="mt-3 text-center font-sans-bold text-[16px] text-ink">Item removed</Text>
          <Text className="mt-1.5 text-center text-[13px] text-muted">This item is no longer listed — it may have been removed by the owner.</Text>
          <Pressable onPress={goBack} className="mt-5 rounded-xl border border-line bg-surface px-5 py-2.5 active:bg-inset">
            <Text className="font-sans-sb text-[14px] text-ink">Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const m = catMeta(item.category);
  const ownerName = item.owner?.name ?? 'Owner';
  const wa = item.contact_whatsapp ?? item.owner?.whatsapp ?? null;

  const changeItem = async (s: LendStatus) => { try { await setItemStatus(item.id, s); setItem({ ...item, status: s }); } catch { toast.show('Could not update'); } };
  const changeReq = async (r: BorrowRequest, s: BorrowStatus) => {
    try {
      await setRequestStatus(r.id, s);
      setRequests((prev) => prev.map((x) => x.id === r.id ? { ...x, status: s } : x));
      if (s === 'accepted') changeItem('lent');
      if (s === 'returned') changeItem('available');
    } catch { toast.show('Could not update'); }
  };
  const removeItem = async () => {
    const go = async () => { await deleteItem(item.id); if (router.canGoBack()) router.back(); else router.replace('/borrow' as any); };
    if (await confirm({ title: 'Delete item', message: 'Delete this listing?', confirmLabel: 'Delete', destructive: true })) go();
  };

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="swap-horizontal-outline" iconColor={ACCENT} title={isOffer ? 'Lending' : 'Wants to borrow'} showBack hideSociety />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* Photo (offers only) */}
          {isOffer ? (
            item.photo_url
              ? <Image source={{ uri: item.photo_url }} style={{ width: '100%', height: 200 }} contentFit="cover" {...IMAGE_CACHE_PROPS} className="mb-4 rounded-2xl" />
              : <View className="mb-4 items-center justify-center rounded-2xl bg-inset" style={{ height: 140 }}><Ionicons name={m.icon as any} size={36} color={c.faint} /></View>
          ) : null}

          {/* Kind + category + status badges */}
          <View className="flex-row flex-wrap items-center gap-1.5">
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: ACCENT + '18' }}>
              <Text className="text-[11px] font-sans-sb" style={{ color: ACCENT }}>{isOffer ? '🤝 Lending' : '🙏 Needs to borrow'}</Text>
            </View>
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.inset }}>
              <Text className="text-[11px] font-sans-sb text-muted">{m.label}</Text>
            </View>
            {isOffer ? (
              item.status !== 'available'
                ? <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: '#9CA3AF22' }}><Text className="text-[11px] font-sans-sb text-muted">{item.status === 'lent' ? 'Lent out' : 'Unavailable'}</Text></View>
                : <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: '#16A34A22' }}><Text className="text-[11px] font-sans-sb" style={{ color: '#16A34A' }}>Available</Text></View>
            ) : null}
          </View>

          <T source="borrow" id={item.id} field="title" text={item.title} className="mt-1.5 font-display-x text-[21px] text-ink" />
          {item.description ? <T source="borrow" id={item.id} field="description" text={item.description} className="mt-2 text-[14px] leading-[21px] text-muted" /> : null}

          {/* Owner card */}
          <View className="mt-4 flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
            <Avatar name={ownerName} size={40} />
            <View className="flex-1">
              <Text className="font-sans-bold text-[14px] text-ink">{ownerName}</Text>
              <Text className="text-[12px] text-muted">{item.owner?.flat ? `Flat ${item.owner.flat}` : 'Neighbour'}</Text>
            </View>
            {isOwner ? (
              <Pressable onPress={openEdit} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: c.inset }}>
                <Ionicons name="pencil-outline" size={16} color={c.muted} />
              </Pressable>
            ) : null}
          </View>

          {/* Owner controls */}
          {isOwner ? (
            <>
              {isOffer ? (
                <View className="mt-4 rounded-2xl border border-line bg-surface p-4">
                  <Text className="mb-2 text-[12px] font-sans-sb uppercase tracking-wider text-muted">Status</Text>
                  <View className="flex-row gap-2">
                    {(['available', 'lent', 'unavailable'] as LendStatus[]).map((s) => (
                      <Pressable key={s} onPress={() => changeItem(s)} className="flex-1 items-center rounded-xl py-2.5" style={{ backgroundColor: item.status === s ? ACCENT : c.inset }}>
                        <Text className="text-[12px] font-sans-sb" style={{ color: item.status === s ? '#fff' : c.muted }}>{s === 'available' ? 'Available' : s === 'lent' ? 'Lent out' : 'Hide'}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable onPress={removeItem} className="mt-2 flex-row items-center justify-center gap-1.5 py-2 active:opacity-60">
                    <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    <Text className="text-[13px] font-sans-sb text-nonveg">Delete listing</Text>
                  </Pressable>
                </View>
              ) : (
                <View className="mt-4 rounded-2xl border border-line bg-surface p-4">
                  <Pressable onPress={removeItem} className="flex-row items-center justify-center gap-1.5 py-2 active:opacity-60">
                    <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    <Text className="text-[13px] font-sans-sb text-nonveg">Delete request</Text>
                  </Pressable>
                </View>
              )}

              {/* Borrow requests (offers only) */}
              {isOffer && requests.length > 0 ? (
                <View className="mt-4">
                  <Text className="mb-2 text-[12px] font-sans-sb uppercase tracking-wider text-muted">Borrow requests ({requests.length})</Text>
                  <View className="gap-2">
                    {requests.map((r) => (
                      <View key={r.id} className="rounded-2xl border border-line bg-surface p-3.5">
                        <View className="flex-row items-center gap-2">
                          <Avatar name={r.requester?.name ?? '?'} size={26} />
                          <View className="flex-1">
                            <Text className="font-sans-bold text-[13px] text-ink">{r.requester?.name ?? 'A neighbour'}</Text>
                            {r.requester?.flat ? <Text className="text-[11px] text-faint">Flat {r.requester.flat}</Text> : null}
                          </View>
                          <Text className="text-[11px] font-sans-sb" style={{ color: r.status === 'accepted' ? '#16A34A' : r.status === 'declined' ? '#EF4444' : r.status === 'returned' ? '#6B7280' : ACCENT }}>{r.status}</Text>
                        </View>
                        {r.note ? <Text className="mt-1.5 text-[13px] text-ink">{r.note}</Text> : null}
                        <View className="mt-2 flex-row flex-wrap gap-2">
                          {r.status === 'pending' ? (
                            <>
                              <Pressable onPress={() => changeReq(r, 'accepted')} className="rounded-full px-3 py-1.5" style={{ backgroundColor: '#16A34A' }}><Text className="text-[12px] font-sans-sb text-white">Accept</Text></Pressable>
                              <Pressable onPress={() => changeReq(r, 'declined')} className="rounded-full px-3 py-1.5" style={{ backgroundColor: c.inset }}><Text className="text-[12px] font-sans-sb text-muted">Decline</Text></Pressable>
                            </>
                          ) : r.status === 'accepted' ? (
                            <Pressable onPress={() => changeReq(r, 'returned')} className="rounded-full px-3 py-1.5" style={{ backgroundColor: c.inset }}><Text className="text-[12px] font-sans-sb text-muted">Mark returned</Text></Pressable>
                          ) : null}
                          {r.requester?.whatsapp ? (
                            <Pressable onPress={() => openUrl(waLink(r.requester!.whatsapp, `Hi ${r.requester!.name}, about the ${item.title} you wanted to borrow…`))} className="flex-row items-center gap-1 rounded-full px-3 py-1.5" style={{ backgroundColor: '#25D36618' }}>
                              <Ionicons name="logo-whatsapp" size={13} color="#25D366" />
                              <Text className="text-[12px] font-sans-sb" style={{ color: '#25D366' }}>WhatsApp</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            /* Non-owner view */
            <View className="mt-5 gap-2.5">
              {isOffer ? (
                myRequest ? (
                  <View className="items-center rounded-2xl border border-line bg-surface p-4">
                    <Ionicons name={myRequest.status === 'accepted' ? 'checkmark-circle' : myRequest.status === 'declined' ? 'close-circle' : 'time-outline'} size={26} color={myRequest.status === 'accepted' ? '#16A34A' : myRequest.status === 'declined' ? '#EF4444' : ACCENT} />
                    <Text className="mt-1 font-sans-bold text-[14px] text-ink">
                      {myRequest.status === 'pending' ? 'Request sent' : myRequest.status === 'accepted' ? 'Request accepted 🎉' : myRequest.status === 'declined' ? 'Request declined' : 'Returned'}
                    </Text>
                    <Text className="text-[12px] text-muted">{myRequest.status === 'accepted' ? 'Coordinate pickup with the owner.' : 'The owner will respond soon.'}</Text>
                  </View>
                ) : item.status === 'available' ? (
                  <Button label="Request to borrow" icon="hand-left-outline" size="lg" fullWidth onPress={() => setShowReq(true)} />
                ) : (
                  <Text className="text-center text-[13px] text-muted">Currently {item.status === 'lent' ? 'lent out' : 'unavailable'}.</Text>
                )
              ) : (
                /* kind='request' — owner needs to borrow; non-owner can offer to help */
                <Button
                  label="I can help! Message them"
                  icon="logo-whatsapp"
                  variant="whatsapp"
                  size="lg"
                  fullWidth
                  onPress={() => wa ? openUrl(waLink(wa, `Hi ${ownerName}, I saw your request for "${item.title}" on Aangan — I have one you can borrow! 🤝`)) : null}
                />
              )}
              {wa && isOffer ? (
                <Button label="Message the owner" icon="logo-whatsapp" variant="whatsapp" size="lg" fullWidth onPress={() => openUrl(waLink(wa, `Hi ${ownerName}, about your "${item.title}" on Aangan…`))} />
              ) : null}
            </View>
          )}
        </Container>
      </ScrollView>

      {/* Request to borrow sheet */}
      <Sheet visible={showReq} onClose={() => { setNote(''); setShowReq(false); }} title="Request to borrow">
        <Text className="mb-3 text-[13px] leading-[19px] text-muted">Tell {ownerName} when you need it and for how long.</Text>
        <TextInput value={note} onChangeText={setNote} placeholder="e.g. Need it this weekend for ~2 days" placeholderTextColor={c.faint} multiline className="mb-4 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink" style={{ minHeight: 72, outline: 'none' } as any} />
        <Button label="Send request" icon="paper-plane" fullWidth onPress={async () => {
          if (!userId) return;
          try { const r = await requestBorrow(item.id, userId, note || null); setRequests((p) => [r, ...p]); setShowReq(false); setNote(''); toast.show('Request sent 🤝'); }
          catch { toast.show('Could not send — try again'); }
        }} />
      </Sheet>

      {/* Edit sheet */}
      <Sheet visible={showEdit} onClose={() => setShowEdit(false)} title="Edit listing">
        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Title</Text>
        <TextInput value={editTitle} onChangeText={setEditTitle} className="mb-3 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink" style={{ outline: 'none' } as any} />

        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-1" contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
          {BORROW_CATEGORIES.map((b) => {
            const on = editCat === b.key;
            return (
              <Pressable key={b.key} onPress={() => setEditCat(b.key)} className="flex-row items-center gap-1 rounded-full border px-3 py-1.5" style={{ borderColor: on ? ACCENT : c.line, backgroundColor: on ? ACCENT : c.surface }}>
                <Text className="text-[12px] font-sans-sb" style={{ color: on ? '#fff' : c.muted }}>{b.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Notes</Text>
        <TextInput value={editDesc} onChangeText={setEditDesc} multiline className="mb-4 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink" style={{ minHeight: 60, outline: 'none' } as any} />

        <Button label="Save changes" icon="checkmark" fullWidth loading={saving} onPress={saveEdit} />
      </Sheet>
    </View>
  );
}
