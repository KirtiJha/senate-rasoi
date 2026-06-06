import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DOW_LABELS, SLOT_EMOJI, TiffinPlanWithChef } from '../lib/types';
import { Avatar, Badge, VegMark } from './ui';

export function daysLabel(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return 'Every day';
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Mon–Fri';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends';
  return [...days].sort((a, b) => a - b).map((d) => DOW_LABELS[d]).join(', ');
}

interface TiffinCardProps {
  plan: TiffinPlanWithChef;
  subscribed: boolean;
  onPress: (plan: TiffinPlanWithChef) => void;
  width?: number;
}

function TiffinCardBase({ plan, subscribed, onPress, width }: TiffinCardProps) {
  return (
    <Pressable
      onPress={() => onPress(plan)}
      style={width ? { width } : undefined}
      className="overflow-hidden rounded-3xl border border-line bg-surface active:opacity-90"
    >
      <View className="h-24 w-full bg-inset">
        {plan.photo_url ? (
          <Image source={{ uri: plan.photo_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text style={{ fontSize: 34 }}>🍱</Text>
          </View>
        )}
        <View className="absolute left-2.5 top-2.5 flex-row items-center gap-1.5">
          <View className="rounded-md bg-white/95 p-0.5">
            <VegMark type={plan.veg_type} size={13} />
          </View>
          <Badge label="Tiffin" tone="onPhoto" />
        </View>
      </View>

      <View className="p-3">
        <Text className="font-display text-[16px] text-ink" numberOfLines={1}>{plan.title}</Text>
        <View className="mt-1 flex-row items-center gap-1.5">
          <Avatar name={plan.chef?.name ?? '?'} size={16} />
          <Text className="flex-1 text-[12px] text-muted" numberOfLines={1}>{plan.chef?.name ?? 'Chef'}</Text>
        </View>
        <Text className="mt-1 text-[12px] text-faint" numberOfLines={1}>
          {SLOT_EMOJI[plan.slot]} {plan.slot} · {daysLabel(plan.days_of_week)}
        </Text>

        <View className="mt-2.5 flex-row items-center justify-between">
          <Text className="font-display-x text-[18px] text-ink">
            ₹{plan.price}
            <Text className="font-sans text-[11px] text-faint"> /day</Text>
          </Text>
          {subscribed ? (
            <View className="rounded-xl bg-inset px-3 py-1.5">
              <Text className="font-sans-sb text-[12px] text-success">Subscribed ✓</Text>
            </View>
          ) : (
            <View className="rounded-xl bg-accent px-3 py-1.5">
              <Text className="font-sans-sb text-[12px] text-on-accent">Subscribe</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export const TiffinCard = memo(TiffinCardBase);
