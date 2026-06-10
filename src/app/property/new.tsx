import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Container, ScreenHeader } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import {
  AMENITY_OPTIONS,
  CONFIG_OPTIONS,
  FACING_OPTIONS,
  FURNISHING_OPTIONS,
  Furnishing,
  ListingType,
  PARKING_OPTIONS,
  Parking,
  postProperty,
} from '../../lib/properties';
import { useThemeColors } from '../../theme';

const ACCENT = '#7C3AED';
const num = (s: string): number | null => { const n = parseInt(s.replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : null; };

export default function NewPropertyScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const router = useRouter();
  const { userId, profile, communityId } = useAuth();

  const [listingType, setListingType] = useState<ListingType>('sale');
  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [config, setConfig] = useState<string | null>(null);
  const [area, setArea] = useState('');
  const [floor, setFloor] = useState('');
  const [totalFloors, setTotalFloors] = useState('');
  const [furnishing, setFurnishing] = useState<Furnishing | null>(null);
  const [facing, setFacing] = useState<string | null>(null);
  const [bathrooms, setBathrooms] = useState('');
  const [balconies, setBalconies] = useState('');
  const [parking, setParking] = useState<Parking | null>(null);
  const [tower, setTower] = useState('');
  const [flatNo, setFlatNo] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [wa, setWa] = useState(profile?.whatsapp ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [submitting, setSubmitting] = useState(false);

  const pickPhotos = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 8, quality: 0.9 });
    if (!res.canceled) setPhotos((prev) => [...prev, ...res.assets.map((a) => a.uri)].slice(0, 8));
  };

  const toggleAmenity = (a: string) => setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const submit = async () => {
    if (!userId) return;
    if (!title.trim()) return toast.show('Add a short title');
    if (!config) return toast.show('Pick the configuration (BHK)');
    setSubmitting(true);
    try {
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(availableFrom.trim()) ? availableFrom.trim() : null;
      const prop = await postProperty({
        communityId, ownerUserId: userId, listingType,
        title, description: desc, config,
        areaSqft: num(area), floor: num(floor), totalFloors: num(totalFloors),
        furnishing, facing, bathrooms: num(bathrooms), balconies: num(balconies), parking,
        tower, flatNo, availableFrom: validDate, amenities,
        contactWhatsapp: wa || null, contactPhone: phone || null, photoUris: photos,
      });
      toast.show('Flat listed 🏠');
      router.replace(`/property/${prop.id}` as any);
    } catch (e) { toast.show(e instanceof Error ? e.message : 'Could not post — try again'); }
    finally { setSubmitting(false); }
  };

  const input = 'rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink';
  const label = 'mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted';

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader icon="key-outline" iconColor={ACCENT} title="Post your flat" showBack hideSociety />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* Sale / Rent */}
          <View className="mb-4 flex-row rounded-2xl bg-inset p-1">
            {(['sale', 'rent'] as ListingType[]).map((t) => (
              <Pressable key={t} onPress={() => setListingType(t)} className="flex-1 items-center rounded-xl py-2.5" style={{ backgroundColor: listingType === t ? ACCENT : 'transparent' }}>
                <Text className="text-[14px] font-sans-sb" style={{ color: listingType === t ? '#fff' : c.muted }}>{t === 'sale' ? 'For sale' : 'For rent'}</Text>
              </Pressable>
            ))}
          </View>

          {/* Photos */}
          <Text className={label}>Photos</Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {photos.map((uri, i) => (
              <View key={i} style={{ width: 84, height: 84 }} className="overflow-hidden rounded-xl">
                <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                <Pressable onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))} className="absolute right-1 top-1 h-5 w-5 items-center justify-center rounded-full bg-black/60">
                  <Ionicons name="close" size={13} color="#fff" />
                </Pressable>
              </View>
            ))}
            {photos.length < 8 ? (
              <Pressable onPress={pickPhotos} style={{ width: 84, height: 84 }} className="items-center justify-center rounded-xl border border-dashed border-line bg-surface active:opacity-70">
                <Ionicons name="camera-outline" size={22} color={ACCENT} />
                <Text className="mt-0.5 text-[10px] text-muted">Add</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Title + description */}
          <Text className={label}>Title</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Spacious 3 BHK in Tower B, park-facing" placeholderTextColor={c.faint} className={`mb-3 ${input}`} style={{ outline: 'none' } as any} />
          <Text className={label}>Description</Text>
          <TextInput value={desc} onChangeText={setDesc} placeholder="Highlights, condition, what's included…" placeholderTextColor={c.faint} multiline className={`mb-4 ${input}`} style={{ minHeight: 72, outline: 'none' } as any} />

          {/* Config */}
          <Text className={label}>Configuration</Text>
          <Chips options={CONFIG_OPTIONS} value={config} onPick={setConfig} c={c} className="mb-4" />

          {/* Area / floor */}
          <View className="mb-3 flex-row gap-3">
            <View className="flex-1"><Text className={label}>Area (sq.ft)</Text><TextInput value={area} onChangeText={setArea} keyboardType="number-pad" placeholder="1200" placeholderTextColor={c.faint} className={input} style={{ outline: 'none' } as any} /></View>
            <View className="flex-1"><Text className={label}>Floor</Text><TextInput value={floor} onChangeText={setFloor} keyboardType="number-pad" placeholder="3" placeholderTextColor={c.faint} className={input} style={{ outline: 'none' } as any} /></View>
            <View className="flex-1"><Text className={label}>of</Text><TextInput value={totalFloors} onChangeText={setTotalFloors} keyboardType="number-pad" placeholder="12" placeholderTextColor={c.faint} className={input} style={{ outline: 'none' } as any} /></View>
          </View>

          {/* Furnishing */}
          <Text className={label}>Furnishing</Text>
          <Chips options={FURNISHING_OPTIONS.map((f) => f.label)} value={furnishing ? FURNISHING_OPTIONS.find((f) => f.value === furnishing)?.label ?? null : null} onPick={(l) => setFurnishing(FURNISHING_OPTIONS.find((f) => f.label === l)?.value ?? null)} c={c} className="mb-4" />

          {/* Bathrooms / balconies / facing / parking */}
          <View className="mb-3 flex-row gap-3">
            <View className="flex-1"><Text className={label}>Bathrooms</Text><TextInput value={bathrooms} onChangeText={setBathrooms} keyboardType="number-pad" placeholder="2" placeholderTextColor={c.faint} className={input} style={{ outline: 'none' } as any} /></View>
            <View className="flex-1"><Text className={label}>Balconies</Text><TextInput value={balconies} onChangeText={setBalconies} keyboardType="number-pad" placeholder="1" placeholderTextColor={c.faint} className={input} style={{ outline: 'none' } as any} /></View>
          </View>
          <Text className={label}>Facing</Text>
          <Chips options={FACING_OPTIONS} value={facing} onPick={setFacing} c={c} className="mb-4" />
          <Text className={label}>Parking</Text>
          <Chips options={PARKING_OPTIONS.map((p) => p.label)} value={parking ? PARKING_OPTIONS.find((p) => p.value === parking)?.label ?? null : null} onPick={(l) => setParking(PARKING_OPTIONS.find((p) => p.label === l)?.value ?? null)} c={c} className="mb-4" />

          {/* Tower / flat / availability */}
          <View className="mb-3 flex-row gap-3">
            <View className="flex-1"><Text className={label}>Tower / Block</Text><TextInput value={tower} onChangeText={setTower} placeholder="B" placeholderTextColor={c.faint} className={input} style={{ outline: 'none' } as any} /></View>
            <View className="flex-1"><Text className={label}>Flat no.</Text><TextInput value={flatNo} onChangeText={setFlatNo} placeholder="B-1204" placeholderTextColor={c.faint} className={input} style={{ outline: 'none' } as any} /></View>
          </View>
          <Text className={label}>Available from (YYYY-MM-DD, optional)</Text>
          <TextInput value={availableFrom} onChangeText={setAvailableFrom} placeholder="2026-07-01" placeholderTextColor={c.faint} className={`mb-4 ${input}`} style={{ outline: 'none' } as any} />

          {/* Amenities */}
          <Text className={label}>Amenities</Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {AMENITY_OPTIONS.map((a) => {
              const on = amenities.includes(a);
              return (
                <Pressable key={a} onPress={() => toggleAmenity(a)} className="rounded-full border px-3 py-1.5" style={{ borderColor: on ? ACCENT : c.line, backgroundColor: on ? ACCENT + '14' : c.surface }}>
                  <Text className="text-[12px] font-sans-sb" style={{ color: on ? ACCENT : c.muted }}>{a}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Contact */}
          <Text className={label}>WhatsApp (for "contact for price")</Text>
          <TextInput value={wa} onChangeText={setWa} keyboardType="phone-pad" placeholder="98765 43210" placeholderTextColor={c.faint} className={`mb-3 ${input}`} style={{ outline: 'none' } as any} />
          <Text className={label}>Phone (optional)</Text>
          <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98765 43210" placeholderTextColor={c.faint} className={`mb-5 ${input}`} style={{ outline: 'none' } as any} />

          <Button label="Post flat listing" icon="checkmark" size="lg" fullWidth loading={submitting} onPress={submit} />
          <Text className="mt-3 text-center text-[12px] leading-[18px] text-faint">
            The price is never shown — neighbours tap "Contact owner for price". You can mark it sold/rented anytime.
          </Text>
        </Container>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chips({ options, value, onPick, c, className = '' }: { options: string[]; value: string | null; onPick: (v: string) => void; c: ReturnType<typeof useThemeColors>; className?: string }) {
  return (
    <View className={`flex-row flex-wrap gap-2 ${className}`}>
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable key={o} onPress={() => onPick(o)} className="rounded-full border px-3.5 py-1.5" style={{ borderColor: on ? ACCENT : c.line, backgroundColor: on ? ACCENT : c.surface }}>
            <Text className="text-[12.5px] font-sans-sb" style={{ color: on ? '#fff' : c.muted }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
