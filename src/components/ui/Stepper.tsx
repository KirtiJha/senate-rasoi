import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useThemeColors } from '../../theme';

export function Stepper({
  value,
  min = 1,
  max = 99,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  const c = useThemeColors();
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View className="flex-row items-center rounded-2xl border border-line bg-inset">
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={atMin}
        className={`h-12 w-12 items-center justify-center ${atMin ? 'opacity-30' : 'active:opacity-60'}`}
      >
        <Ionicons name="remove" size={22} color={c.ink} />
      </Pressable>
      <Text className="min-w-10 text-center font-display text-lg text-ink">{value}</Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={atMax}
        className={`h-12 w-12 items-center justify-center ${atMax ? 'opacity-30' : 'active:opacity-60'}`}
      >
        <Ionicons name="add" size={22} color={c.ink} />
      </Pressable>
    </View>
  );
}
