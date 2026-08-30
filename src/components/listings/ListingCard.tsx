import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IMAGE_CACHE_PROPS } from '../../lib/image';
import { getService } from '../../lib/services';
import { ListingRow } from '../../lib/types';
import { useThemeColors } from '../../theme';
import { T } from '../T';
import { Avatar, Touchable } from '../ui';

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
    <Touchable feel="card" haptic={null} onPress={() => onPress(listing)}>
      <View
        className="overflow-hidden"
        style={{
          backgroundColor: c.surface,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderBottomLeftRadius: 14,
          borderBottomRightRadius: 14,
          boxShadow: c.shadowCard,
        } as any}
      >
        {/*
          The title sits ON the photo over a scrim, the way the dish card does.
          A photo with a caption underneath is a directory entry; a photo the
          title lives inside is a card. The coloured strip along the top is
          gone with the rest of the per-category hues.
        */}
        <View style={{ height: 148 }}>
          {photo ? (
            <>
              <Image
                source={{ uri: photo }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                recyclingKey={photo}
                {...IMAGE_CACHE_PROPS}
              />
              <LinearGradient
                colors={['transparent', 'rgba(8,14,10,0.78)']}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 86 }}
              />
            </>
          ) : (
            <View
              className="h-full w-full items-center"
              style={{ backgroundColor: c.inset, justifyContent: 'center', paddingBottom: 34 }}
            >
              <Ionicons name={(cat?.icon as any) ?? 'grid-outline'} size={30} color={c.subtle} />
            </View>
          )}

          {/* Category as a word, not a hue. */}
          {cat ? (
            <View
              className="absolute left-3 top-3 flex-row items-center gap-1 rounded-full px-2 py-1"
              style={{ backgroundColor: photo ? 'rgba(10,14,11,0.62)' : c.surface }}
            >
              <Ionicons
                name={(cat.icon as any) ?? 'grid-outline'}
                size={11}
                color={photo ? '#FFFFFF' : c.muted}
              />
              <Text
                className="text-[10px] font-sans-sb uppercase tracking-[0.06em]"
                style={{ color: photo ? '#FFFFFF' : c.muted }}
                numberOfLines={1}
              >
                {cat.label}
              </Text>
            </View>
          ) : null}

          {listing.status !== 'active' ? (
            <View className="absolute right-3 top-3 rounded-full px-2 py-1" style={{ backgroundColor: 'rgba(10,14,11,0.62)' }}>
              <Text className="text-[10px] font-sans-sb uppercase tracking-wide text-white">
                {listing.status}
              </Text>
            </View>
          ) : null}

          <View className="absolute bottom-3 left-3 right-3">
            {listing.is_referral ? (
              <Text
                className="font-sans-sb text-[16px]"
                style={{ color: photo ? '#FFFFFF' : c.ink }}
                numberOfLines={2}
              >
                {listing.referral_name ?? listing.title}
              </Text>
            ) : (
              <T source="listing" id={listing.id} field="title" text={listing.title} showToggle={false}
                className="font-sans-sb text-[16px]"
                style={{ color: photo ? '#FFFFFF' : c.ink }}
                numberOfLines={2} />
            )}
          </View>
        </View>

        <View style={{ padding: 12 }}>
          {/* Price is the loud element, and it is ink — a price is not a link. */}
          <View className="flex-row items-baseline gap-1" style={{ minHeight: 24 }}>
            {listing.price != null ? (
              <>
                <Text className="font-display-x text-[20px] text-ink">
                  ₹{listing.price.toLocaleString('en-IN')}
                </Text>
                {listing.price_unit ? (
                  <Text className="text-[11px] font-sans-md text-subtle">{listing.price_unit}</Text>
                ) : null}
              </>
            ) : (
              <Text className="text-[13px] font-sans-md text-subtle">Ask for price</Text>
            )}
          </View>

          <View className="mt-2 flex-row items-center gap-2">
            <Avatar name={ownerName} size={20} />
            <Text className="min-w-0 flex-1 text-[12px] font-sans-md text-muted" numberOfLines={1}>
              {ownerName}
              {listing.owner?.flat ? ` · Flat ${listing.owner.flat}` : ''}
            </Text>
            {cat ? (
              <View className="flex-row items-center gap-1">
                <Text className="font-sans-sb text-[12px]" style={{ color: c.accent }} numberOfLines={1}>
                  {cat.ctaLabel}
                </Text>
                <Ionicons name="arrow-forward" size={12} color={c.accent} />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Touchable>
  );
});
