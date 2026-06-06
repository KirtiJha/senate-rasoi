import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useProfile } from '../context/profile';
import { DishRow, SLOT_EMOJI } from '../lib/types';
import { Avatar, Button, IconButton, Stepper, VegMark } from './ui';

interface OrderModalProps {
  dish: DishRow | null;
  onClose: () => void;
  onConfirm: (dish: DishRow, qty: number) => void;
}

export function OrderModal({ dish, onClose, onConfirm }: OrderModalProps) {
  const { profile } = useProfile();
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setQty(1);
  }, [dish]);

  if (!dish) return null;
  const total = dish.price * qty;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/55" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full self-center rounded-t-[28px] bg-bg px-5 pb-9 pt-3"
          style={{ maxWidth: 560 }}
        >
          <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-line" />

          <View className="mb-3 flex-row items-start justify-between">
            <Text className="font-sans-sb text-[13px] uppercase tracking-wider text-accent">Place an order</Text>
            <IconButton icon="close" onPress={onClose} />
          </View>

          <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-inset">
              {dish.photo_url ? (
                <Image source={{ uri: dish.photo_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <Text style={{ fontSize: 30 }}>{SLOT_EMOJI[dish.slot]}</Text>
              )}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <VegMark type={dish.veg_type} size={13} />
                <Text className="flex-1 font-display text-[17px] text-ink" numberOfLines={1}>{dish.dish_name}</Text>
              </View>
              <View className="mt-1 flex-row items-center gap-1.5">
                <Avatar name={dish.chef_name} size={18} />
                <Text className="text-[12px] text-muted">{dish.chef_name} · Flat {dish.flat}</Text>
              </View>
            </View>
          </View>

          <View className="mb-4 flex-row items-center justify-between">
            <View>
              <Text className="font-sans-sb text-[15px] text-ink">How many plates?</Text>
              <Text className="text-[12px] text-faint">{dish.plates_left} available</Text>
            </View>
            <Stepper value={qty} min={1} max={dish.plates_left} onChange={setQty} />
          </View>

          <View className="mb-5 flex-row items-center justify-between rounded-2xl bg-inset px-4 py-3">
            <Text className="font-sans-md text-[14px] text-muted">{qty} × ₹{dish.price}</Text>
            <Text className="font-display-x text-[22px] text-ink">₹{total}</Text>
          </View>

          <Button label="Reserve & message on WhatsApp" icon="logo-whatsapp" variant="whatsapp" size="lg" fullWidth onPress={() => onConfirm(dish, qty)} />
          <Text className="mt-2.5 text-center text-[11px] leading-4 text-faint">
            Ordering as {profile.chefName || 'you'}. Reserves your plates; the chef confirms next.
            {dish.upi ? ` Pay via UPI ${dish.upi}.` : ''}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
