import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useThemeColors } from '../theme';
import { IMAGE_CACHE_PROPS } from '../lib/image';
import { countdown } from '../lib/time';
import { DishRow, SLOT_EMOJI } from '../lib/types';
import { T } from './T';
import { Avatar, Badge, Button, VegMark } from './ui';

// Accent colour per meal slot — for the slot chip on the card.
const SLOT_COLOR: Record<string, string> = {
  Breakfast: '#E8650A', // warm orange
  Lunch: '#16A34A',     // green
  Dinner: '#6366F1',    // indigo
  Snack: '#DB2777',     // pink
};

// Warm two-tone backdrop for photo-less dishes, themed by meal slot.
const SLOT_PLACEHOLDER: Record<string, [string, string]> = {
  Breakfast: ['#FFD9A8', '#FFB877'],
  Lunch: ['#CDEBC5', '#A6D89B'],
  Dinner: ['#C9C2EC', '#A99FE0'],
  Snack: ['#F6C6DA', '#EFA3C2'],
};

/** Returns a friendly label if the serve date isn't today, else null. */
function futureServeLabel(serveDate: string): string | null {
  const today = new Date().toLocaleDateString('en-CA');
  if (!serveDate || serveDate <= today) return null;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (serveDate === tomorrow.toLocaleDateString('en-CA')) return 'Tomorrow';
  try {
    return new Date(serveDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return 'Upcoming';
  }
}

interface DishCardProps {
  dish: DishRow;
  owned: boolean;
  hero?: boolean;
  onOrder: (dish: DishRow) => void;
  onRemove: (dish: DishRow) => void;
  onShare: (dish: DishRow) => void;
}

function DishCardBase({ dish, owned, hero, onOrder, onRemove, onShare }: DishCardProps) {
  const c = useThemeColors();
  const router = useRouter();
  const openDetail = () => router.push(`/dish/${dish.id}` as any);
  const cd = countdown(dish.order_by);
  const closed = cd?.closed ?? false;
  const soldOut = dish.plates_left <= 0;
  const unavailable = soldOut || closed;
  const low = !soldOut && dish.plates_left <= 2;
  const ordered = Math.max(0, dish.max_plates - dish.plates_left);
  const pct = Math.max(0, Math.min(1, dish.plates_left / dish.max_plates));
  const [g1, g2] = SLOT_PLACEHOLDER[dish.slot] ?? ['#CDEBC5', '#A6D89B'];
  const serveLabel = futureServeLabel(dish.serve_date);

  return (
    <Pressable
      onPress={openDetail}
      accessibilityLabel={`View ${dish.dish_name} details`}
      className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card active:opacity-95"
    >
      {/* ── Photo ─────────────────────────────────────────────────── */}
      <View style={{ height: hero ? 230 : 180 }} className="w-full">
        {dish.photo_url ? (
          <Image source={{ uri: dish.photo_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" recyclingKey={dish.photo_url} {...IMAGE_CACHE_PROPS} />
        ) : (
          <LinearGradient colors={[g1, g2]} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: hero ? 66 : 54 }}>{SLOT_EMOJI[dish.slot] ?? '🍽️'}</Text>
          </LinearGradient>
        )}

        <LinearGradient
          colors={['rgba(0,0,0,0.38)', 'transparent', 'rgba(0,0,0,0.34)']}
          locations={[0, 0.45, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          pointerEvents="none"
        />

        {/* top row */}
        <View className="absolute left-3 right-3 top-3 flex-row items-start justify-between">
          <View className="flex-row items-center gap-2">
            <View className="rounded-lg bg-white/95 p-1">
              <VegMark type={dish.veg_type} size={15} />
            </View>
            {owned ? <Badge label="Your dish" tone="onPhoto" /> : null}
          </View>
          <Pressable onPress={() => onShare(dish)} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-full bg-black/55">
            <Ionicons name="share-social-outline" size={15} color="#fff" />
          </Pressable>
        </View>

        {/* serve-date pill (only when not today) */}
        {serveLabel ? (
          <View className="absolute right-3 top-12">
            <Badge label={`📅 ${serveLabel}`} tone="onPhoto" />
          </View>
        ) : null}

        {/* bottom-of-photo: countdown + ordered */}
        <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between">
          {cd ? <Badge label={closed ? '⏰ Closed' : `⏱ ${cd.label.replace('Order in ', '')} left`} tone="onPhoto" /> : <View />}
          {ordered > 0 ? <Badge label={`🔥 ${ordered} ordered`} tone="onPhoto" /> : null}
        </View>

        {soldOut ? (
          <View className="absolute inset-0 items-center justify-center bg-black/45">
            <View className="rotate-[-7deg] rounded-xl border-2 border-white px-4 py-1.5">
              <Text className="font-display-x text-lg uppercase tracking-wider text-white">Sold out</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <View className="p-4">
        <T source="dish" id={dish.id} field="dish_name" text={dish.dish_name} showToggle={false}
          className="font-display text-ink" style={{ fontSize: hero ? 23 : 19, lineHeight: hero ? 28 : 24 }} numberOfLines={2} />
        {dish.description ? (
          <T source="dish" id={dish.id} field="description" text={dish.description} showToggle={false}
            className="mt-1 text-[13px] leading-5 text-muted" numberOfLines={2} />
        ) : null}

        <View className="mt-3 flex-row items-center gap-2">
          <Avatar name={dish.chef_name} size={26} />
          <Text className="flex-1 text-[12px] text-muted" numberOfLines={1}>
            <Text className="font-sans-sb text-ink">{dish.chef_name}</Text> · Flat {dish.flat}
            {dish.upi ? ` · UPI ${dish.upi}` : ''}
          </Text>
        </View>

        {!soldOut ? (
          <View className="mt-3">
            <View className="h-1.5 w-full overflow-hidden rounded-full bg-inset">
              <View className={low ? 'h-full rounded-full bg-accent' : 'h-full rounded-full bg-success'} style={{ width: `${Math.max(8, pct * 100)}%` }} />
            </View>
            <Text className={`mt-1.5 text-[11px] font-sans-md ${low ? 'text-accent' : 'text-muted'}`}>
              {low ? `Only ${dish.plates_left} plate${dish.plates_left !== 1 ? 's' : ''} left!` : `${dish.plates_left} of ${dish.max_plates} plates left`}
            </Text>
          </View>
        ) : null}

        <View className="mt-4 flex-row items-end justify-between">
          <View className="flex-row items-end gap-2.5">
            <View>
              <Text className="font-display-x text-[22px] text-ink">₹{dish.price}</Text>
              <Text className="-mt-1 text-[11px] text-faint">per plate</Text>
            </View>
            <View
              className="mb-0.5 flex-row items-center gap-1 rounded-full px-2.5 py-1"
              style={{ backgroundColor: (SLOT_COLOR[dish.slot] ?? '#6B7280') + '22', borderWidth: 1, borderColor: (SLOT_COLOR[dish.slot] ?? '#6B7280') + '44' }}
            >
              <Text style={{ fontSize: 12 }}>{SLOT_EMOJI[dish.slot] ?? '🍽️'}</Text>
              <Text className="text-[12px] font-sans-bold" style={{ color: SLOT_COLOR[dish.slot] ?? '#6B7280' }}>{dish.slot}</Text>
            </View>
          </View>

          {owned ? (
            <Pressable onPress={() => onRemove(dish)} className="flex-row items-center gap-1.5 rounded-2xl border-[1.5px] border-line px-3.5 py-2.5 active:bg-inset">
              <Ionicons name="trash-outline" size={16} color={c.nonveg} />
              <Text className="font-sans-sb text-[13px] text-nonveg">Remove</Text>
            </Pressable>
          ) : unavailable ? (
            <View className="rounded-2xl bg-inset px-4 py-2.5">
              <Text className="font-sans-sb text-[13px] text-muted">{closed ? 'Closed' : 'Sold out'}</Text>
            </View>
          ) : (
            <Button label="Order" icon="bag-add-outline" onPress={() => onOrder(dish)} size="md" />
          )}
        </View>
      </View>
    </Pressable>
  );
}

export const DishCard = memo(DishCardBase);
