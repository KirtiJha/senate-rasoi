import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar, Button, Container, ScreenHeader } from '../../components/ui';
import { MapPreview } from '../../components/MapPreview';
import { useAuth } from '../../context/auth';
import { useConfirm } from '../../context/confirm';
import { useToast } from '../../context/toast';
import { appleMapsLink, googleMapsLink } from '../../lib/geo';
import { IMAGE_CACHE_PROPS } from '../../lib/image';
import { PlaceRow, deletePlace, fetchPlaceById, placeTypeMeta } from '../../lib/places';
import { useThemeColors } from '../../theme';

const ACCENT = '#0D9488';
function openUrl(u: string) { if (Platform.OS === 'web') window.open(u, '_blank'); else Linking.openURL(u); }
const waLink = (phone: string, msg: string) => {
  const digits = phone.replace(/\D/g, '');
  const e164 = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${e164}?text=${encodeURIComponent(msg)}`;
};

export default function PlaceDetailScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, isAdmin } = useAuth();

  const [place, setPlace] = useState<PlaceRow | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    fetchPlaceById(id).then(setPlace).catch(() => { /* keep */ }).finally(() => setLoading(false));
  }, [id]));

  if (loading) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="location-outline" iconColor={ACCENT} title="Place" showBack hideSociety />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={c.muted} /></View>
      </View>
    );
  }

  if (!place) {
    const goBack = () => router.canGoBack() ? router.back() : router.replace('/places' as any);
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="location-outline" iconColor={ACCENT} title="Place" showBack hideSociety />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color={c.faint} />
          <Text className="mt-3 text-center font-sans-bold text-[16px] text-ink">Place removed</Text>
          <Text className="mt-1.5 text-center text-[13px] text-muted">This place is no longer listed.</Text>
          <Pressable onPress={goBack} className="mt-5 rounded-xl border border-line bg-surface px-5 py-2.5 active:bg-inset">
            <Text className="font-sans-sb text-[14px] text-ink">Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const m = placeTypeMeta(place.place_type);
  const canManage = place.created_by === userId || isAdmin;
  const hasPin = place.lat != null && place.lng != null;

  const remove = async () => {
    if (!(await confirm({ title: 'Delete place', message: `Remove "${place.name}" from Nearby?`, confirmLabel: 'Delete', destructive: true }))) return;
    try { await deletePlace(place.id); if (router.canGoBack()) router.back(); else router.replace('/places' as any); }
    catch { toast.show('Could not delete'); }
  };

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="location-outline" iconColor={ACCENT} title={m.label} showBack hideSociety />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* Photos */}
          {place.photos?.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} className="mb-4">
              {place.photos.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={{ width: place.photos.length > 1 ? 260 : 320, height: 180, borderRadius: 16 }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
              ))}
            </ScrollView>
          ) : null}

          {/* Type badge + name */}
          <View className="mb-1 self-start flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: m.color + '18' }}>
            <Ionicons name={m.icon as any} size={13} color={m.color} />
            <Text className="text-[11px] font-sans-sb" style={{ color: m.color }}>{m.label}</Text>
          </View>
          <Text className="font-display text-[24px] leading-[30px] text-ink">{place.name}</Text>
          {place.hours ? <Text className="mt-1 text-[13px] text-muted">🕒 {place.hours}</Text> : null}
          {place.address ? <Text className="mt-1 text-[13px] leading-[19px] text-muted">{place.address}</Text> : null}
          {place.description ? <Text className="mt-3 text-[14px] leading-[21px] text-ink">{place.description}</Text> : null}

          {/* Contact actions */}
          <View className="mt-4 flex-row flex-wrap gap-2">
            {place.phone ? (
              <Pressable onPress={() => openUrl(`tel:${place.phone}`)} className="flex-row items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 active:bg-inset">
                <Ionicons name="call" size={15} color={ACCENT} /><Text className="font-sans-sb text-[13px] text-ink">Call</Text>
              </Pressable>
            ) : null}
            {place.whatsapp ? (
              <Pressable onPress={() => openUrl(waLink(place.whatsapp!, `Hi! I found ${place.name} on Aangan.`))} className="flex-row items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 active:bg-inset">
                <Ionicons name="logo-whatsapp" size={15} color="#25D366" /><Text className="font-sans-sb text-[13px] text-ink">WhatsApp</Text>
              </Pressable>
            ) : null}
            {place.website ? (
              <Pressable onPress={() => openUrl(place.website!.startsWith('http') ? place.website! : `https://${place.website}`)} className="flex-row items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 active:bg-inset">
                <Ionicons name="globe-outline" size={15} color={ACCENT} /><Text className="font-sans-sb text-[13px] text-ink">Website</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Map + open-in-maps */}
          {hasPin ? (
            <View className="mt-4 overflow-hidden rounded-2xl border border-line">
              <Pressable onPress={() => openUrl(googleMapsLink(place.lat, place.lng, place.name))}>
                <MapPreview lat={place.lat!} lon={place.lng!} height={170} pinColor={ACCENT} />
              </Pressable>
              <View className="flex-row border-t border-line">
                <Pressable onPress={() => openUrl(googleMapsLink(place.lat, place.lng, place.name))} className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 active:bg-inset">
                  <Ionicons name="navigate" size={15} color={ACCENT} /><Text className="font-sans-sb text-[13px] text-ink">Google Maps</Text>
                </Pressable>
                <View style={{ width: 1, backgroundColor: c.line }} />
                <Pressable onPress={() => openUrl(appleMapsLink(place.lat, place.lng, place.name))} className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 active:bg-inset">
                  <Ionicons name="map" size={15} color={ACCENT} /><Text className="font-sans-sb text-[13px] text-ink">Apple Maps</Text>
                </Pressable>
              </View>
            </View>
          ) : place.address ? (
            <View className="mt-4 flex-row gap-2">
              <Button label="Google Maps" icon="navigate" variant="outline" onPress={() => openUrl(googleMapsLink(null, null, `${place.name} ${place.address}`))} />
              <Button label="Apple Maps" icon="map" variant="outline" onPress={() => openUrl(appleMapsLink(null, null, `${place.name} ${place.address}`))} />
            </View>
          ) : null}

          {/* Added by */}
          <View className="mt-5 flex-row items-center gap-2">
            <Avatar name={place.creator?.name ?? 'Neighbour'} size={24} />
            <Text className="text-[12px] text-muted">Added by <Text className="font-sans-sb text-ink">{place.creator?.name ?? 'a neighbour'}</Text>{place.creator?.flat ? ` · Flat ${place.creator.flat}` : ''}</Text>
          </View>

          {/* Manage */}
          {canManage ? (
            <View className="mt-5 flex-row gap-2">
              <Button label="Edit" icon="create-outline" variant="outline" onPress={() => router.push(`/place/new?id=${place.id}` as any)} />
              <Pressable onPress={remove} className="flex-row items-center gap-1.5 rounded-2xl border-[1.5px] border-line px-4 py-2.5 active:bg-inset">
                <Ionicons name="trash-outline" size={16} color={c.nonveg} /><Text className="font-sans-sb text-[13px] text-nonveg">Delete</Text>
              </Pressable>
            </View>
          ) : null}
        </Container>
      </ScrollView>
    </View>
  );
}
