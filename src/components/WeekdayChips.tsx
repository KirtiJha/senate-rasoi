import { Pressable, Text, View } from 'react-native';

import { DOW_SHORT } from '../lib/schedule';
import { useThemeColors } from '../theme';

/** A row of Su–Sa toggle chips for picking weekdays (0 = Sunday). */
export function WeekdayChips({
  value, onChange, accent,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  accent?: string;
}) {
  const c = useThemeColors();
  const on = accent ?? c.accent;
  const toggle = (d: number) =>
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);

  return (
    <View className="flex-row gap-1.5">
      {DOW_SHORT.map((label, d) => {
        const active = value.includes(d);
        return (
          <Pressable
            key={d}
            onPress={() => toggle(d)}
            className="h-10 flex-1 items-center justify-center rounded-xl border"
            style={{ borderColor: active ? on : c.line, backgroundColor: active ? on : c.inset }}
          >
            <Text className="text-[12px] font-sans-sb" style={{ color: active ? '#fff' : c.muted }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
