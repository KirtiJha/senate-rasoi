import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrderModal } from '../../components/OrderModal';
import { PayButton } from '../../components/PayButton';
import { T } from '../../components/T';
import { Avatar, Badge, Button, Container, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useConfirm } from '../../context/confirm';
import { useToast } from '../../context/toast';
import {
  buildWhatsAppOrderLink, deleteDish, fetchDishById, placeOrder, waLink,
} from '../../lib/dishes';
import { haptics } from '../../lib/haptics';
import { IMAGE_CACHE_PROPS } from '../../lib/image';
import { countdown } from '../../lib/time';
import { DishRow, SLOT_EMOJI } from '../../lib/types';
import { useThemeColors } from '../../theme';

// Warm two-tone backdrop for photo-less dishes, themed by meal slot.
const SLOT_PLACEHOLDER: Record<string, [string, string]> = {
  Breakfast: ['#FFD9A8', '#FFB877'],
  Lunch: ['#CDEBC5', '#A6D89B'],
  Dinner: ['#C9C2EC', '#A99FE0'],
  Snack: ['#F6C6DA', '#EFA3C2'],
};

function serveLabel(serveDate: string): string | null {
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

export default function DishDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { userId } = useAuth();
  const c = useThemeColors();

  const [dish, setDish] = useState<DishRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);

  // On web, opening this route directly (or after a refresh) leaves an empty
  // history stack, so router.back() is a no-op. Fall back to the food board.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/food' as any);
  };

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setDish(await fetchDishById(id));
    } catch (e) {
      console.error(e);
      toast.show('Could not load this dish');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  const handleConfirmOrder = async (d: DishRow, qty: number) => {
    setOrdering(false);
    try {
      const orderId = await placeOrder(d.id, qty);
      if (!orderId) {
        haptics.warning();
        toast.show('Sorry — those plates just went, or ordering closed. Refreshing…');
        await load();
        return;
      }
      haptics.success();
      const url = buildWhatsAppOrderLink(d, qty);
      toast.show('Plates reserved! Opening WhatsApp 📲');
      if (Platform.OS === 'web') window.open(url, '_blank');
      else Linking.openURL(url);
      await load();
    } catch (e) {
      console.error(e);
      toast.show('Could not place the order — please try again');
    }
  };

  const handleRemove = () => {
    if (!dish) return;
    const doDelete = async () => {
      try {
        const ok = await deleteDish(dish.id);
        haptics.success();
        toast.show(ok ? 'Your dish has been removed ✅' : 'Could not remove this dish');
        goBack();
      } catch (e) {
        console.error(e);
        toast.show('Could not remove — check your connection');
      }
    };
    confirm({ title: 'Remove dish', message: `Remove "${dish.dish_name}" from the board?`, confirmLabel: 'Remove', destructive: true })
      .then((ok) => { if (ok) doDelete(); });
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Loading…</Text>
      </View>
    );
  }

  if (!dish) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Dish not found.</Text>
      </View>
    );
  }

  const cd = countdown(dish.order_by);
  const closed = cd?.closed ?? false;
  const soldOut = dish.plates_left <= 0;
  const unavailable = soldOut || closed;
  const low = !soldOut && dish.plates_left <= 2;
  const ordered = Math.max(0, dish.max_plates - dish.plates_left);
  const pct = Math.max(0, Math.min(1, dish.plates_left / dish.max_plates));
  const [g1, g2] = SLOT_PLACEHOLDER[dish.slot] ?? ['#CDEBC5', '#A6D89B'];
  const future = serveLabel(dish.serve_date);
  const isOwner = !!userId && dish.chef_user_id === userId;

  return (
    <View className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Hero image or slot-themed colour block */}
        <View style={{ height: 280 }}>
          {dish.photo_url ? (
            <Image source={{ uri: dish.photo_url }} style={{ width: '100%', height: 280 }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
          ) : (
            <LinearGradient colors={[g1, g2]} style={{ width: '100%', height: 280, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 84 }}>{SLOT_EMOJI[dish.slot] ?? '🍽️'}</Text>
            </LinearGradient>
          )}
          {soldOut ? (
            <View className="absolute inset-0 items-center justify-center bg-black/45" pointerEvents="none">
              <View className="rotate-[-7deg] rounded-xl border-2 border-white px-4 py-1.5">
                <Text className="font-display-x text-lg uppercase tracking-wider text-white">Sold out</Text>
              </View>
            </View>
          ) : null}

          {/* Back button overlaid — rendered last so it stays on top of the overlay */}
          <Pressable
            onPress={goBack}
            hitSlop={8}
            className="absolute items-center justify-center rounded-full bg-black/40"
            style={{ top: insets.top + 12, left: 16, width: 40, height: 40 }}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <Container narrow>
            {/* Slot + veg + serve-date row */}
            <View className="mb-3 flex-row items-center gap-2 flex-wrap">
              <View className="flex-row items-center gap-1.5 rounded-full bg-inset px-2.5 py-1">
                <Text className="font-sans-sb text-[11px] text-muted">{SLOT_EMOJI[dish.slot]} {dish.slot}</Text>
              </View>
              <View className="flex-row items-center gap-1.5 rounded-full bg-inset px-2.5 py-1">
                <View className={`h-2.5 w-2.5 rounded-[3px] border ${dish.veg_type === 'Veg' ? 'border-veg' : dish.veg_type === 'Egg' ? 'border-egg' : 'border-nonveg'}`}>
                  <View className={`m-auto h-1 w-1 rounded-full ${dish.veg_type === 'Veg' ? 'bg-veg' : dish.veg_type === 'Egg' ? 'bg-egg' : 'bg-nonveg'}`} />
                </View>
                <Text className="font-sans-sb text-[11px] text-muted">{dish.veg_type}</Text>
              </View>
              {future ? <Badge label={`📅 ${future}`} tone="neutral" /> : null}
              {cd ? <Badge label={closed ? '⏰ Closed' : `⏱ ${cd.label.replace('Order in ', '')} left`} tone={closed ? 'neutral' : 'accent'} /> : null}
            </View>

            {/* Title */}
            <T source="dish" id={dish.id} field="dish_name" text={dish.dish_name}
              className="mb-1 font-display-x text-[24px] leading-8 text-ink" />

            {/* Price */}
            <Text className="mb-3 font-sans-bold text-[20px] text-accent">
              ₹{dish.price}
              <Text className="font-sans-md text-[14px] text-muted"> per plate</Text>
            </Text>

            {/* Description */}
            {dish.description ? (
              <T source="dish" id={dish.id} field="description" text={dish.description}
                className="mb-4 text-[14px] font-sans-md leading-6 text-muted" />
            ) : null}

            {/* Plates-left progress */}
            {!soldOut ? (
              <View className="mb-4 rounded-2xl border border-line bg-surface p-4">
                <View className="h-1.5 w-full overflow-hidden rounded-full bg-inset">
                  <View className={low ? 'h-full rounded-full bg-accent' : 'h-full rounded-full bg-success'} style={{ width: `${Math.max(8, pct * 100)}%` }} />
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className={`text-[12px] font-sans-md ${low ? 'text-accent' : 'text-muted'}`}>
                    {low ? `Only ${dish.plates_left} plate${dish.plates_left !== 1 ? 's' : ''} left!` : `${dish.plates_left} of ${dish.max_plates} plates left`}
                  </Text>
                  {ordered > 0 ? <Text className="text-[12px] font-sans-md text-faint">🔥 {ordered} ordered</Text> : null}
                </View>
              </View>
            ) : null}

            {/* Chef card */}
            <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <Avatar name={dish.chef_name} size={42} />
              <View className="flex-1">
                <Text className="font-sans-bold text-[15px] text-ink">{dish.chef_name}</Text>
                <Text className="text-[12px] text-muted">Flat {dish.flat}{dish.upi ? ` · UPI ${dish.upi}` : ''}</Text>
              </View>
            </View>

            {/* Owner actions */}
            {isOwner ? (
              <View className="mb-4">
                <Button label="Remove dish" variant="danger" size="sm" onPress={handleRemove} />
              </View>
            ) : null}
          </Container>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      {!isOwner ? (
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-line bg-bg px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {dish.upi && dish.chef_user_id ? (
            <View className="mb-2">
              <PayButton
                payee={{ id: dish.chef_user_id, name: dish.chef_name, upi: dish.upi }}
                amount={dish.price}
                note={dish.dish_name}
                context={{ type: 'dish', id: dish.id }}
                label={`Pay ₹${dish.price} via UPI`}
                variant="outline"
                size="lg"
                fullWidth
              />
            </View>
          ) : null}
          {unavailable ? (
            <View className="items-center rounded-2xl bg-inset py-3.5">
              <Text className="font-sans-sb text-[14px] text-muted">{closed ? 'Ordering closed' : 'Sold out'}</Text>
            </View>
          ) : (
            <Button label="Order" icon="bag-add-outline" size="lg" fullWidth onPress={() => setOrdering(true)} />
          )}
        </View>
      ) : null}

      <OrderModal dish={ordering ? dish : null} onClose={() => setOrdering(false)} onConfirm={handleConfirmOrder} />
    </View>
  );
}
