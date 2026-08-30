import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { IMAGE_CACHE_PROPS } from '../../lib/image';
import { getService } from '../../lib/services';
import { ListingRow } from '../../lib/types';
import { useThemeColors } from '../../theme';
import { T } from '../T';
import { Avatar } from '../ui';

interface ListingCardProps {
  listing: ListingRow;
  onPress: (listing: ListingRow) => void;
}

export const ListingCard = memo(function ListingCard({ listing, onPress }: ListingCardProps) {
  const c = useThemeColors();
  const cat = getService(listing.category);
  const photo = listing.photos[0];
  const ownerName = listing.is_referral
    ? listing.referral_name ?? listing.owner?.name ?? ''
    : listing.owner?.name ?? '';

  return (
    <Pressable
      onPress={() => onPress(listing)}
      className="overflow-hidden rounded-2xl bg-surface active:opacity-80"
      style={{ borderWidth: 1, borderColor: c.line }}
    >
      {/* Colour accent strip */}
      {cat && <View style={{ height: 3, backgroundColor: c.accent }} />}

      {/* Photo or icon placeholder */}
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ width: '100%', height: 140 }}
          contentFit="cover"
          recyclingKey={photo}
          {...IMAGE_CACHE_PROPS}
        />
      ) : (
        <View
          className="items-center justify-center"
          style={{ height: 100, backgroundColor: c.accentSoft }}
        >
          <Ionicons name={(cat?.icon as any) ?? 'grid-outline'} size={36} color={c.accent} />
        </View>
      )}

      <View className="p-3">
        {/* Status badge for closed/sold */}
        {listing.status !== 'active' && (
          <View className="mb-1.5 self-start rounded-full bg-inset px-2 py-0.5">
            <Text className="text-[10px] font-sans-sb uppercase tracking-wide text-muted">
              {listing.status}
            </Text>
          </View>
        )}

        {listing.is_referral ? (
          <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={2}>
            {listing.referral_name ?? listing.title}
          </Text>
        ) : (
          <T source="listing" id={listing.id} field="title" text={listing.title} showToggle={false}
            className="font-sans-bold text-[14px] text-ink" numberOfLines={2} />
        )}

        {listing.price != null && (
          <Text className="mt-0.5 text-[13px] font-sans-md text-accent">
            ₹{listing.price.toLocaleString('en-IN')}
            {listing.price_unit ? ` ${listing.price_unit}` : ''}
          </Text>
        )}

        {/* Owner row */}
        <View className="mt-2 flex-row items-center gap-1.5">
          <Avatar name={ownerName} size={18} />
          <Text className="flex-1 text-[11px] font-sans-md text-muted" numberOfLines={1}>
            {ownerName}
            {listing.owner?.flat ? ` · Flat ${listing.owner.flat}` : ''}
          </Text>
        </View>

        {/*
          The affordance, not a button.
 
          This was a full-width bar filled with `c.accentSoft` — a 9% alpha
          tint of a frozen per-category hex. Alpha tints assume a white backdrop,
          so on a dark card the fill all but vanished and the row read as a big
          empty section, with #FF9800 text floating in it. It also looked like a
          button while doing nothing: the whole card is already pressable, and
          the real action lives on the detail screen.
 
          So it becomes what it actually is — a compact accent-coloured cue that
          there is something to do here, sized to its text and legible in both
          schemes because it uses no fill at all.
        */}
        {cat && (
          <View className="mt-2.5 flex-row items-center gap-1">
            <Text className="font-sans-sb text-[12px] text-accent" numberOfLines={1}>
              {cat.ctaLabel}
            </Text>
            <Ionicons name="arrow-forward" size={12} color={c.accent} />
          </View>
        )}
      </View>
    </Pressable>
  );
});
