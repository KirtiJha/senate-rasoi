import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { daysLabel } from './TiffinCard';
import { Avatar, Button, Sheet, Stepper, VegMark } from './ui';
import { SLOT_EMOJI, TiffinPlanWithChef } from '../lib/types';

/**
 * Same shape as OrderModal: subscribing is the action, WhatsApp is an extra.
 *
 * This one needed a database change first. A one-off order has notified the
 * chef since 0005; a subscription notified nobody, and the client papered over
 * that by opening WhatsApp immediately after — so the outside app was
 * genuinely load-bearing here. 0104 adds the trigger, and only then can this
 * sheet stop insisting on WhatsApp.
 */
interface SubscribeModalProps {
  plan: TiffinPlanWithChef | null;
  onClose: () => void;
  onConfirm: (plan: TiffinPlanWithChef, qty: number, startToday: boolean, via: 'app' | 'whatsapp') => void;
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
    <Sheet
      visible
      onClose={onClose}
      title="Subscribe to tiffin"
      maxWidth={560}
      footer={
        <View className="gap-2">
          <Button
            label="Subscribe"
            icon="checkmark-circle-outline"
            size="lg"
            fullWidth
            onPress={() => onConfirm(plan, qty, startToday, 'app')}
          />
          {plan.chef?.whatsapp ? (
            <Button
              label="Subscribe & message on WhatsApp"
              icon="logo-whatsapp"
              variant="whatsapp"
              size="lg"
              fullWidth
              onPress={() => onConfirm(plan, qty, startToday, 'whatsapp')}
            />
          ) : null}
        </View>
      }
    >
      <View className="mb-4 card p-3">
        <View className="flex-row items-center gap-1.5">
          <VegMark type={plan.veg_type} size={13} />
          <Text className="flex-1 font-display text-[17px] text-ink" numberOfLines={1}>{plan.title}</Text>
        </View>
        <View className="mt-1 flex-row items-center gap-1.5">
          <Avatar name={plan.chef?.name ?? '?'} userId={plan.chef?.id} size={18} />
          <Text className="font-sans text-[12px] text-muted">{plan.chef?.name ?? 'Chef'} · {SLOT_EMOJI[plan.slot]} {plan.slot} · {daysLabel(plan.days_of_week)}</Text>
        </View>
        {plan.description ? <Text className="font-sans mt-2 text-[13px] leading-5 text-muted">{plan.description}</Text> : null}
      </View>

      <View className="mb-4 flex-row items-center justify-between">
        <View>
          <Text className="font-sans-sb text-[15px] text-ink">Plates each day</Text>
          <Text className="font-sans text-[12px] text-faint">Up to {plan.max_per_day} per day for your flat</Text>
        </View>
        <Stepper value={qty} min={1} max={plan.max_per_day} onChange={setQty} />
      </View>

      <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Start from</Text>
      <View className="mb-4 flex-row gap-2">
        {[{ k: true, l: 'Today' }, { k: false, l: 'Tomorrow' }].map((o) => {
          const on = startToday === o.k;
          return (
            <Pressable
              key={o.l}
              onPress={() => setStartToday(o.k)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              className={`rounded-full border px-4 py-2 ${on ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}
            >
              <Text className={`text-[13px] ${on ? 'font-sans-sb text-accent' : 'font-sans-md text-muted'}`}>{o.l}</Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mb-3 flex-row items-center justify-between rounded-2xl bg-inset px-4 py-3">
        <Text className="font-sans-md text-[14px] text-muted">{qty} × ₹{plan.price} / day</Text>
        <Text className="font-display-x text-[20px] text-ink">₹{plan.price * qty}<Text className="font-sans text-[12px] text-faint">/day</Text></Text>
      </View>

      <Text className="font-sans text-center text-[11px] leading-4 text-faint">
        {plan.chef?.whatsapp ? 'Either way ' : ''}{plan.chef?.name ?? 'The cook'} is notified in
        Aangan. You&apos;ll get this tiffin on {daysLabel(plan.days_of_week).toLowerCase()}. Pause
        or cancel anytime in You → Tiffins.
      </Text>
      <Text className="font-sans mt-2 text-center text-[11px] leading-4 text-faint">
        This tiffin is cooked by a resident. Aangan only lists it and isn&apos;t responsible for the food,
        payment, or delivery — your subscription is directly with the cook.
      </Text>
    </Sheet>
  );
}
