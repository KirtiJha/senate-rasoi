import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { openPhotoPicker } from '../../lib/photo';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../components/T';
import { Avatar, Button, Container, ScreenHeader, Sheet } from '../../components/ui';
import { ModerationMenu } from '../../components/ModerationMenu';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { useConfirm } from '../../context/confirm';
import {
  LOST_FOUND_CATEGORIES,
  LostFoundItem,
  LostFoundStatus,
  deleteLostFoundItem,
  fetchLostFoundItem,
  setLostFoundStatus,
  updateLostFoundItem,
  uploadLostFoundPhoto,
} from '../../lib/lostFound';
import { IMAGE_CACHE_PROPS } from '../../lib/image';
import { waLink } from '../../lib/listings';
import { useThemeColors } from '../../theme';

function openUrl(u: string) { if (Platform.OS === 'web') window.open(u, '_blank'); else Linking.openURL(u); }
const catMeta = (key: string | null) =>
  LOST_FOUND_CATEGORIES.find((c) => c.key === key) ?? LOST_FOUND_CATEGORIES[LOST_FOUND_CATEGORIES.length - 1];

export default function LostFoundDetailScreen() {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, isAdmin } = useAuth();

  const [item, setItem] = useState<LostFoundItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCat, setEditCat] = useState('other');
  const [editPhoto, setEditPhoto] = useState<{ uri: string; isNew: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const isOwner = !!item && item.owner_user_id === userId;
  const canManage = isOwner || isAdmin;

  const load = useCallback(async () => {
    if (!id) return;
    try { setItem(await fetchLostFoundItem(id)); }
    catch { /* keep */ } finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openEdit = () => {
    if (!item) return;
    setEditTitle(item.title);
    setEditDesc(item.description ?? '');
    setEditCat(item.category ?? 'other');
    setEditPhoto(item.photo_url ? { uri: item.photo_url, isNew: false } : null);
    setShowEdit(true);
  };

  const pickEditPhoto = async () => {
    const res = await openPhotoPicker({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true });
    if (!res.canceled) setEditPhoto({ uri: res.assets[0].uri, isNew: true });
  };

  const saveEdit = async () => {
    if (!item) return;
    setSaving(true);
    try {
      let photoUrl: string | null = item.photo_url ?? null;
      if (editPhoto === null) photoUrl = null;
      else if (editPhoto.isNew) photoUrl = await uploadLostFoundPhoto(editPhoto.uri, item.id);
      else photoUrl = editPhoto.uri;
      await updateLostFoundItem(item.id, { title: editTitle, description: editDesc || null, category: editCat, photo_url: photoUrl });
      setItem({ ...item, title: editTitle, description: editDesc || null, category: editCat, photo_url: photoUrl });
      setShowEdit(false);
      toast.show('Updated ✓');
    } catch { toast.show('Could not save — try again'); } finally { setSaving(false); }
  };

  const changeStatus = async (status: LostFoundStatus) => {
    if (!item) return;
    try {
      await setLostFoundStatus(item.id, status);
      setItem({ ...item, status });
      toast.show(status === 'resolved' ? 'Marked as resolved ✓' : 'Reopened');
    } catch { toast.show('Could not update'); }
  };

  const removeItem = async () => {
    if (!item) return;
    const ok = await confirm({ title: 'Delete report', message: 'Delete this lost/found report?', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await deleteLostFoundItem(item.id);
      if (router.canGoBack()) router.back();
      else router.replace('/lost-found' as any);
    } catch { toast.show('Could not delete'); }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="search-outline" iconColor={ACCENT} title="Lost & Found" showBack hideSociety />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={c.muted} /></View>
      </View>
    );
  }

  if (!item) {
    const goBack = () => router.canGoBack() ? router.back() : router.replace('/lost-found' as any);
    return (
      <View className="flex-1 bg-bg">
        <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
          <Pressable onPress={goBack} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color={c.faint} />
          <Text className="mt-3 text-center font-sans-bold text-[16px] text-ink">Report removed</Text>
          <Text className="font-sans mt-1.5 text-center text-[13px] text-muted">This report is no longer available — it may have been removed by the poster.</Text>
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
  const isLost = item.kind === 'lost';
  const isResolved = item.status === 'resolved';

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="search-outline"
        iconColor={ACCENT}
        title={isLost ? 'Lost item' : 'Found item'}
        showBack
        hideSociety
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* Photo */}
          {item.photo_url
            ? <Image source={{ uri: item.photo_url }} style={{ width: '100%', height: 200 }} contentFit="cover" {...IMAGE_CACHE_PROPS} className="mb-4 rounded-2xl" />
            : <View className="mb-4 items-center justify-center rounded-2xl bg-inset" style={{ height: 120 }}><Ionicons name={m.icon as any} size={36} color={c.faint} /></View>}

          {/* Badges */}
          <View className="flex-row flex-wrap items-center gap-1.5">
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: isLost ? '#EF444420' : '#16A34A20' }}>
              <Text className="text-[11px] font-sans-sb" style={{ color: isLost ? '#DC2626' : '#15803D' }}>
                {isLost ? '🔍 Lost' : '📦 Found'}
              </Text>
            </View>
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: ACCENT + '18' }}>
              <Text className="text-[11px] font-sans-sb" style={{ color: ACCENT }}>{m.label}</Text>
            </View>
            {isResolved ? (
              <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: '#16A34A20' }}>
                <Text className="text-[11px] font-sans-sb" style={{ color: '#15803D' }}>✓ Resolved</Text>
              </View>
            ) : null}
          </View>

          <T source="lost_found" id={item.id} field="title" text={item.title} className="mt-1.5 font-display-x text-[21px] text-ink" />
          {item.description ? (
            <T source="lost_found" id={item.id} field="description" text={item.description} className="mt-2 text-[14px] leading-[21px] text-muted" />
          ) : null}

          {/* Owner card */}
          <View className="mt-4 flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
            <Avatar name={ownerName} size={40} />
            <View className="flex-1">
              <Text className="font-sans-bold text-[14px] text-ink">{ownerName}</Text>
              <Text className="font-sans text-[12px] text-muted">{item.owner?.flat ? `Flat ${item.owner.flat}` : 'Neighbour'}</Text>
            </View>
            {canManage ? (
              <Pressable
                onPress={openEdit}
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: c.inset }}
              >
                <Ionicons name="pencil-outline" size={16} color={c.muted} />
              </Pressable>
            ) : null}
            <ModerationMenu
              targetType="lost_found"
              targetId={item.id}
              targetOwnerId={item.owner_user_id}
              targetOwnerName={item.owner?.name}
            />
          </View>

          {/* Owner controls */}
          {canManage ? (
            <View className="mt-4 rounded-2xl border border-line bg-surface p-4">
              <Text className="mb-2 text-[12px] font-sans-sb uppercase tracking-wider text-muted">Status</Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => changeStatus('open')}
                  className="flex-1 items-center rounded-xl py-2.5"
                  style={{ backgroundColor: !isResolved ? ACCENT : c.inset }}
                >
                  <Text className="text-[12px] font-sans-sb" style={{ color: !isResolved ? '#fff' : c.muted }}>Open</Text>
                </Pressable>
                <Pressable
                  onPress={() => changeStatus('resolved')}
                  className="flex-1 items-center rounded-xl py-2.5"
                  style={{ backgroundColor: isResolved ? '#16A34A' : c.inset }}
                >
                  <Text className="text-[12px] font-sans-sb" style={{ color: isResolved ? '#fff' : c.muted }}>
                    {isLost ? '✓ Found it!' : '✓ Returned'}
                  </Text>
                </Pressable>
              </View>
              <Pressable onPress={removeItem} className="mt-2 flex-row items-center justify-center gap-1.5 py-2 active:opacity-60">
                <Ionicons name="trash-outline" size={15} color={c.danger} />
                <Text className="text-[13px] font-sans-sb text-nonveg">Delete report</Text>
              </Pressable>
            </View>
          ) : (
            /* Non-owner: contact via WhatsApp */
            <View className="mt-5 gap-2.5">
              {isResolved ? (
                <View className="items-center rounded-2xl border border-line bg-surface p-4">
                  <Ionicons name="checkmark-circle" size={26} color={c.accent} />
                  <Text className="mt-1 font-sans-bold text-[14px] text-ink">
                    {isLost ? 'This item was found!' : 'This item was returned!'}
                  </Text>
                  <Text className="font-sans text-[12px] text-muted">The owner has marked this as resolved.</Text>
                </View>
              ) : wa ? (
                <Button
                  label={isLost ? 'I think I saw it!' : 'Is this mine?'}
                  icon="logo-whatsapp"
                  variant="whatsapp"
                  size="lg"
                  fullWidth
                  onPress={() => {
                    const msg = isLost
                      ? `Hi ${ownerName}, I saw your post on Aangan about a lost "${item.title}". I think I may have seen it!`
                      : `Hi ${ownerName}, I saw your post on Aangan about a found "${item.title}". I think this might be mine!`;
                    openUrl(waLink(wa, msg));
                  }}
                />
              ) : (
                <View className="items-center rounded-2xl border border-line bg-surface p-4">
                  <Text className="font-sans text-[13px] text-muted">
                    {isLost
                      ? 'Keep an eye out and check back with the poster if you find it.'
                      : 'Contact the poster through your society group if this is yours.'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Container>
      </ScrollView>

      {/* Edit sheet */}
      <Sheet visible={showEdit} onClose={() => setShowEdit(false)} title="Edit report">
        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Photo</Text>
        <View className="mb-3 flex-row items-center gap-3">
          <Pressable
            onPress={pickEditPhoto}
            className="h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface active:opacity-70"
          >
            {editPhoto
              ? <Image source={{ uri: editPhoto.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              : <Ionicons name="camera-outline" size={22} color={c.faint} />}
          </Pressable>
          {editPhoto ? (
            <Pressable onPress={() => setEditPhoto(null)} hitSlop={8}>
              <Text className="font-sans text-[13px] text-nonveg">Remove photo</Text>
            </Pressable>
          ) : null}
        </View>

        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Title</Text>
        <TextInput
          value={editTitle}
          onChangeText={setEditTitle}
          className="mb-3 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink"
          style={{ outline: 'none' } as any}
        />

        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 6 }}>
          {LOST_FOUND_CATEGORIES.map((b) => {
            const on = editCat === b.key;
            return (
              <Pressable
                key={b.key}
                onPress={() => setEditCat(b.key)}
                className="flex-row items-center gap-1 rounded-full border px-3 py-1.5"
                style={{ borderColor: on ? ACCENT : c.line, backgroundColor: on ? ACCENT : c.surface }}
              >
                <Ionicons name={b.icon as any} size={12} color={on ? '#fff' : c.muted} />
                <Text className="text-[12px] font-sans-sb" style={{ color: on ? '#fff' : c.muted }}>{b.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Description</Text>
        <TextInput
          value={editDesc}
          onChangeText={setEditDesc}
          multiline
          className="mb-4 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink"
          style={{ minHeight: 64, outline: 'none' } as any}
        />
        <Button label={saving ? 'Saving…' : 'Save changes'} icon="checkmark" fullWidth loading={saving} onPress={saveEdit} />
      </Sheet>
    </View>
  );
}
