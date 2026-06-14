import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { AIError, visionAutofill } from '../../lib/ai';
import { haptics } from '../../lib/haptics';
import { postListing, updateListing } from '../../lib/listings';
import { ListingRow } from '../../lib/types';
import { AttrField, ServiceCategory } from '../../lib/services';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useThemeColors } from '../../theme';
import { Field, Label, SectionCard } from '../forms';
import { Avatar, Button, ChoiceTiles, Container, useResponsive } from '../ui';

interface Props {
  cat: ServiceCategory;
  onBack: () => void;
  existing?: ListingRow; // when set, the form edits this listing instead of creating
}

export function CreateListingForm({ cat, onBack, existing }: Props) {
  const toast = useToast();
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { userId, profile, communityId } = useAuth();

  const isDirectory = cat.listingType === 'recommendation';
  const isEdit = !!existing;

  // Core fields
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(existing?.photos?.[0] ?? null);
  const [price, setPrice] = useState(existing?.price != null ? String(existing.price) : '');
  const [location, setLocation] = useState(existing?.location ?? '');

  // Directory-specific
  const [referralName, setReferralName] = useState(existing?.referral_name ?? '');
  const [referralPhone, setReferralPhone] = useState(existing?.referral_phone ?? '');

  // Dynamic category attributes
  const [attrs, setAttrs] = useState<Record<string, unknown>>((existing?.attributes as Record<string, unknown>) ?? {});

  const [submitting, setSubmitting] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [photoFlagged, setPhotoFlagged] = useState(false); // AI said the photo isn't a sellable item

  const setAttr = (key: string, value: unknown) => {
    setAttrs((prev) => ({ ...prev, [key]: value }));
  };

  const toggleMultiAttr = (key: string, option: string) => {
    const cur = (attrs[key] as string[] | undefined) ?? [];
    const next = cur.includes(option) ? cur.filter((v) => v !== option) : [...cur, option];
    setAttr(key, next.length ? next : undefined);
  };

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
      const r = await visionAutofill('listing', photoUri, title || undefined);
      setTitle(r.title);
      if (r.description) setDescription(r.description);
      setPhotoFlagged(false);
      haptics.success();
      toast.show('Filled from your photo ✨ — check & tweak it');
    } catch (e) {
      if (e instanceof AIError && e.code === 'not_relevant') setPhotoFlagged(true);
      toast.show(e instanceof AIError ? e.message : 'Could not read the photo — fill it in');
    } finally {
      setAutofilling(false);
    }
  };

  const submit = async () => {
    if (!isSupabaseConfigured) {
      toast.show('Connect Supabase first ⚙️');
      return;
    }
    if (photoFlagged) {
      toast.show("This photo doesn't match the listing — change or remove it ⚠️");
      return;
    }
    if (!userId) {
      toast.show('You must be signed in to post');
      return;
    }

    const effectiveTitle = isDirectory ? referralName.trim() : title.trim();
    if (!effectiveTitle) {
      toast.show(isDirectory ? 'Please enter the service person\'s name ⚠️' : 'Please enter a title ⚠️');
      return;
    }
    if (isDirectory && !referralPhone.trim()) {
      toast.show('Please enter the service person\'s phone number ⚠️');
      return;
    }

    // Validate required attributes
    for (const f of cat.attributes) {
      if (f.required) {
        const val = attrs[f.key];
        const isEmpty = val === undefined || val === null || val === '' ||
          (Array.isArray(val) && val.length === 0);
        if (isEmpty) {
          toast.show(`Please fill in "${f.label}" ⚠️`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const priceNum = price.trim() ? parseInt(price, 10) : null;
      const resolvedTitle = isDirectory ? `${referralName} – ${attrs['trade'] ?? ''}`.trim() : effectiveTitle;
      const finalPrice = priceNum && !isNaN(priceNum) ? priceNum : null;
      if (isEdit && existing) {
        await updateListing(existing.id, {
          title: resolvedTitle,
          description,
          photoUri,
          price: finalPrice,
          priceUnit: cat.priceLabel ?? null,
          location: location || null,
          isReferral: isDirectory,
          referralName: isDirectory ? referralName.trim() : null,
          referralPhone: isDirectory ? referralPhone.trim() : null,
          attributes: attrs,
        });
        haptics.success();
        toast.show('Updated ✓');
        router.replace(`/listing/${existing.id}` as any);
      } else {
        await postListing({
          category: cat.key,
          communityId: communityId ?? undefined,
          ownerUserId: userId,
          title: resolvedTitle,
          description,
          photoUri,
          price: finalPrice,
          priceUnit: cat.priceLabel ?? null,
          whatsapp: profile?.whatsapp ?? null,
          location: location || null,
          isReferral: isDirectory,
          referralName: isDirectory ? referralName.trim() : null,
          referralPhone: isDirectory ? referralPhone.trim() : null,
          attributes: attrs,
        });
        haptics.success();
        toast.show(`Posted to ${cat.label}! 🎉`);
        router.push(`/c/${cat.key}` as any);
      }
    } catch (e) {
      console.error(e);
      toast.show('Could not post — check your connection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingTop: isDesktop ? insets.top + 18 : 18, paddingHorizontal: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Container narrow>
          {/* Back + header */}
          <Pressable onPress={onBack} className="mb-4 flex-row items-center gap-1 self-start active:opacity-60">
            <Ionicons name="chevron-back" size={18} color={c.muted} />
            <Text className="font-sans-md text-[14px] text-muted">Post</Text>
          </Pressable>

          <View className="mb-1 flex-row items-center gap-2">
            <View
              className="h-8 w-8 items-center justify-center rounded-xl"
              style={{ backgroundColor: cat.color + '22' }}
            >
              <Ionicons name={cat.icon as any} size={18} color={cat.color} />
            </View>
            <Text className="font-sans-md text-[13px]" style={{ color: cat.color }}>{cat.label}</Text>
          </View>
          <Text className="mb-4 font-display-x text-[28px] text-ink">
            {isEdit ? (isDirectory ? 'Edit contact' : 'Edit listing') : isDirectory ? 'Recommend a contact' : 'Post a listing'}
          </Text>

          {/* Photo picker */}
          {!isDirectory && (photoUri ? (
            <View className="mb-4 overflow-hidden rounded-3xl">
              <Image source={{ uri: photoUri }} style={{ width: '100%', height: 200 }} contentFit="cover" />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 }} />
              <View className="absolute bottom-3 right-3 flex-row gap-2">
                <Pressable onPress={pickPhoto} className="flex-row items-center gap-1.5 rounded-full bg-white/95 px-3 py-2">
                  <Ionicons name="camera-outline" size={14} color="#16171A" />
                  <Text className="font-sans-sb text-[12px] text-[#16171A]">Change</Text>
                </Pressable>
                <Pressable onPress={() => { setPhotoUri(null); setPhotoFlagged(false); }} className="rounded-full bg-white/95 px-3 py-2">
                  <Ionicons name="trash-outline" size={14} color="#E0322B" />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={pickPhoto}
              className="mb-4 items-center justify-center rounded-3xl border-2 border-dashed border-line bg-inset py-8 active:opacity-80"
            >
              <Ionicons name="camera" size={24} color={c.accent} />
              <Text className="mt-2 font-sans-sb text-[13px] text-ink">Add a photo</Text>
              <Text className="mt-0.5 text-[11px] text-faint">Optional but recommended</Text>
            </Pressable>
          ))}

          {/* AI autofill — read the item photo and pre-fill title + description */}
          {!isDirectory && photoUri ? (
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

          {/* photo doesn't look like a sellable item — block posting until changed */}
          {!isDirectory && photoUri && photoFlagged ? (
            <View className="-mt-1 mb-4 flex-row items-start gap-2 rounded-2xl border border-nonveg/40 bg-nonveg/10 px-3.5 py-3">
              <Ionicons name="alert-circle" size={16} color={c.nonveg} />
              <Text className="flex-1 text-[12px] leading-[17px] text-nonveg">
                This photo doesn't look like an item you can list. Please change or remove it before posting.
              </Text>
            </View>
          ) : null}

          {/* Who is posting (identity card) */}
          {profile && (
            <View className="mb-4 flex-row items-center gap-3 rounded-3xl border border-line bg-surface p-3.5">
              <Avatar name={profile.name} size={38} />
              <View className="flex-1">
                <Text className="font-sans-sb text-[13px] text-ink">{profile.name}</Text>
                <Text className="text-[11px] text-faint">Flat {profile.flat ?? '—'}</Text>
              </View>
            </View>
          )}

          {/* Core fields */}
          <SectionCard title={isDirectory ? 'Service person details' : 'Listing details'}>
            {isDirectory ? (
              <>
                <Field
                  label="Name"
                  required
                  placeholder="Ramesh, Sunita Devi…"
                  value={referralName}
                  onChangeText={setReferralName}
                />
                <Field
                  label="Their phone number"
                  required
                  placeholder="98765 43210"
                  keyboardType="phone-pad"
                  value={referralPhone}
                  onChangeText={setReferralPhone}
                />
              </>
            ) : (
              <Field
                label="Title"
                required
                placeholder={cat.key === 'jobs' ? 'Software Engineer at TCS…' : cat.key === 'market' ? 'Dell laptop, like new…' : `Your ${cat.label} offering…`}
                value={title}
                onChangeText={setTitle}
              />
            )}

            {cat.priceLabel && !isDirectory && (
              <Field
                label={`Price (${cat.priceLabel})`}
                prefix="₹"
                placeholder="0"
                keyboardType="number-pad"
                hint="Leave blank if negotiable / free"
                value={price}
                onChangeText={setPrice}
              />
            )}

            <Field
              label={isDirectory ? 'Why do you recommend them?' : 'Description'}
              placeholder={isDirectory ? 'Reliable, professional, fair pricing…' : "More details, timings, what's included…"}
              hint="Optional"
              multiline
              value={description}
              onChangeText={setDescription}
            />

            <Field
              label="Location / Flat"
              placeholder="Flat B-402, or Anywhere in the society"
              hint="Optional"
              value={location}
              onChangeText={setLocation}
            />
          </SectionCard>

          {/* Category-specific attributes */}
          {cat.attributes.length > 0 && (
            <SectionCard title="Details">
              {cat.attributes.map((field) => renderAttrField(field, attrs, setAttr, toggleMultiAttr, c))}
            </SectionCard>
          )}

          <Button
            label={isEdit ? (submitting ? 'Saving…' : 'Save changes') : submitting ? 'Posting…' : `Post to ${cat.label}`}
            icon="checkmark-circle"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={photoFlagged}
            onPress={submit}
          />
          <Text className="mt-2 text-center text-[12px] leading-4 text-faint">
            Visible to everyone in the society immediately.
          </Text>
        </Container>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function renderAttrField(
  field: AttrField,
  attrs: Record<string, unknown>,
  setAttr: (key: string, value: unknown) => void,
  toggleMulti: (key: string, option: string) => void,
  c: ReturnType<typeof useThemeColors>
) {
  const val = attrs[field.key];

  if (field.type === 'text') {
    return (
      <Field
        key={field.key}
        label={field.label}
        required={field.required}
        placeholder={field.placeholder}
        value={(val as string) ?? ''}
        onChangeText={(t) => setAttr(field.key, t)}
      />
    );
  }

  if (field.type === 'number') {
    return (
      <Field
        key={field.key}
        label={field.label}
        required={field.required}
        placeholder={field.placeholder ?? '0'}
        keyboardType="number-pad"
        value={(val as string) ?? ''}
        onChangeText={(t) => setAttr(field.key, t)}
      />
    );
  }

  if (field.type === 'select' && field.options) {
    return (
      <View key={field.key} className="mb-3.5">
        <Label required={field.required}>{field.label}</Label>
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -3 }}>
          {field.options.map((opt) => {
            const on = val === opt;
            return (
              <View key={opt} style={{ padding: 3 }}>
                <Pressable
                  onPress={() => setAttr(field.key, on ? undefined : opt)}
                  className={`rounded-full border px-3.5 py-2 ${on ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}
                >
                  <Text className={`text-[12px] ${on ? 'font-sans-sb text-accent' : 'font-sans-md text-muted'}`}>{opt}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  if (field.type === 'multiselect' && field.options) {
    const selected = (val as string[] | undefined) ?? [];
    return (
      <View key={field.key} className="mb-3.5">
        <Label required={field.required}>{field.label}</Label>
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -3 }}>
          {field.options.map((opt) => {
            const on = selected.includes(opt);
            return (
              <View key={opt} style={{ padding: 3 }}>
                <Pressable
                  onPress={() => toggleMulti(field.key, opt)}
                  className={`rounded-full border px-3.5 py-2 ${on ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}
                >
                  <Text className={`text-[12px] ${on ? 'font-sans-sb text-accent' : 'font-sans-md text-muted'}`}>{opt}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  if (field.type === 'toggle') {
    const on = Boolean(val);
    return (
      <View key={field.key} className="mb-3.5 flex-row items-center justify-between">
        <Text className="font-sans-md text-[14px] text-ink">{field.label}</Text>
        <Switch
          value={on}
          onValueChange={(v) => setAttr(field.key, v)}
          trackColor={{ true: c.accent }}
          thumbColor="#fff"
        />
      </View>
    );
  }

  return null;
}
