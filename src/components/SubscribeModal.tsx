import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { daysLabel } from './TiffinCard';
import { Avatar, Button, IconButton, Stepper, VegMark } from './ui';
import { SLOT_EMOJI, TiffinPlanWithChef } from '../lib/types';

interface SubscribeModalProps {
  plan: TiffinPlanWithChef | null;
  onClose: () => void;
  onConfirm: (plan: TiffinPlanWithChef, qty: number, startToday: boolean) => void;
}

export function SubscribeModal({ plan, onClose, onConfirm }: SubscribeModalProps) {
  const [qty, setQty] = useState(1);
  const [startToday, setStartToday] = useState(true);

  useEffect(() => {
    setQty(1);
    setStartToday(true);
  }, [plan]);

  if (!plan) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/55" onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} className="w-full self-center rounded-t-[28px] bg-bg px-5 pb-9 pt-3" style={{ maxWidth: 560 }}>
          <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-line" />
          <View className="mb-3 flex-row items-start justify-between">
            <Text className="font-sans-sb text-[13px] uppercase tracking-wider text-accent">Subscribe to tiffin</Text>
            <IconButton icon="close" onPress={onClose} />
          </View>

          <View className="mb-4 rounded-2xl border border-line bg-surface p-3">
            <View className="flex-row items-center gap-1.5">
              <VegMark type={plan.veg_type} size={13} />
              <Text className="flex-1 font-display text-[17px] text-ink" numberOfLines={1}>{plan.title}</Text>
            </View>
            <View className="mt-1 flex-row items-center gap-1.5">
              <Avatar name={plan.chef?.name ?? '?'} size={18} />
              <Text className="text-[12px] text-muted">{plan.chef?.name ?? 'Chef'} · {SLOT_EMOJI[plan.slot]} {plan.slot} · {daysLabel(plan.days_of_week)}</Text>
            </View>
            {plan.description ? <Text className="mt-2 text-[13px] leading-5 text-muted">{plan.description}</Text> : null}
          </View>

          <View className="mb-4 flex-row items-center justify-between">
            <View>
              <Text className="font-sans-sb text-[15px] text-ink">Plates each day</Text>
              <Text className="text-[12px] text-faint">Up to {plan.max_per_day} per day</Text>
            </View>
            <Stepper value={qty} min={1} max={plan.max_per_day} onChange={setQty} />
          </View>

          <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Start from</Text>
          <View className="mb-4 flex-row gap-2">
            {[{ k: true, l: 'Today' }, { k: false, l: 'Tomorrow' }].map((o) => {
              const on = startToday === o.k;
              return (
                <Pressable key={o.l} onPress={() => setStartToday(o.k)} className={`rounded-full border px-4 py-2 ${on ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}>
                  <Text className={`text-[13px] ${on ? 'font-sans-sb text-accent' : 'font-sans-md text-muted'}`}>{o.l}</Text>
                </Pressable>
              );
            })}
          </View>

          <View className="mb-5 flex-row items-center justify-between rounded-2xl bg-inset px-4 py-3">
            <Text className="font-sans-md text-[14px] text-muted">{qty} × ₹{plan.price} / day</Text>
            <Text className="font-display-x text-[20px] text-ink">₹{plan.price * qty}<Text className="font-sans text-[12px] text-faint">/day</Text></Text>
          </View>

          <Button label="Subscribe & message chef" icon="logo-whatsapp" variant="whatsapp" size="lg" fullWidth onPress={() => onConfirm(plan, qty, startToday)} />
          <Text className="mt-2.5 text-center text-[11px] leading-4 text-faint">
            You'll get this tiffin on {daysLabel(plan.days_of_week).toLowerCase()}. Pause or cancel anytime in You → Tiffins.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
