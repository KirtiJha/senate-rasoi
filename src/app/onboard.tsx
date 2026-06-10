import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Container, ScreenHeader } from '../components/ui';
import { useToast } from '../context/toast';
import { Community, findCommunityByOsm, searchCommunities } from '../lib/communities';
import { Place, TILE, osmMapLink, searchSocieties, tileMath, tileUrl } from '../lib/geo';
import { isSupabaseConfigured } from '../lib/supabase';
import { useThemeColors } from '../theme';

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

/** A small OpenStreetMap tile mosaic centred on the location with a pin. */
function MapPreview({ lat, lon, height }: { lat: number; lon: number; height: number }) {
  const [w, setW] = useState(0);
  const { zoom, fx, fy, cx, cy } = tileMath(lat, lon, 16);
  const originX = w / 2 - fx * TILE;
  const originY = height / 2 - fy * TILE;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height, overflow: 'hidden', backgroundColor: '#E7E0D8' }}>
      {w > 0
        ? [-1, 0, 1].flatMap((j) =>
            [-1, 0, 1].map((i) => {
              const tx = cx + i;
              const ty = cy + j;
              return (
                <Image
                  key={`${i},${j}`}
                  source={{ uri: tileUrl(zoom, tx, ty) }}
                  style={{ position: 'absolute', width: TILE, height: TILE, left: originX + tx * TILE, top: originY + ty * TILE }}
                />
              );
            }),
          )
        : null}
      <View style={{ position: 'absolute', left: w / 2 - 13, top: height / 2 - 26 }}>
        <Ionicons name="location" size={26} color="#E8650A" />
      </View>
    </View>
  );
}

export default function OnboardScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [existingMatches, setExistingMatches] = useState<Community[]>([]);
  const [searching, setSearching] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [existing, setExisting] = useState<Community | null | undefined>(undefined); // undefined = checking
  const [manual, setManual] = useState(false); // typed-in society (not found on the map)
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  // Debounced search — existing Aangan societies (to JOIN) + OpenStreetMap (to ONBOARD).
  useEffect(() => {
    if (place || manual) return;
    const q = query.trim();
    if (q.length < 3) { setResults([]); setExistingMatches([]); setSearching(false); return; }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const [osm, comms] = await Promise.all([
        searchSocieties(q, ctrl.signal),
        isSupabaseConfigured ? searchCommunities(q).catch(() => [] as Community[]) : Promise.resolve([] as Community[]),
      ]);
      setExistingMatches(comms);
      const onAangan = new Set(comms.map((cm) => cm.osm_place_id).filter(Boolean) as string[]);
      setResults(osm.filter((r) => !onAangan.has(r.osmId)));
      setSearching(false);
    }, 500);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, place, manual]);

  const pick = async (p: Place) => {
    setPlace(p);
    setName(p.name);
    setAddress(p.address);
    setExisting(undefined);
    if (!isSupabaseConfigured) { setExisting(null); return; }
    try { setExisting(await findCommunityByOsm(p.osmId)); }
    catch { setExisting(null); }
  };

  const reset = () => { setPlace(null); setExisting(undefined); setResults([]); };
  const startManual = () => { setManual(true); setName(query.trim()); setAddress(''); };
  const joinExisting = (cm: Community) => router.push(`/sign-in?communityId=${cm.id}` as any);

  const signUpExisting = () => existing && router.push(`/sign-in?communityId=${existing.id}` as any);
  const onboardNew = () => {
    if (!name.trim()) return toast.show('Add your society name');
    const payload = {
      name: name.trim(), address: address.trim(),
      lat: place?.lat ?? null, lon: place?.lon ?? null,
      osmPlaceId: place?.osmId ?? null, city: place?.city ?? null,
    };
    router.push(`/sign-in?onboard=${encodeURIComponent(JSON.stringify(payload))}` as any);
  };

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="business-outline" iconColor="#0D9488" title="Find your society" showBack hideSociety />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Container narrow>
          {manual ? (
            <>
              <Pressable onPress={() => setManual(false)} className="mb-3 flex-row items-center gap-1 self-start active:opacity-60">
                <Ionicons name="chevron-back" size={16} color={c.muted} />
                <Text className="text-[14px] font-sans-md text-muted">Back to search</Text>
              </Pressable>
              <Text className="font-display-x text-[22px] text-ink">Add your society</Text>
              <Text className="mt-1.5 mb-4 text-[14px] leading-[21px] text-muted">
                Couldn't find it on the map? Just enter the details — the location can be added later.
              </Text>
              <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Society name</Text>
              <TextInput value={name} onChangeText={setName} placeholder="e.g. Sunrise Residency" placeholderTextColor={c.faint} className="mb-4 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink" style={{ outline: 'none' } as any} />
              <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Address</Text>
              <TextInput value={address} onChangeText={setAddress} placeholder="Street, area, city" placeholderTextColor={c.faint} multiline className="mb-4 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink" style={{ minHeight: 64, outline: 'none' } as any} />
              <Button label="Continue — create my account" icon="arrow-forward" fullWidth disabled={!name.trim()} onPress={onboardNew} />
              <Text className="mt-3 text-center text-[12px] leading-[18px] text-faint">As the founder you become the society admin and can invite neighbours.</Text>
            </>
          ) : !place ? (
            <>
              <Text className="font-display-x text-[22px] text-ink">Find your society</Text>
              <Text className="mt-1.5 mb-4 text-[14px] leading-[21px] text-muted">
                Search for your apartment or society in Bengaluru. If it's already on Aangan you'll <Text className="font-sans-sb text-ink">join</Text> it; if not, you can <Text className="font-sans-sb text-ink">onboard</Text> it as the founder.
              </Text>

              <View className="flex-row items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5">
                <Ionicons name="search-outline" size={18} color={c.faint} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                  placeholder="e.g. Prestige Shantiniketan, Whitefield"
                  placeholderTextColor={c.faint}
                  className="flex-1 font-sans text-[15px] text-ink"
                  style={{ outline: 'none' } as any}
                />
                {searching ? <ActivityIndicator size="small" color={c.muted} /> : null}
              </View>

              <View className="mt-3">
                {/* Already on Aangan → join */}
                {existingMatches.length > 0 ? (
                  <View className="mb-1">
                    <Text className="mb-1.5 px-1 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Already on Aangan — join</Text>
                    {existingMatches.map((cm) => (
                      <Pressable key={cm.id} onPress={() => joinExisting(cm)} className="mb-2 flex-row items-center gap-3 rounded-2xl border p-3.5 active:opacity-80" style={{ borderColor: '#16A34A55', backgroundColor: '#16A34A10' }}>
                        <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: '#16A34A22' }}>
                          <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                        </View>
                        <View className="flex-1">
                          <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{cm.name}</Text>
                          <Text className="text-[12px] text-muted" numberOfLines={1}>{cm.address ?? 'On Aangan'}</Text>
                        </View>
                        <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: '#16A34A' }}>
                          <Text className="text-[11px] font-sans-sb" style={{ color: '#fff' }}>Join</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {/* Not yet on Aangan → onboard */}
                {results.length > 0 ? (
                  <View>
                    {existingMatches.length > 0 ? (
                      <Text className="mb-1.5 mt-2 px-1 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Not yours? Onboard a new one</Text>
                    ) : null}
                    {results.map((r) => (
                      <Pressable key={r.osmId} onPress={() => pick(r)} className="flex-row items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 active:bg-inset" style={{ marginBottom: 8 }}>
                        <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: '#0D948822' }}>
                          <Ionicons name="business" size={17} color="#0D9488" />
                        </View>
                        <View className="flex-1">
                          <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{r.name}</Text>
                          <Text className="text-[12px] text-muted" numberOfLines={2}>{r.address}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={c.faint} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {query.trim().length >= 3 && !searching && results.length === 0 && existingMatches.length === 0 ? (
                  <Text className="px-1 py-3 text-[13px] text-muted">No matches. Try a different name, a nearby landmark, or add it manually below.</Text>
                ) : null}
              </View>

              <Pressable onPress={startManual} className="mt-3 items-center py-2">
                <Text className="text-[13px] font-sans-md text-muted">Can't find your society? <Text className="font-sans-sb text-accent">Add it manually</Text></Text>
              </Pressable>
              <Pressable onPress={() => router.push('/sign-in' as any)} className="mt-1 items-center py-2">
                <Text className="text-[13px] font-sans-sb text-accent">Already have an account? Sign in</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={reset} className="mb-3 flex-row items-center gap-1 self-start active:opacity-60">
                <Ionicons name="chevron-back" size={16} color={c.muted} />
                <Text className="text-[14px] font-sans-md text-muted">Change society</Text>
              </Pressable>

              {/* Map preview */}
              <Pressable onPress={() => openUrl(osmMapLink(place.lat, place.lon))} className="overflow-hidden rounded-2xl border border-line">
                <MapPreview lat={place.lat} lon={place.lon} height={190} />
              </Pressable>

              {existing === undefined ? (
                <View className="items-center py-8"><ActivityIndicator size="small" color={c.muted} /></View>
              ) : existing ? (
                // ── Already onboarded ──
                <View className="mt-4 rounded-2xl border border-line bg-surface p-5">
                  <View className="mb-2 flex-row items-center gap-2">
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                    <Text className="font-sans-bold text-[16px] text-ink">Already on Aangan</Text>
                  </View>
                  <Text className="mb-4 text-[14px] leading-[21px] text-muted">
                    <Text className="font-sans-bold text-ink">{existing.name}</Text> is already set up. You don't need to onboard it again — just create your account in it.
                  </Text>
                  <Button label={`Sign up in ${existing.name}`} icon="arrow-forward" fullWidth onPress={signUpExisting} />
                </View>
              ) : (
                // ── New society — onboard form ──
                <View className="mt-4">
                  <View className="mb-4 flex-row items-center gap-2 self-start rounded-full px-3 py-1.5" style={{ backgroundColor: '#0D948822' }}>
                    <Ionicons name="sparkles" size={13} color="#0D9488" />
                    <Text className="text-[12px] font-sans-sb" style={{ color: '#0D9488' }}>New society — you'll be its admin</Text>
                  </View>

                  <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Society name</Text>
                  <TextInput value={name} onChangeText={setName} placeholder="Society name" placeholderTextColor={c.faint} className="mb-4 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink" style={{ outline: 'none' } as any} />

                  <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Address</Text>
                  <TextInput value={address} onChangeText={setAddress} placeholder="Address" placeholderTextColor={c.faint} multiline className="mb-2 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink" style={{ minHeight: 64, outline: 'none' } as any} />
                  <Text className="mb-4 text-[12px] text-faint">Pulled from the map — edit if anything's off.</Text>

                  <Button label="Continue — create my account" icon="arrow-forward" fullWidth disabled={!name.trim()} onPress={onboardNew} />
                  <Text className="mt-3 text-center text-[12px] leading-[18px] text-faint">
                    You'll set up your profile and PIN next. As the founder you become the society admin and can invite neighbours.
                  </Text>
                </View>
              )}
            </>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}
