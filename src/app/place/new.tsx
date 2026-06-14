import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Container, ScreenHeader } from '../../components/ui';
import { MapPreview } from '../../components/MapPreview';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { Place, searchPlaces } from '../../lib/geo';
import {
  PLACE_TYPES,
  createPlace,
  fetchPlaceById,
  updatePlace,
  uploadPlacePhoto,
} from '../../lib/places';
import { useThemeColors } from '../../theme';

const ACCENT = '#0D9488';
const MAX_PHOTOS = 3;

// A photo slot is either an already-uploaded URL (kept on edit) or a new local pick.
type Slot = { uri: string; isNew: boolean };

export default function PlaceFormScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const router = useRouter();
  const { userId, communityId } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [placeType, setPlaceType] = useState('hospital');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [phone, setPhone] = useState('');
  const [wa, setWa] = useState('');
  const [website, setWebsite] = useState('');
  const [hours, setHours] = useState('');
  const [photos, setPhotos] = useState<Slot[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Location search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Load existing place for edit.
  useEffect(() => {
    if (!id) return;
    fetchPlaceById(id).then((p) => {
      if (!p) { toast.show('Place not found'); router.back(); return; }
      setPlaceType(p.place_type);
      setName(p.name);
      setDesc(p.description ?? '');
      setAddress(p.address ?? '');
      setLat(p.lat); setLng(p.lng);
      setPhone(p.phone ?? '');
      setWa(p.whatsapp ?? '');
      setWebsite(p.website ?? '');
      setHours(p.hours ?? '');
      setPhotos((p.photos ?? []).map((u) => ({ uri: u, isNew: false })));
    }).catch(() => toast.show('Could not load')).finally(() => setLoading(false));
  }, [id]);

  // Debounced location search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) { setResults([]); return; }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setSearching(true);
      const r = await searchPlaces(q, ac.signal);
      setResults(r);
      setSearching(false);
    }, 450);
    return () => clearTimeout(t);
  }, [query]);

  const pickResult = (p: Place) => {
    setLat(p.lat); setLng(p.lon);
    if (!address.trim()) setAddress(p.address);
    if (!name.trim()) setName(p.name);
    setResults([]);
    setQuery('');
  };

  const useMyLocation = () => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.show('Search the address above to drop a pin');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); toast.show('Location set 📍'); },
      () => toast.show('Could not get your location — search the address instead'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return toast.show(`Up to ${MAX_PHOTOS} photos`);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true });
    if (!res.canceled) setPhotos((prev) => [...prev, { uri: res.assets[0].uri, isNew: true }]);
  };
  const removePhoto = (i: number) => setPhotos((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!userId) return;
    if (!name.trim()) return toast.show('What is this place called?');
    setSubmitting(true);
    try {
      if (isEdit && id) {
        // Keep existing URLs; upload any newly-picked photos (unique key avoids
        // clobbering kept photos sharing an index path).
        const finalUrls: string[] = [];
        let key = Date.now();
        for (const p of photos) {
          if (!p.isNew) { finalUrls.push(p.uri); continue; }
          try { finalUrls.push(await uploadPlacePhoto(p.uri, id, key++)); } catch { /* skip */ }
        }
        await updatePlace(id, {
          placeType, name, description: desc || null, address: address || null,
          lat, lng, phone: phone || null, whatsapp: wa || null, website: website || null,
          hours: hours || null, photos: finalUrls,
        });
        toast.show('Updated ✓');
        router.replace(`/place/${id}` as any);
      } else {
        const place = await createPlace({
          communityId, createdBy: userId, placeType, name, description: desc || null,
          address: address || null, lat, lng, phone: phone || null, whatsapp: wa || null,
          website: website || null, hours: hours || null,
          photoUris: photos.filter((p) => p.isNew).map((p) => p.uri),
        });
        toast.show('Added to Nearby 📍');
        router.replace(`/place/${place.id}` as any);
      }
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Could not save');
    } finally { setSubmitting(false); }
  };

  const input = 'rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink';
  const label = 'mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted';

  if (loading) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="location-outline" iconColor={ACCENT} title="Edit place" showBack hideSociety />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={c.muted} /></View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader icon="location-outline" iconColor={ACCENT} title={isEdit ? 'Edit place' : 'Add a nearby place'} showBack hideSociety />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* Type */}
          <Text className={label}>Type</Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {PLACE_TYPES.map((t) => {
              const on = placeType === t.key;
              return (
                <Pressable key={t.key} onPress={() => setPlaceType(t.key)} className="flex-row items-center gap-1 rounded-full border px-3 py-1.5" style={{ borderColor: on ? t.color : c.line, backgroundColor: on ? t.color : c.surface }}>
                  <Ionicons name={t.icon as any} size={12} color={on ? '#fff' : c.muted} />
                  <Text className="text-[12px] font-sans-sb" style={{ color: on ? '#fff' : c.muted }}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Name */}
          <Text className={label}>Name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Apollo Pharmacy" placeholderTextColor={c.faint} className={`mb-4 ${input}`} style={{ outline: 'none' } as any} />

          {/* Location search */}
          <Text className={label}>Find on map (optional)</Text>
          <View className="mb-1.5 flex-row items-center gap-2 rounded-2xl border border-line bg-inset px-3.5" style={{ paddingVertical: 2 }}>
            <Ionicons name="search" size={16} color={c.faint} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search a place or address…" placeholderTextColor={c.faint} className="flex-1 py-2.5 text-[15px] text-ink" style={{ outline: 'none' } as any} />
            {searching ? <ActivityIndicator size="small" color={c.faint} /> : null}
          </View>
          {results.length > 0 ? (
            <View className="mb-2 overflow-hidden rounded-2xl border border-line bg-surface">
              {results.map((r) => (
                <Pressable key={r.osmId} onPress={() => pickResult(r)} className="flex-row items-start gap-2 border-b border-line px-3.5 py-2.5 active:bg-inset">
                  <Ionicons name="location-outline" size={15} color={ACCENT} style={{ marginTop: 2 }} />
                  <View className="flex-1">
                    <Text className="font-sans-sb text-[13px] text-ink" numberOfLines={1}>{r.name}</Text>
                    <Text className="text-[11px] text-muted" numberOfLines={1}>{r.address}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Pressable onPress={useMyLocation} className="mb-3 flex-row items-center gap-1.5 self-start">
            <Ionicons name="locate" size={14} color={ACCENT} />
            <Text className="text-[12px] font-sans-sb" style={{ color: ACCENT }}>Use my current location</Text>
          </Pressable>

          {lat != null && lng != null ? (
            <View className="mb-4 overflow-hidden rounded-2xl border border-line">
              <MapPreview lat={lat} lon={lng} height={150} pinColor={ACCENT} />
              <Pressable onPress={() => { setLat(null); setLng(null); }} className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full bg-black/55">
                <Ionicons name="close" size={15} color="#fff" />
              </Pressable>
            </View>
          ) : null}

          {/* Address */}
          <Text className={label}>Address (optional)</Text>
          <TextInput value={address} onChangeText={setAddress} placeholder="Street, landmark, area" placeholderTextColor={c.faint} multiline className={`mb-4 ${input}`} style={{ minHeight: 56, outline: 'none' } as any} />

          {/* Contact row */}
          <Text className={label}>Phone (optional)</Text>
          <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="080 1234 5678" placeholderTextColor={c.faint} className={`mb-4 ${input}`} style={{ outline: 'none' } as any} />

          <Text className={label}>WhatsApp (optional)</Text>
          <TextInput value={wa} onChangeText={setWa} keyboardType="phone-pad" placeholder="98765 43210" placeholderTextColor={c.faint} className={`mb-4 ${input}`} style={{ outline: 'none' } as any} />

          <Text className={label}>Website (optional)</Text>
          <TextInput value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" placeholder="https://…" placeholderTextColor={c.faint} className={`mb-4 ${input}`} style={{ outline: 'none' } as any} />

          <Text className={label}>Timings (optional)</Text>
          <TextInput value={hours} onChangeText={setHours} placeholder="e.g. 24x7, or 9 AM – 9 PM" placeholderTextColor={c.faint} className={`mb-4 ${input}`} style={{ outline: 'none' } as any} />

          <Text className={label}>Notes (optional)</Text>
          <TextInput value={desc} onChangeText={setDesc} placeholder="Anything helpful — emergency number, who to ask for, etc." placeholderTextColor={c.faint} multiline className={`mb-4 ${input}`} style={{ minHeight: 64, outline: 'none' } as any} />

          {/* Photos */}
          <Text className={label}>Photos (optional)</Text>
          <View className="mb-5 flex-row flex-wrap gap-2">
            {photos.map((p, i) => (
              <View key={`${p.uri}-${i}`} className="overflow-hidden rounded-2xl" style={{ width: 88, height: 88 }}>
                <Image source={{ uri: p.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                <Pressable onPress={() => removePhoto(i)} className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60">
                  <Ionicons name="close" size={13} color="#fff" />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <Pressable onPress={pickPhoto} className="items-center justify-center rounded-2xl border border-dashed border-line bg-surface active:opacity-70" style={{ width: 88, height: 88 }}>
                <Ionicons name="camera-outline" size={22} color={ACCENT} />
                <Text className="mt-1 text-[10px] text-muted">Add</Text>
              </Pressable>
            ) : null}
          </View>

          <Button label={isEdit ? 'Save changes' : 'Add place'} icon="checkmark" size="lg" fullWidth loading={submitting} onPress={submit} />
          <Text className="mt-3 text-center text-[12px] leading-[18px] text-faint">
            Shared with everyone in your society. You (or an admin) can edit or remove it anytime.
          </Text>
        </Container>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
