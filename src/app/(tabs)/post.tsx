import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Empty } from '../../components/Empty';
import { Field, Label, SectionCard } from '../../components/forms';
import { CreateListingForm } from '../../components/listings/CreateListingForm';
import { Avatar, Button, ChoiceTiles, Container, Stepper, useResponsive, VegMark } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useProfile } from '../../context/profile';
import { useToast } from '../../context/toast';
import { AIError, visionAutofill } from '../../lib/ai';
import { fetchMyRecentDishes, postDish } from '../../lib/dishes';
import { haptics } from '../../lib/haptics';
import { SERVICES, getService } from '../../lib/services';
import { isSupabaseConfigured } from '../../lib/supabase';
import { createTiffinPlan } from '../../lib/tiffin';
import { slotOrderBy } from '../../lib/time';
import { DishRow, DOW_LABELS, SLOTS, Slot, VEG_TYPES, VegType, SLOT_EMOJI } from '../../lib/types';
import { useThemeColors } from '../../theme';

const SLOT_HINTS: Record<Slot, string> = {
  Breakfast: '7 – 10 AM',
  Lunch: '12 – 2 PM',
  Dinner: '7 – 9 PM',
  Snack: 'Anytime',
};

/**
 * The Post screen. Used as the `/post` route (category picker → form) and also
 * embedded inside the Food screen (with `embedded` + a forced `category`/`kind`)
 * so the food tab bar stays visible while posting a dish or tiffin.
 */
export default function PostScreen({
  embedded, category: forceCategory, kind: forceKind, onDone,
}: { embedded?: boolean; category?: string; kind?: string; onDone?: () => void } = {}) {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { userId, isChef, communityId } = useAuth();
  const { profile, ready, update } = useProfile();

  // ── All hooks unconditionally at top (Rules of Hooks) ────────────────
  const params = useLocalSearchParams<{ category?: string; kind?: string }>();
  const finishOrHome = () => (onDone ? onDone() : router.push('/'));
  const [selectedCategory, setSelectedCategory] = useState<string | null>(forceCategory ?? null);
  const [mode, setMode] = useState<'dish' | 'tiffin'>(forceKind === 'tiffin' ? 'tiffin' : 'dish');

  const [chefName, setChefName] = useState('');
  const [flat, setFlat] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [upi, setUpi] = useState('');
  const [editingIdentity, setEditingIdentity] = useState(false);

  const [dishName, setDishName] = useState('');
  const [slot, setSlot] = useState<Slot | null>(null);
  const [vegType, setVegType] = useState<VegType | null>(null);
  const [price, setPrice] = useState('');
  const [maxPlates, setMaxPlates] = useState(5);
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [serveOffset, setServeOffset] = useState(0);
  const [cutoff, setCutoff] = useState<CutoffKey>('auto');
  const [submitting, setSubmitting] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [photoFlagged, setPhotoFlagged] = useState(false); // AI said the photo isn't food

  const [tTitle, setTTitle] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tVeg, setTVeg] = useState<VegType | null>(null);
  const [tSlot, setTSlot] = useState<Slot | null>(null);
  const [tPrice, setTPrice] = useState('');
  const [tDays, setTDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [tMax, setTMax] = useState(5);
  const [tCutoff, setTCutoff] = useState('');

  const [recent, setRecent] = useState<DishRow[]>([]);

  // Tab screens stay mounted — sync category & mode from params on every focus
  // (useState initializer only runs once, so it would go stale between navigations)
  useFocusEffect(
    useCallback(() => {
      // category=food → dish/tiffin form; a listing category → its form; none → picker
      const cat = forceCategory ?? params.category;
      setSelectedCategory(cat ?? null);
      setMode((forceKind ?? params.kind) === 'tiffin' ? 'tiffin' : 'dish');
    }, [params.category, params.kind, forceCategory, forceKind])
  );

  useEffect(() => {
    if (isChef && userId) fetchMyRecentDishes(userId).then(setRecent).catch(() => {});
  }, [isChef, userId]);

  const applyRecent = (d: DishRow) => {
    setDishName(d.dish_name);
    setSlot(d.slot);
    setVegType(d.veg_type);
    setPrice(String(d.price));
    setMaxPlates(d.max_plates);
    setDescription(d.description ?? '');
    haptics.tap();
    toast.show('Filled from a past dish ✏️');
  };

  useEffect(() => {
    if (ready) {
      setChefName(profile.chefName);
      setFlat(profile.flat);
      setWhatsapp(profile.whatsapp);
      setUpi(profile.upi);
    }
  }, [ready, profile]);

  const hasSavedIdentity = ready && !!profile.chefName && !!profile.flat && !!profile.whatsapp;
  const showIdentityForm = editingIdentity || !hasSavedIdentity;

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled) { setPhotoUri(result.assets[0].uri); setPhotoFlagged(false); }
  };

  const autofillFromPhoto = async () => {
    if (!photoUri) return;
    haptics.tap();
    setAutofilling(true);
    try {
      const r = await visionAutofill('dish', photoUri, dishName || undefined);
      setDishName(r.dish_name);
      setVegType(r.veg_type);
      if (r.suggested_slot && !slot) setSlot(r.suggested_slot);
      if (r.description) setDescription(r.description);
      setPhotoFlagged(false);
      haptics.success();
      toast.show('Filled from your photo ✨ — set the price & post');
    } catch (e) {
      if (e instanceof AIError && e.code === 'not_relevant') setPhotoFlagged(true);
      toast.show(e instanceof AIError ? e.message : 'Could not read the photo — fill it in');
    } finally {
      setAutofilling(false);
    }
  };

  const submit = async () => {
    if (!isSupabaseConfigured) {
      toast.show('Connect Supabase first — see the banner on Discover ⚙️');
      return;
    }
    if (photoFlagged) {
      toast.show("This photo doesn't look like food — change or remove it ⚠️");
      return;
    }
    const priceNum = parseInt(price, 10);
    if (!chefName.trim() || !flat.trim() || !whatsapp.trim()) {
      setEditingIdentity(true);
      toast.show('Please add your name, flat and WhatsApp ⚠️');
      return;
    }
    const missing: string[] = [];
    if (!dishName.trim()) missing.push('dish name');
    if (!slot) missing.push('meal slot');
    if (!vegType) missing.push('veg / non-veg');
    if (!priceNum) missing.push('price per plate');
    if (missing.length) {
      toast.show(`Please add ${missing.join(', ')} ⚠️`);
      return;
    }

    setSubmitting(true);
    try {
      await update({ chefName, flat, whatsapp, upi });
      await postDish({
        chefUserId: userId!,
        communityId,
        profile: { chefName, flat, whatsapp, upi },
        dishName,
        slot: slot!,
        vegType: vegType!,
        price: priceNum,
        maxPlates,
        description,
        photoUri,
        serveDate: serveDateStr(serveOffset),
        orderBy: computeOrderBy(cutoff, slot, serveOffset),
      });

      setDishName('');
      setSlot(null);
      setVegType(null);
      setPrice('');
      setMaxPlates(5);
      setDescription('');
      setPhotoUri(null);
      setServeOffset(0);
      setCutoff('auto');
      setEditingIdentity(false);

      haptics.success();
      toast.show('Your dish is live on the board! 🎉');
      finishOrHome();
    } catch (e) {
      console.error(e);
      toast.show('Could not post — check your connection');
    } finally {
      setSubmitting(false);
    }
  };

  const submitTiffin = async () => {
    if (!isSupabaseConfigured) {
      toast.show('Connect Supabase first ⚙️');
      return;
    }
    const priceNum = parseInt(tPrice, 10);
    if (!chefName.trim() || !flat.trim() || !whatsapp.trim()) {
      setEditingIdentity(true);
      return toast.show('Please add your name, flat and WhatsApp ⚠️');
    }
    const tMissing: string[] = [];
    if (!tTitle.trim()) tMissing.push('tiffin name');
    if (tDays.length === 0) tMissing.push('days of the week');
    if (!tSlot) tMissing.push('meal slot');
    if (!tVeg) tMissing.push('veg / non-veg');
    if (!priceNum) tMissing.push('price per day');
    if (tMissing.length) {
      return toast.show(`Please add ${tMissing.join(', ')} ⚠️`);
    }
    if (tCutoff && !/^\d{1,2}:\d{2}$/.test(tCutoff.trim())) {
      return toast.show('Cutoff must look like 09:00 ⚠️');
    }

    setSubmitting(true);
    try {
      await update({ chefName, flat, whatsapp, upi });
      await createTiffinPlan({
        chefUserId: userId!,
        communityId,
        title: tTitle,
        description: tDesc,
        vegType: tVeg!,
        slot: tSlot!,
        price: priceNum,
        daysOfWeek: tDays,
        maxPerDay: tMax,
        cutoffTime: tCutoff.trim() || null,
      });
      setTTitle('');
      setTDesc('');
      setTVeg(null);
      setTSlot(null);
      setTPrice('');
      setTDays([1, 2, 3, 4, 5]);
      setTMax(5);
      setTCutoff('');
      haptics.success();
      toast.show('Your tiffin service is live! 🍱');
      finishOrHome();
    } catch (e) {
      console.error(e);
      toast.show('Could not post the tiffin — try again');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Conditional renders (after all hooks) ─────────────────────────────

  // Non-food listing category → show its create form
  if (selectedCategory && selectedCategory !== 'food') {
    const listingCat = getService(selectedCategory);
    if (listingCat) {
      return <CreateListingForm key={selectedCategory} cat={listingCat} onBack={() => setSelectedCategory(null)} />;
    }
  }

  // No category selected → show category picker
  if (!selectedCategory) {
    return (
      <ScrollView
        className="flex-1 bg-bg"
        contentContainerStyle={{ paddingTop: isDesktop ? insets.top + 24 : 24, paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Container>
          <Text className="mb-1 text-[13px] font-sans-md text-accent">Share with your society</Text>
          <Text className="mb-6 font-display-x text-[28px] text-ink">What are you posting?</Text>
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -5 }}>
            {SERVICES.map((svc) => (
              <View key={svc.key} style={{ width: isDesktop ? '33.333%' : '50%', padding: 5 }}>
                <Pressable
                  onPress={() => setSelectedCategory(svc.key)}
                  className="overflow-hidden rounded-2xl bg-surface active:opacity-75"
                  style={{ borderWidth: 1, borderColor: c.line }}
                >
                  <View style={{ height: 3, backgroundColor: svc.color }} />
                  <View className="p-3.5">
                    <View
                      className="mb-2.5 h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: svc.color + '20' }}
                    >
                      <Ionicons name={svc.icon as any} size={20} color={svc.color} />
                    </View>
                    <Text className="font-sans-bold text-[13px] text-ink" numberOfLines={1}>{svc.label}</Text>
                    <Text className="mt-0.5 text-[11px] font-sans-md text-muted" numberOfLines={2}>{svc.blurb}</Text>
                  </View>
                </Pressable>
              </View>
            ))}
          </View>
        </Container>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingTop: embedded ? 14 : isDesktop ? insets.top + 18 : 18, paddingHorizontal: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Container narrow>
          {embedded ? (
            <Pressable onPress={onDone} className="mb-2 flex-row items-center gap-1 self-start active:opacity-60">
              <Ionicons name="chevron-back" size={18} color={c.muted} />
              <Text className="font-sans-md text-[14px] text-muted">Back</Text>
            </Pressable>
          ) : null}
          <Text className="text-[13px] font-sans-md text-accent">Share your kitchen</Text>
          <Text className="mb-4 font-display-x text-[30px] text-ink">{mode === 'dish' ? 'Post a dish' : 'Post a tiffin'}</Text>

          {/* photo first (dishes only) */}
          {mode === 'dish' && (photoUri ? (
            <View className="mb-4 overflow-hidden rounded-3xl">
              <Image source={{ uri: photoUri }} style={{ width: '100%', height: 220 }} contentFit="cover" />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 }} />
              <View className="absolute bottom-3 right-3 flex-row gap-2">
                <Pressable onPress={pickPhoto} className="flex-row items-center gap-1.5 rounded-full bg-white/95 px-3 py-2">
                  <Ionicons name="camera-outline" size={15} color="#16171A" />
                  <Text className="font-sans-sb text-[12px] text-[#16171A]">Change</Text>
                </Pressable>
                <Pressable onPress={() => { setPhotoUri(null); setPhotoFlagged(false); }} className="rounded-full bg-white/95 px-3 py-2">
                  <Ionicons name="trash-outline" size={15} color="#E0322B" />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={pickPhoto}
              className="mb-4 items-center justify-center rounded-3xl border-2 border-dashed border-line bg-inset py-10 active:opacity-80"
            >
              <View className="mb-2 h-14 w-14 items-center justify-center rounded-full bg-surface">
                <Ionicons name="camera" size={26} color={c.accent} />
              </View>
              <Text className="font-sans-sb text-[14px] text-ink">Add a photo of your dish</Text>
              <Text className="mt-0.5 text-[12px] text-faint">A tasty photo gets more orders (optional)</Text>
            </Pressable>
          ))}

          {/* AI autofill — read the photo and pre-fill the form */}
          {mode === 'dish' && photoUri ? (
            <Pressable
              onPress={autofillFromPhoto}
              disabled={autofilling}
              className="-mt-1 mb-4 flex-row items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent-soft py-3 active:opacity-80"
              style={{ opacity: autofilling ? 0.6 : 1 }}
            >
              <Ionicons name="sparkles" size={16} color={c.accent} />
              <Text className="font-sans-sb text-[13px] text-accent">
                {autofilling ? 'Reading your photo…' : 'Autofill details from photo'}
              </Text>
            </Pressable>
          ) : null}

          {/* photo doesn't look like food — block posting until it's changed */}
          {mode === 'dish' && photoUri && photoFlagged ? (
            <View className="-mt-1 mb-4 flex-row items-start gap-2 rounded-2xl border border-nonveg/40 bg-nonveg/10 px-3.5 py-3">
              <Ionicons name="alert-circle" size={16} color={c.nonveg} />
              <Text className="flex-1 text-[12px] leading-[17px] text-nonveg">
                This photo doesn't look like food. Please change or remove it before posting your dish.
              </Text>
            </View>
          ) : null}

          {/* identity */}
          {showIdentityForm ? (
            <SectionCard title="Your details" subtitle="Saved on this device — typed once, reused next time">
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="Chef name" required placeholder="Pratibha Priti" value={chefName} onChangeText={setChefName} />
                </View>
                <View className="w-28">
                  <Field label="Flat" required placeholder="A-204" value={flat} onChangeText={setFlat} />
                </View>
              </View>
              <Field label="WhatsApp number" required placeholder="98765 43210" keyboardType="phone-pad" value={whatsapp} onChangeText={setWhatsapp} />
              <Field label="UPI ID" hint="Optional — shown to buyers so they can pay you" placeholder="priya@ybl" autoCapitalize="none" value={upi} onChangeText={setUpi} />
              {hasSavedIdentity ? <Button label="Done" variant="outline" size="sm" onPress={() => setEditingIdentity(false)} /> : null}
            </SectionCard>
          ) : (
            <View className="mb-4 flex-row items-center gap-3 rounded-3xl border border-line bg-surface p-3.5">
              <Avatar name={chefName} size={40} />
              <View className="flex-1">
                <Text className="font-sans-sb text-[14px] text-ink">{chefName}</Text>
                <Text className="text-[12px] text-faint">Flat {flat} · {whatsapp}</Text>
              </View>
              <Pressable onPress={() => setEditingIdentity(true)} className="flex-row items-center gap-1 rounded-full bg-inset px-3 py-2">
                <Ionicons name="pencil" size={13} color={c.accent} />
                <Text className="font-sans-sb text-[12px] text-accent">Edit</Text>
              </Pressable>
            </View>
          )}

          {/* dish details */}
          {mode === 'dish' ? (
          <SectionCard title="About your dish">
            {recent.length > 0 ? (
              <View className="mb-3.5">
                <Label>Post again</Label>
                <View className="-mx-1 flex-row flex-wrap">
                  {recent.map((d) => (
                    <View key={d.id} style={{ padding: 3 }}>
                      <Pressable onPress={() => applyRecent(d)} className="flex-row items-center gap-1.5 rounded-full border border-line bg-inset px-3 py-2 active:border-accent">
                        <Text className="text-[12px] font-sans-md text-ink" numberOfLines={1}>{SLOT_EMOJI[d.slot]} {d.dish_name}</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <Field label="Dish name" required placeholder="Masala Dosa with Sambar" value={dishName} onChangeText={setDishName} />

            <Label required>Cooking on</Label>
            <View className="mb-3.5 flex-row flex-wrap" style={{ marginHorizontal: -3 }}>
              {SERVE_OFFSETS.map((n) => {
                const on = serveOffset === n;
                return (
                  <View key={n} style={{ padding: 3 }}>
                    <Pressable
                      onPress={() => setServeOffset(n)}
                      className={`rounded-full border px-3.5 py-2 ${on ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}
                    >
                      <Text className={`text-[12px] ${on ? 'font-sans-sb text-accent' : 'font-sans-md text-muted'}`}>{serveLabel(n)}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <Label required>Meal slot</Label>
            <View className="mb-3.5">
              <ChoiceTiles
                columns={2}
                value={slot}
                onChange={setSlot}
                options={SLOTS.map((s) => ({ value: s, label: `${SLOT_EMOJI[s]} ${s}`, hint: SLOT_HINTS[s] }))}
              />
            </View>

            <Label required>Veg / Non-veg</Label>
            <View className="mb-3.5">
              <ChoiceTiles
                columns={3}
                value={vegType}
                onChange={setVegType}
                options={VEG_TYPES.map((v) => ({ value: v, label: v, leading: <VegMark type={v} size={16} /> }))}
              />
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="Price / plate" required prefix="₹" placeholder="80" keyboardType="number-pad" value={price} onChangeText={setPrice} />
              </View>
              <View>
                <Label required>Plates</Label>
                <Stepper value={maxPlates} min={1} max={50} onChange={setMaxPlates} />
              </View>
            </View>

            <Label>Accept orders until</Label>
            <View className="mb-3.5 flex-row flex-wrap" style={{ marginHorizontal: -3 }}>
              {CUTOFFS.map((opt) => {
                const on = cutoff === opt.key;
                return (
                  <View key={opt.key} style={{ padding: 3 }}>
                    <Pressable
                      onPress={() => setCutoff(opt.key)}
                      className={`rounded-full border px-3.5 py-2 ${on ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}
                    >
                      <Text className={`text-[12px] ${on ? 'font-sans-sb text-accent' : 'font-sans-md text-muted'}`}>{opt.label}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
            <Text className="-mt-2 mb-2 text-[11px] text-faint">
              {cutoffPreview(cutoff, slot, serveOffset)} · neighbours can't order after this.
            </Text>

            <Field
              label="Description"
              hint="Optional — spice level, allergens, ready time…"
              placeholder="Crispy dosa with homemade coconut chutney & sambar"
              multiline
              value={description}
              onChangeText={setDescription}
            />
          </SectionCard>
          ) : (
          <SectionCard title="About your tiffin">
            <Field label="Tiffin name" required placeholder="Homemade Lunch Dabba" value={tTitle} onChangeText={setTTitle} />

            <Label required>Days of the week</Label>
            <View className="mb-3.5 flex-row gap-1.5">
              {DOW_LABELS.map((d, i) => {
                const on = tDays.includes(i);
                return (
                  <Pressable
                    key={i}
                    onPress={() => setTDays((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))}
                    className={`h-10 flex-1 items-center justify-center rounded-xl border ${on ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}
                  >
                    <Text className={`text-[12px] ${on ? 'font-sans-sb text-accent' : 'font-sans-md text-muted'}`}>{d[0]}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Label required>Meal slot</Label>
            <View className="mb-3.5">
              <ChoiceTiles columns={2} value={tSlot} onChange={setTSlot} options={SLOTS.map((s) => ({ value: s, label: `${SLOT_EMOJI[s]} ${s}`, hint: SLOT_HINTS[s] }))} />
            </View>

            <Label required>Veg / Non-veg</Label>
            <View className="mb-3.5">
              <ChoiceTiles columns={3} value={tVeg} onChange={setTVeg} options={VEG_TYPES.map((v) => ({ value: v, label: v, leading: <VegMark type={v} size={16} /> }))} />
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="Price / day" required prefix="₹" placeholder="80" keyboardType="number-pad" value={tPrice} onChangeText={setTPrice} />
              </View>
              <View>
                <Label required>Max / day</Label>
                <Stepper value={tMax} min={1} max={50} onChange={setTMax} />
              </View>
            </View>

            <Field label="Daily order cutoff" hint="Optional — e.g. 09:00 (subscribers lock for the day after this)" placeholder="HH:MM" value={tCutoff} onChangeText={setTCutoff} />
            <Field label="Description" hint="Optional — what's usually included" placeholder="2 sabzi, dal, 4 rotis, rice & salad" multiline value={tDesc} onChangeText={setTDesc} />
          </SectionCard>
          )}

          <Button
            label={submitting ? 'Posting…' : mode === 'dish' ? 'Post to the board' : 'Post tiffin service'}
            icon="checkmark-circle"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={mode === 'dish' && photoFlagged}
            onPress={mode === 'dish' ? submit : submitTiffin}
          />
          <Text className="mt-2.5 text-center text-[12px] leading-4 text-faint">
            Goes live instantly for everyone in the society.
          </Text>
        </Container>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Order-cutoff presets ────────────────────────────────────────────
type CutoffKey = 'auto' | '1h' | '2h' | '3h' | 'none';
const CUTOFFS: { key: CutoffKey; label: string }[] = [
  { key: 'auto', label: 'Default' },
  { key: '1h', label: '+1 hr' },
  { key: '2h', label: '+2 hrs' },
  { key: '3h', label: '+3 hrs' },
  { key: 'none', label: 'No limit' },
];

// ── Serve-date presets ──────────────────────────────────────────────
const SERVE_OFFSETS = [0, 1, 2, 3];

function addDays(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}
function serveDateStr(n: number): string {
  return addDays(n).toLocaleDateString('en-CA'); // YYYY-MM-DD
}
function serveLabel(n: number): string {
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return addDays(n).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
}

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

function computeOrderBy(cutoff: CutoffKey, slot: Slot | null, serveOffset: number): string | null {
  const base = addDays(serveOffset);
  if (cutoff === 'none') return null;
  if ((cutoff === '1h' || cutoff === '2h' || cutoff === '3h') && serveOffset === 0) {
    return hoursFromNow(cutoff === '1h' ? 1 : cutoff === '2h' ? 2 : 3);
  }
  // future days (or 'auto'): use the slot's cutoff time on the serve date
  return slot ? slotOrderBy(slot, base) : null;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function cutoffPreview(cutoff: CutoffKey, slot: Slot | null, serveOffset: number): string {
  const iso = computeOrderBy(cutoff, slot, serveOffset);
  if (!iso) return 'Orders stay open all day';
  return `Orders close at ${fmtTime(iso)}${serveOffset > 0 ? ` on ${serveLabel(serveOffset)}` : ''}`;
}
