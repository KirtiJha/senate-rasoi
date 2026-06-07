import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InquiryModal } from '../../components/listings/InquiryModal';
import { Avatar, Badge, Button, Container, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { haptics } from '../../lib/haptics';
import { sendInquiry } from '../../lib/inquiries';
import { buildInquiryWhatsAppLink, deleteListing, fetchListingById, setListingStatus } from '../../lib/listings';
import { getService } from '../../lib/services';
import { ListingRow } from '../../lib/types';
import { useThemeColors } from '../../theme';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { userId, profile } = useAuth();
  const c = useThemeColors();

  const [listing, setListing] = useState<ListingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [inquiryListing, setInquiryListing] = useState<ListingRow | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setListing(await fetchListingById(id));
    } catch (e) {
      console.error(e);
      toast.show('Could not load this listing');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  const handleInquiryConfirm = async (l: ListingRow, message: string) => {
    setInquiryListing(null);
    haptics.success();
    const senderName = profile?.name ?? 'A neighbour';
    const url = buildInquiryWhatsAppLink(l, senderName, message);
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url);
    if (userId) {
      sendInquiry(l.id, userId, message || null).catch(console.error);
    }
    toast.show('Opening WhatsApp 📲');
  };

  const handleDelete = () => {
    if (!listing) return;
    const doDelete = async () => {
      const ok = await deleteListing(listing.id);
      haptics.success();
      toast.show(ok ? 'Listing removed ✅' : 'Could not remove');
      router.back();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${listing.title}"?`)) doDelete();
    } else {
      Alert.alert('Remove listing', `Remove "${listing.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleMarkSold = async () => {
    if (!listing) return;
    await setListingStatus(listing.id, listing.status === 'sold' ? 'active' : 'sold');
    await load();
    toast.show(listing.status === 'sold' ? 'Marked as active' : 'Marked as sold ✅');
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Loading…</Text>
      </View>
    );
  }

  if (!listing) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Listing not found.</Text>
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
    <View className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image or colour block */}
        {photo ? (
          <View style={{ height: 280 }}>
            <Image source={{ uri: photo }} style={{ width: '100%', height: 280 }} contentFit="cover" />
            {/* Back button overlaid on photo */}
            <Pressable
              onPress={() => router.back()}
              className="absolute items-center justify-center rounded-full bg-black/40"
              style={{ top: insets.top + 12, left: 16, width: 40, height: 40 }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={{ height: 140, backgroundColor: (cat?.color ?? '#888') + '20' }}>
            <View className="flex-1 items-center justify-center">
              <Ionicons name={(cat?.icon as any) ?? 'grid-outline'} size={52} color={cat?.color ?? c.muted} />
            </View>
            {/* Back button */}
            <Pressable
              onPress={() => router.back()}
              className="absolute items-center justify-center rounded-full bg-black/20"
              style={{ top: insets.top + 12, left: 16, width: 40, height: 40 }}
            >
              <Ionicons name="chevron-back" size={22} color={c.ink} />
            </Pressable>
          </View>
        )}

        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <Container narrow>
            {/* Category badge + status */}
            <View className="mb-3 flex-row items-center gap-2 flex-wrap">
              {cat && (
                <View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: cat.color + '20' }}>
                  <Ionicons name={cat.icon as any} size={12} color={cat.color} />
                  <Text className="font-sans-sb text-[11px]" style={{ color: cat.color }}>{cat.label}</Text>
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
            <Text className="mb-1 font-display-x text-[24px] leading-8 text-ink">
              {listing.is_referral ? listing.referral_name ?? listing.title : listing.title}
            </Text>

            {/* Price */}
            {listing.price != null && (
              <Text className="mb-3 font-sans-bold text-[20px] text-accent">
                ₹{listing.price.toLocaleString('en-IN')}
                {listing.price_unit ? <Text className="font-sans-md text-[14px] text-muted"> {listing.price_unit}</Text> : null}
              </Text>
            )}

            {/* Description */}
            {listing.description && (
              <Text className="mb-4 text-[14px] font-sans-md leading-6 text-muted">
                {listing.description}
              </Text>
            )}

            {/* Owner card */}
            <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <Avatar name={ownerName} size={42} />
              <View className="flex-1">
                <Text className="font-sans-bold text-[15px] text-ink">{ownerName}</Text>
                {listing.is_referral ? (
                  listing.referral_phone ? (
                    <Text className="text-[12px] text-muted">📞 {listing.referral_phone}</Text>
                  ) : null
                ) : (
                  listing.owner?.flat ? (
                    <Text className="text-[12px] text-muted">Flat {listing.owner.flat}</Text>
                  ) : null
                )}
                {listing.location && (
                  <Text className="text-[12px] text-muted">📍 {listing.location}</Text>
                )}
              </View>
            </View>

            {/* Category-specific attributes */}
            {cat && Object.keys(listing.attributes).length > 0 && (
              <View className="mb-4 rounded-2xl border border-line bg-surface p-4">
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

            {/* Owner actions */}
            {isOwner && (
              <View className="mb-4 flex-row gap-2">
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
              </View>
            )}
          </Container>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      {!isOwner && listing.status === 'active' && cat && (
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-line bg-bg px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <Button
            label={cat.ctaLabel}
            icon="logo-whatsapp"
            variant="whatsapp"
            size="lg"
            fullWidth
            onPress={() => setInquiryListing(listing)}
          />
        </View>
      )}

      <InquiryModal
        listing={inquiryListing}
        senderName={profile?.name ?? 'A neighbour'}
        onClose={() => setInquiryListing(null)}
        onConfirm={handleInquiryConfirm}
      />
    </View>
  );
}
