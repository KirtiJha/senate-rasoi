import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useThemeColors } from '../theme';

/**
 * Fine-print liability notice for the Home Food board. Aangan only lists food
 * cooked by residents — it isn't a party to any order. Taps through to the full
 * Terms (the "Home food & home services" + liability clauses).
 */
export function FoodDisclaimer() {
  const c = useThemeColors();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/legal?tab=terms' as any)}
      className="mt-3 flex-row gap-2.5 rounded-2xl border border-line bg-inset p-3.5 active:opacity-80"
    >
      <Ionicons name="information-circle-outline" size={18} color={c.muted} style={{ marginTop: 1 }} />
      <Text className="flex-1 text-[12px] leading-[18px] text-muted">
        <Text className="font-sans-sb text-ink">Aangan is a listing platform only. </Text>
        Home food and tiffins are cooked and sold by individual residents in home kitchens — not by
        Aangan. We don&apos;t prepare, inspect, or guarantee any dish, and are not responsible for its
        quality, hygiene, allergens, pricing, payment, or delivery. Please confirm ingredients and
        allergens with the cook directly; any order is solely between you and the home chef, at your
        own discretion and risk.{' '}
        <Text className="font-sans-sb text-accent">Read full terms</Text>
      </Text>
    </Pressable>
  );
}
