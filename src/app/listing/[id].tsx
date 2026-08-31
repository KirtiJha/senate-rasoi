import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InquiryModal } from '../../components/listings/InquiryModal';
import { ListingChat } from '../../components/listings/ListingChat';
import { PayButton } from '../../components/PayButton';
import { T } from '../../components/T';
import { Avatar, Badge, Button, Container, ErrorState, KeyboardAvoider, ParallaxHero, useResponsive } from '../../components/ui';
import { ModerationMenu } from '../../components/ModerationMenu';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { useConfirm } from '../../context/confirm';
import { haptics } from '../../lib/haptics';
import { AScrollView } from '../../lib/motion';
import { IMAGE_CACHE_PROPS } from '../../lib/image';
import { sendInquiry } from '../../lib/inquiries';
import { buildInquiryWhatsAppLink, deleteListing, fetchListingById, setListingStatus } from '../../lib/listings';
import { isListingSaved, saveListing, unsaveListing } from '../../lib/saved';
import { getService } from '../../lib/services';
import { ListingRow } from '../../lib/types';
import { useThemeColors } from '../../theme';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { userId, profile, isAdmin } = useAuth();
  const c = useThemeColors();

  const [listing, setListing] = useState<ListingRow | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inquiryListing, setInquiryListing] = useState<ListingRow | null>(null);
  const [saved, setSaved] = useState(false);

  // On web, opening this route directly (or after a refresh) leaves an empty
  // history stack, so router.back() is a no-op. Fall back to the listings tab.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/listings' as any);
  };

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setListing(await fetchListingById(id));
      setLoadFailed(false);
    } catch (e) {
      // A thrown error means we never heard back — NOT that the listing was
      // deleted. Telling a resident it was "removed by the owner" because
      // their signal dropped starts arguments between neighbours.
      console.error('listing: load failed', e);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const retry = useCallback(async () => {
    setRetrying(true);
    setLoading(true);
    await load();
    setRetrying(false);
  }, [load]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (userId && id) {
      isListingSaved(userId, id).then(setSaved).catch(() => {});
    }
  }, [userId, id]);

  const toggleSave = async () => {
    if (!userId || !id || busy) return;
    setBusy(true);
    try {
      if (saved) {
        await unsaveListing(userId, id);
        setSaved(false);
        haptics.tap();
      } else {
        await saveListing(userId, id);
        setSaved(true);
        haptics.success();
        toast.show('Saved to bookmarks');
      }
    } catch { toast.show('Could not update bookmark'); }
    finally { setBusy(false); }
  };

  // The inquiry is recorded either way — that is what notifies the owner and
  // gives them somewhere to reply. WhatsApp is only an extra hop on top of it,
  // taken when the resident asks for it.
  const handleInquiryConfirm = async (l: ListingRow, message: string, via: 'app' | 'whatsapp') => {
    setInquiryListing(null);
    haptics.success();

    if (userId) {
      sendInquiry(l.id, userId, message || null).catch(console.error);
    }

    if (via === 'whatsapp') {
      const senderName = profile?.name ?? 'A neighbour';
      const url = buildInquiryWhatsAppLink(l, senderName, message);
      if (Platform.OS === 'web') window.open(url, '_blank');
      else Linking.openURL(url);
      toast.show('Opening WhatsApp 📲');
      return;
    }

    toast.show('Sent — they will see it in Aangan');
  };

  const handleDelete = () => {
    if (!listing) return;
    const doDelete = async () => {
      const ok = await deleteListing(listing.id);
      haptics.success();
      toast.show(ok ? 'Listing removed ✅' : 'Could not remove');
      goBack();
    };
    confirm({ title: 'Remove listing', message: `Remove "${listing.title}"?`, confirmLabel: 'Remove', destructive: true }).then((ok) => { if (ok) doDelete(); });
  };

  const handleMarkSold = async () => {
    if (!listing || busy) return;
    setBusy(true);
    try {
      await setListingStatus(listing.id, listing.status === 'sold' ? 'active' : 'sold');
      await load();
      toast.show(listing.status === 'sold' ? 'Marked as active' : 'Marked as sold');
    } catch {
      toast.show('Could not update this listing');
    } finally {
      setBusy(false);
    }
  };

  // Must sit above every early return: hooks run unconditionally or React
  // sees a different number of them between renders.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Loading…</Text>
      </View>
    );
  }

  if (loadFailed) {
    return (
      <View className="flex-1 bg-bg">
        <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
          <Pressable onPress={goBack} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset" accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
        </View>
        <View className="flex-1 justify-center">
          <ErrorState
            title="Couldn't load this listing"
            message="It's still there — we just couldn't reach it. Check your connection and try again."
            onRetry={retry}
            retrying={retrying}
          />
        </View>
      </View>
    );
  }

  if (!listing) {
    return (
      <View className="flex-1 bg-bg">
        <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color={c.faint} />
          <Text className="mt-3 text-center font-sans-bold text-[16px] text-ink">Listing removed</Text>
          <Text className="font-sans mt-1.5 text-center text-[13px] text-muted">This listing is no longer available — it may have been removed by the owner.</Text>
          <Pressable onPress={goBack} className="mt-5 rounded-xl border border-line bg-surface px-5 py-2.5 active:bg-inset">
            <Text className="font-sans-sb text-[14px] text-ink">Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const cat = getService(listing.category);

  const photo = listing.photos[0];
  const isOwner = !!userId && listing.owner_user_id === userId;
  const ownerName = listing.is_referral
    ? listing.referral_name ?? listing.owner?.name ?? ''
    : listing.owner?.name ?? '';

  return (
    <KeyboardAvoider>
      <AScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 96 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image or colour block */}
        {photo ? (
          <View style={{ height: 280 }}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
              <ParallaxHero scrollY={scrollY} height={280}>
                <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
              </ParallaxHero>
            </View>
            {/* Back button overlaid on photo */}
            <Pressable accessibilityRole="button" accessibilityLabel="Go back"
              onPress={goBack}
              className="absolute items-center justify-center rounded-full bg-black/40"
              style={{ top: insets.top + 12, left: 16, width: 40, height: 40 }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            {/* Bookmark button */}
            {userId ? (
              <Pressable
                onPress={toggleSave}
                className="absolute items-center justify-center rounded-full bg-black/40"
                style={{ top: insets.top + 12, right: 16, width: 40, height: 40 }}
              >
                <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color="#fff" />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={{ height: 140, backgroundColor: c.accentSoft }}>
            <View className="flex-1 items-center justify-center">
              <Ionicons name={(cat?.icon as any) ?? 'grid-outline'} size={52} color={c.accent} />
            </View>
            {/* Back button */}
            <Pressable accessibilityRole="button" accessibilityLabel="Go back"
              onPress={goBack}
              className="absolute items-center justify-center rounded-full bg-black/20"
              style={{ top: insets.top + 12, left: 16, width: 40, height: 40 }}
            >
              <Ionicons name="chevron-back" size={22} color={c.ink} />
            </Pressable>
            {/* Bookmark button */}
            {userId ? (
              <Pressable
                onPress={toggleSave}
                className="absolute items-center justify-center rounded-full bg-black/20"
                style={{ top: insets.top + 12, right: 16, width: 40, height: 40 }}
              >
                <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={c.ink} />
              </Pressable>
            ) : null}
          </View>
        )}

        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <Container narrow>
            {/* Category badge + status */}
            <View className="mb-3 flex-row items-center gap-2 flex-wrap">
              {cat && (
                <View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: c.accentSoft }}>
                  <Ionicons name={cat.icon as any} size={12} color={c.accent} />
                  <Text className="font-sans-sb text-[11px]" style={{ color: c.accent }}>{cat.label}</Text>
                </View>
              )}
              {listing.status !== 'active' && (
                <Badge
                  label={listing.status.toUpperCase()}
                  tone={listing.status === 'sold' ? 'accent' : 'neutral'}
                />
              )}
            </View>

            {/* Title */}
            {listing.is_referral ? (
              <Text className="mb-1 font-display-x text-[24px] leading-8 text-ink">{listing.referral_name ?? listing.title}</Text>
            ) : (
              <T source="listing" id={listing.id} field="title" text={listing.title} className="mb-1 font-display-x text-[24px] leading-8 text-ink" />
            )}

            {/* Price */}
            {listing.price != null && (
              <Text className="mb-3 font-sans-bold text-[20px] text-accent">
                ₹{listing.price.toLocaleString('en-IN')}
                {listing.price_unit ? <Text className="font-sans-md text-[14px] text-muted"> {listing.price_unit}</Text> : null}
              </Text>
            )}

            {/* Description */}
            {listing.description && (
              <T source="listing" id={listing.id} field="description" text={listing.description} className="mb-4 text-[14px] font-sans-md leading-6 text-muted" />
            )}

            {/* Owner card */}
            <View className="mb-4 flex-row items-center gap-3 card p-4">
              <Avatar name={ownerName} size={42} />
              <View className="flex-1">
                <Text className="font-sans-bold text-[15px] text-ink">{ownerName}</Text>
                {listing.is_referral ? (
                  listing.referral_phone ? (
                    <Text className="font-sans text-[12px] text-muted">📞 {listing.referral_phone}</Text>
                  ) : null
                ) : (
                  listing.owner?.flat ? (
                    <Text className="font-sans text-[12px] text-muted">Flat {listing.owner.flat}</Text>
                  ) : null
                )}
                {listing.location && (
                  <Text className="font-sans text-[12px] text-muted">📍 {listing.location}</Text>
                )}
              </View>
              <ModerationMenu
                targetType="listing"
                targetId={listing.id}
                targetOwnerId={listing.owner_user_id}
                targetOwnerName={listing.owner?.name}
              />
            </View>

            {/* Category-specific attributes */}
            {cat && Object.keys(listing.attributes).length > 0 && (
              <View className="mb-4 card p-4">
                <Text className="mb-3 font-sans-bold text-[13px] text-ink">Details</Text>
                {cat.attributes
                  .filter((f) => listing.attributes[f.key] != null && listing.attributes[f.key] !== '')
                  .map((f) => {
                    const val = listing.attributes[f.key];
                    const display = Array.isArray(val) ? (val as string[]).join(', ') : String(val);
                    if (f.type === 'toggle') {
                      return (
                        <View key={f.key} className="mb-2.5 flex-row items-center justify-between">
                          <Text className="text-[13px] font-sans-md text-muted">{f.label}</Text>
                          <View className={`h-5 w-5 items-center justify-center rounded-full ${Boolean(val) ? 'bg-accent' : 'bg-inset'}`}>
                            {Boolean(val) && <Ionicons name="checkmark" size={12} color="#fff" />}
                          </View>
                        </View>
                      );
                    }
                    return (
                      <View key={f.key} className="mb-2.5 flex-row items-start gap-2">
                        <Text className="w-28 flex-shrink-0 text-[12px] font-sans-md text-faint">{f.label}</Text>
                        <Text className="flex-1 text-[13px] font-sans-md text-ink">{display}</Text>
                      </View>
                    );
                  })}
              </View>
            )}

            {/* Actions — the contact CTA sits with the owner controls rather
                than pinned to the bottom, where it stacked over the tab bar and
                cost ~190px of a phone screen between them. */}
            {(isOwner || isAdmin || (listing.status === 'active' && cat)) && (
              <View className="mb-4 flex-row flex-wrap items-center gap-2">
                {!isOwner && listing.status === 'active' && cat ? (
                  <Button
                    label={cat.ctaLabel}
                    icon="logo-whatsapp"
                    variant="whatsapp"
                    size="sm"
                    onPress={() => setInquiryListing(listing)}
                  />
                ) : null}
                {!isOwner && listing.price != null && listing.owner?.upi ? (
                  <PayButton
                    payee={{ id: listing.owner_user_id, name: ownerName, upi: listing.owner.upi }}
                    amount={listing.price}
                    note={listing.title}
                    context={{ type: 'listing', id: listing.id }}
                    label={`Pay ₹${listing.price.toLocaleString('en-IN')}`}
                    variant="outline"
                    size="sm"
                  />
                ) : null}
                {(isOwner || isAdmin) ? (
                <>
                <Button
                  label="Edit"
                  variant="outline"
                  size="sm"
                  icon="create-outline"
                  onPress={() => router.push(`/listing/edit?id=${listing.id}` as any)}
                />
                {listing.category === 'market' && (
                  <Button
                    label={listing.status === 'sold' ? 'Mark as active' : 'Mark as sold'}
                    variant="outline"
                    size="sm"
                    onPress={handleMarkSold}
                  />
                )}
                <Button
                  label="Remove"
                  variant="danger"
                  size="sm"
                  onPress={handleDelete}
                />
                </>
                ) : null}
              </View>
            )}

            {/* In-app chat thread (Phase 12a) */}
            <ListingChat
              listingId={listing.id}
              ownerUserId={listing.owner_user_id}
              ownerName={ownerName}
              accent={c.accent}
            />
          </Container>
        </View>
      </AScrollView>

      <InquiryModal
        listing={inquiryListing}
        senderName={profile?.name ?? 'A neighbour'}
        onClose={() => setInquiryListing(null)}
        onConfirm={handleInquiryConfirm}
      />
    </KeyboardAvoider>
  );
}
