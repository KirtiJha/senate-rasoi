import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { PropertyChat } from '../../components/PropertyChat';
import { T } from '../../components/T';
import { Avatar, Button, Container, ScreenHeader, Sheet } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { useConfirm } from '../../context/confirm';
import { IMAGE_CACHE_PROPS } from '../../lib/image';
import { waLink } from '../../lib/listings';
import {
  PropertyReferralRow,
  PropertyRow,
  ReferralStatus,
  createReferral,
  deleteProperty,
  fetchPropertyById,
  fetchReferrals,
  setPropertyStatus,
  setReferralStatus,
  subscribeReferrals,
} from '../../lib/properties';
import { useThemeColors } from '../../theme';

const ACCENT = '#7C3AED';

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

const FURNISH: Record<string, string> = { unfurnished: 'Unfurnished', semi: 'Semi-furnished', furnished: 'Furnished' };
const PARK: Record<string, string> = { none: 'No parking', open: 'Open', covered: 'Covered' };

export default function PropertyDetailScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, profile } = useAuth();
  const { width } = useWindowDimensions();

  const [p, setP] = useState<PropertyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<PropertyReferralRow[]>([]);
  const [showRefer, setShowRefer] = useState(false);

  const isOwner = !!p && p.owner_user_id === userId;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const row = await fetchPropertyById(id);
      setP(row);
      if (row) setReferrals(await fetchReferrals(id).catch(() => []));
    } catch { /* keep */ }
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => {
    load();
    const unsub = id ? subscribeReferrals(id, () => fetchReferrals(id).then(setReferrals).catch(() => {})) : () => {};
    return unsub;
  }, [load, id]));

  if (loading) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="key-outline" iconColor={ACCENT} title="Flat" showBack hideSociety />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={c.muted} /></View>
      </View>
    );
  }
  if (!p) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="key-outline" iconColor={ACCENT} title="Flat" showBack hideSociety />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-[14px] text-muted">This flat listing is no longer available.</Text>
        </View>
      </View>
    );
  }

  const ownerName = p.owner?.name ?? 'Owner';
  const wa = p.contact_whatsapp ?? p.owner?.whatsapp ?? null;
  const phone = p.contact_phone ?? p.owner?.phone ?? null;
  const isRent = p.listing_type === 'rent';
  const contactMsg = `Hi ${ownerName}! I'm interested in your flat "${p.title}". Could you share the price and details?`;

  const galleryW = Math.min(width, 760) - 32;

  const specs: [string, string][] = [];
  if (p.config) specs.push(['Configuration', p.config]);
  if (p.area_sqft) specs.push(['Area', `${p.area_sqft} sq.ft`]);
  if (p.floor != null) specs.push(['Floor', `${p.floor}${p.total_floors ? ` of ${p.total_floors}` : ''}`]);
  if (p.furnishing) specs.push(['Furnishing', FURNISH[p.furnishing] ?? p.furnishing]);
  if (p.bathrooms != null) specs.push(['Bathrooms', String(p.bathrooms)]);
  if (p.balconies != null) specs.push(['Balconies', String(p.balconies)]);
  if (p.facing) specs.push(['Facing', p.facing]);
  if (p.parking) specs.push(['Parking', PARK[p.parking] ?? p.parking]);
  if (p.tower) specs.push(['Tower / Block', p.tower]);
  if (p.flat_no) specs.push(['Flat no.', p.flat_no]);
  if (p.available_from) specs.push(['Available from', new Date(p.available_from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })]);

  const confirmDelete = () => {
    const go = async () => {
      await deleteProperty(p.id);
      if (router.canGoBack()) router.back();
      else router.replace('/properties' as any);
    };
    confirm({ title: 'Delete flat listing', message: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true }).then((ok) => { if (ok) go(); });
  };

  const changeStatus = async (s: PropertyRow['status']) => {
    try { await setPropertyStatus(p.id, s); setP({ ...p, status: s }); toast.show(s === 'available' ? 'Marked available' : s === 'sold' ? 'Marked sold 🎉' : 'Marked rented 🎉'); }
    catch { toast.show('Could not update'); }
  };

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="key-outline" iconColor={ACCENT} title={isRent ? 'Flat for rent' : 'Flat for sale'} showBack hideSociety />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* Gallery */}
          {p.photos.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} className="mb-4 overflow-hidden rounded-2xl">
              {p.photos.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={{ width: galleryW, height: galleryW * 0.62 }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
              ))}
            </ScrollView>
          ) : (
            <View className="mb-4 items-center justify-center rounded-2xl bg-inset" style={{ height: 160 }}>
              <Ionicons name="home-outline" size={36} color={c.faint} />
            </View>
          )}

          {/* Badges + title */}
          <View className="flex-row items-center gap-2">
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: ACCENT + '18' }}>
              <Text className="text-[11px] font-sans-sb" style={{ color: ACCENT }}>{isRent ? 'For rent' : 'For sale'}</Text>
            </View>
            {p.status !== 'available' ? (
              <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: '#9CA3AF22' }}>
                <Text className="text-[11px] font-sans-sb" style={{ color: '#6B7280' }}>{p.status === 'sold' ? 'Sold' : 'Rented'}</Text>
              </View>
            ) : (
              <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: '#16A34A22' }}>
                <Text className="text-[11px] font-sans-sb" style={{ color: '#16A34A' }}>Available</Text>
              </View>
            )}
          </View>
          <T source="property" id={p.id} field="title" text={p.title} className="mt-2 font-display-x text-[22px] text-ink" />

          {/* Price → contact */}
          <View className="mt-2 flex-row items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 py-2.5">
            <Ionicons name="pricetag-outline" size={16} color={ACCENT} />
            <Text className="flex-1 text-[13px] text-muted">Price on request — contact the owner</Text>
          </View>

          {p.description ? <T source="property" id={p.id} field="description" text={p.description} className="mt-3 text-[14px] leading-[21px] text-muted" /> : null}

          {/* Specs */}
          {specs.length > 0 ? (
            <View className="mt-4 rounded-2xl border border-line bg-surface p-1">
              {specs.map(([k, v], i) => (
                <View key={k} className={`flex-row items-center justify-between px-3.5 py-2.5 ${i ? 'border-t border-line' : ''}`}>
                  <Text className="text-[13px] text-muted">{k}</Text>
                  <Text className="font-sans-sb text-[13px] text-ink">{v}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Amenities */}
          {p.amenities.length > 0 ? (
            <View className="mt-4">
              <Text className="mb-2 text-[12px] font-sans-sb uppercase tracking-wider text-muted">Amenities</Text>
              <View className="flex-row flex-wrap gap-2">
                {p.amenities.map((a) => (
                  <View key={a} className="flex-row items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1.5">
                    <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                    <Text className="text-[12px] text-ink">{a}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Owner */}
          <View className="mt-4 flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
            <Avatar name={ownerName} size={42} />
            <View className="flex-1">
              <Text className="font-sans-bold text-[14px] text-ink">{ownerName}</Text>
              <Text className="text-[12px] text-muted">{p.owner?.flat ? `Flat ${p.owner.flat} · Owner` : 'Owner'}</Text>
            </View>
          </View>

          {/* Owner controls */}
          {isOwner ? (
            <View className="mt-4 rounded-2xl border border-line bg-surface p-4">
              <Text className="mb-2 text-[12px] font-sans-sb uppercase tracking-wider text-muted">Manage listing</Text>
              <View className="flex-row gap-2">
                {(['available', isRent ? 'rented' : 'sold'] as PropertyRow['status'][]).map((s) => (
                  <Pressable key={s} onPress={() => changeStatus(s)} className="flex-1 items-center rounded-xl py-2.5" style={{ backgroundColor: p.status === s ? ACCENT : c.inset }}>
                    <Text className="text-[13px] font-sans-sb" style={{ color: p.status === s ? '#fff' : c.muted }}>
                      {s === 'available' ? 'Available' : s === 'sold' ? 'Mark sold' : 'Mark rented'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={() => router.push(`/property/new?id=${p.id}` as any)} className="mt-3 flex-row items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 active:bg-inset">
                <Ionicons name="create-outline" size={15} color={c.ink} />
                <Text className="text-[13px] font-sans-sb text-ink">Edit listing & photos</Text>
              </Pressable>
              <Pressable onPress={confirmDelete} className="mt-2 flex-row items-center justify-center gap-1.5 py-2 active:opacity-60">
                <Ionicons name="trash-outline" size={15} color="#EF4444" />
                <Text className="text-[13px] font-sans-sb text-nonveg">Delete listing</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Referrals */}
          {referrals.length > 0 ? (
            <View className="mt-4">
              <Text className="mb-2 text-[12px] font-sans-sb uppercase tracking-wider text-muted">
                {isOwner ? `Recommended buyers / tenants (${referrals.length})` : 'Your recommendation'}
              </Text>
              <View className="gap-2">
                {referrals.map((r) => (
                  <ReferralRow key={r.id} r={r} isOwner={isOwner} c={c} />
                ))}
              </View>
            </View>
          ) : null}

          {/* Ask the owner */}
          <View className="mt-5">
            <PropertyChat propertyId={p.id} ownerUserId={p.owner_user_id} ownerName={ownerName} accent={ACCENT} />
          </View>

          {/* Actions */}
          <View className="mt-1 gap-2.5">
            {wa ? (
              <Button label="Contact owner for price" icon="logo-whatsapp" variant="whatsapp" size="lg" fullWidth onPress={() => openUrl(waLink(wa, contactMsg))} />
            ) : phone ? (
              <Button label="Call owner for price" icon="call" size="lg" fullWidth onPress={() => openUrl(`tel:${phone}`)} />
            ) : (
              <Text className="text-center text-[12px] text-faint">The owner hasn't added a contact number.</Text>
            )}
            {!isOwner ? (
              <Button label="Recommend a buyer / tenant" icon="people-outline" variant="outline" size="lg" fullWidth onPress={() => setShowRefer(true)} />
            ) : null}
          </View>
        </Container>
      </ScrollView>

      <ReferralSheet
        visible={showRefer}
        onClose={() => setShowRefer(false)}
        onSubmit={async (vals) => {
          if (!userId) return;
          try {
            await createReferral(p.id, userId, vals);
            setShowRefer(false);
            toast.show('Recommendation sent to the owner 🙌');
            fetchReferrals(p.id).then(setReferrals).catch(() => {});
          } catch { toast.show('Could not send — try again'); }
        }}
        defaultName={profile?.name ?? ''}
        c={c}
      />
    </View>
  );
}

function ReferralRow({ r, isOwner, c }: { r: PropertyReferralRow; isOwner: boolean; c: ReturnType<typeof useThemeColors> }) {
  const NEXT: Record<ReferralStatus, ReferralStatus> = { new: 'contacted', contacted: 'closed', closed: 'new' };
  const META: Record<ReferralStatus, { label: string; bg: string; fg: string }> = {
    new: { label: 'New', bg: '#7C3AED20', fg: '#7C3AED' },
    contacted: { label: 'Contacted', bg: '#D9770622', fg: '#D97706' },
    closed: { label: 'Closed', bg: '#16A34A22', fg: '#16A34A' },
  };
  const m = META[r.status];
  const phone = r.candidate_phone;
  return (
    <View className="rounded-2xl border border-line bg-surface p-3.5">
      <View className="flex-row items-center gap-2">
        <Ionicons name="person-circle-outline" size={18} color={c.faint} />
        <Text className="flex-1 font-sans-bold text-[14px] text-ink">{r.candidate_name}</Text>
        <Pressable disabled={!isOwner} onPress={() => isOwner && setReferralStatus(r.id, NEXT[r.status])} className="rounded-full px-2.5 py-1" style={{ backgroundColor: m.bg }}>
          <Text className="text-[10px] font-sans-sb" style={{ color: m.fg }}>{m.label}</Text>
        </Pressable>
      </View>
      <Text className="mt-0.5 text-[11.5px] text-muted">Recommended by {r.referrer?.name ?? 'a neighbour'}{r.referrer?.flat ? ` · Flat ${r.referrer.flat}` : ''}</Text>
      {r.note ? <Text className="mt-1.5 text-[13px] leading-[19px] text-ink">{r.note}</Text> : null}
      {isOwner && phone ? (
        <View className="mt-2.5 flex-row gap-2">
          <Pressable onPress={() => openUrl(waLink(phone, `Hi ${r.candidate_name}, I heard you're looking for a flat — let's connect.`))} className="flex-row items-center gap-1 rounded-full px-3 py-1.5" style={{ backgroundColor: '#25D36618' }}>
            <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
            <Text className="text-[12px] font-sans-sb" style={{ color: '#25D366' }}>WhatsApp</Text>
          </Pressable>
          <Pressable onPress={() => openUrl(`tel:${phone}`)} className="flex-row items-center gap-1 rounded-full px-3 py-1.5" style={{ backgroundColor: c.inset }}>
            <Ionicons name="call" size={14} color={c.muted} />
            <Text className="text-[12px] font-sans-sb text-muted">Call</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ReferralSheet({ visible, onClose, onSubmit, defaultName, c }: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (v: { candidateName: string; candidatePhone: string | null; note: string | null }) => void;
  defaultName: string;
  c: ReturnType<typeof useThemeColors>;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const reset = () => { setName(''); setPhone(''); setNote(''); };
  const input = 'rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink';
  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title="Recommend a buyer / tenant">
      <Text className="mb-3 text-[13px] leading-[19px] text-muted">
        Know someone looking for a flat? Share their details and the owner will reach out to them.
      </Text>
      <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Their name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Rahul Verma" placeholderTextColor={c.faint} className={`mb-3 ${input}`} style={{ outline: 'none' } as any} />
      <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Their phone (optional)</Text>
      <TextInput value={phone} onChangeText={setPhone} placeholder="98765 43210" keyboardType="phone-pad" placeholderTextColor={c.faint} className={`mb-3 ${input}`} style={{ outline: 'none' } as any} />
      <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Note (optional)</Text>
      <TextInput value={note} onChangeText={setNote} placeholder="e.g. Friend relocating, needs a 2 BHK from next month" placeholderTextColor={c.faint} multiline className={`mb-4 ${input}`} style={{ minHeight: 64, outline: 'none' } as any} />
      <Button label="Send recommendation" icon="paper-plane" fullWidth disabled={!name.trim()} onPress={() => onSubmit({ candidateName: name, candidatePhone: phone || null, note: note || null })} />
    </Sheet>
  );
}
