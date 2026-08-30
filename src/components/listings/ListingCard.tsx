import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Text, View } from 'react-native';

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

/**
 * A listing in a grid.
 *
 * THE CARD IS A FIXED HEIGHT, ON PURPOSE.
 *
 * Every previous version sized itself to its content, and in a two-column grid
 * that meant no two cards matched: a photo made the media block taller than a
 * placeholder, a two-line title pushed the body down, a missing price removed
 * a line, a long unit label wrapped. Each of those was individually fixable
 * and collectively unwinnable — there is always one more field that varies.
 *
 * So the card declares its height and divides it: 140 for the media, the rest
 * for the body, with every text bounded by numberOfLines. Content that does
 * not fit truncates, which is the correct failure for a grid tile — the detail
 * screen is one tap away and has room for all of it.
 */
const CARD_HEIGHT = 232;
const MEDIA_HEIGHT = 140;

export const ListingCard = memo(function ListingCard({ listing, onPress }: ListingCardProps) {
  const c = useThemeColors();
  const cat = getService(listing.category);
  const photo = listing.photos[0];
  const ownerName = listing.is_referral
    ? listing.referral_name ?? listing.owner?.name ?? ''
    : listing.owner?.name ?? '';
  const title = listing.is_referral ? listing.referral_name ?? listing.title : listing.title;

  return (
    <Touchable feel="card" haptic={null} onPress={() => onPress(listing)}>
      <View
        className="overflow-hidden"
        style={{
          height: CARD_HEIGHT,
          backgroundColor: c.surface,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderBottomLeftRadius: 14,
          borderBottomRightRadius: 14,
          borderWidth: 1,
          borderColor: c.line,
        }}
      >
        {/* ── Media ─────────────────────────────────────────────────
            Always this height, photo or not, so the body below always
            starts at the same place. */}
        <View style={{ height: MEDIA_HEIGHT }}>
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
                colors={['transparent', 'rgba(8,14,10,0.80)']}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 84 }}
              />
            </>
          ) : (
            <View
              className="h-full w-full items-center justify-center"
              style={{ backgroundColor: c.inset }}
            >
              <Ionicons name={(cat?.icon as any) ?? 'grid-outline'} size={28} color={c.subtle} />
            </View>
          )}

          {/* Category, as a word. Capped so a long label truncates rather
              than running past the card edge. */}
          {cat ? (
            <View
              className="absolute flex-row items-center gap-1 rounded-full px-2 py-0.5"
              style={{
                top: 10,
                left: 10,
                maxWidth: '80%',
                backgroundColor: photo ? 'rgba(10,14,11,0.62)' : c.surface,
              }}
            >
              <Ionicons
                name={(cat.icon as any) ?? 'grid-outline'}
                size={10}
                color={photo ? '#FFFFFF' : c.muted}
              />
              <Text
                className="text-[10px] font-sans-sb uppercase tracking-[0.05em]"
                style={{ color: photo ? '#FFFFFF' : c.muted, flexShrink: 1 }}
                numberOfLines={1}
              >
                {cat.label}
              </Text>
            </View>
          ) : null}

          {listing.status !== 'active' ? (
            <View
              className="absolute rounded-full px-2 py-0.5"
              style={{ top: 10, right: 10, backgroundColor: 'rgba(10,14,11,0.62)' }}
            >
              <Text className="text-[10px] font-sans-sb uppercase text-white">{listing.status}</Text>
            </View>
          ) : null}

          {/* The title lives on the media in both cases — that is what keeps
              the body identical from card to card. */}
          <View style={{ position: 'absolute', left: 12, right: 12, bottom: 10 }}>
            {listing.is_referral ? (
              <Text
                className="font-sans-sb text-[15px] leading-[19px]"
                style={{ color: photo ? '#FFFFFF' : c.ink }}
                numberOfLines={2}
              >
                {title}
              </Text>
            ) : (
              <T
                source="listing"
                id={listing.id}
                field="title"
                text={listing.title}
                showToggle={false}
                className="font-sans-sb text-[15px] leading-[19px]"
                style={{ color: photo ? '#FFFFFF' : c.ink }}
                numberOfLines={2}
              />
            )}
          </View>
        </View>

        {/* ── Body ──────────────────────────────────────────────────
            Fills whatever remains and splits it between the two rows, so a
            missing price cannot shorten the card. */}
        <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'space-between' }}>
          <View className="flex-row items-baseline gap-1">
            {listing.price != null ? (
              <>
                <Text className="font-display-x text-[19px] text-ink" numberOfLines={1}>
                  ₹{listing.price.toLocaleString('en-IN')}
                </Text>
                {listing.price_unit ? (
                  <Text
                    className="text-[11px] font-sans-md text-subtle"
                    style={{ flexShrink: 1 }}
                    numberOfLines={1}
                  >
                    {listing.price_unit}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text className="text-[13px] font-sans-md text-subtle" numberOfLines={1}>
                Ask for price
              </Text>
            )}
          </View>

          <View className="flex-row items-center gap-1.5">
            <Avatar name={ownerName} size={18} />
            <Text
              className="min-w-0 flex-1 text-[11px] font-sans-md text-muted"
              numberOfLines={1}
            >
              {ownerName}
            </Text>
            <Ionicons name="arrow-forward" size={13} color={c.accent} />
          </View>
        </View>
      </View>
    </Touchable>
  );
});
