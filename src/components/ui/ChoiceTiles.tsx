import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useThemeColors } from '../../theme';

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
  leading?: ReactNode;
}

/** Tactile selectable tiles — a modern replacement for radio lists. */
export function ChoiceTiles<T extends string>({
  options,
  value,
  onChange,
  columns = 1,
}: {
  options: Choice<T>[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: number;
}) {
  const c = useThemeColors();
  return (
    <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <View key={opt.value} style={{ width: `${100 / columns}%`, padding: 4 }}>
            <Pressable
              onPress={() => onChange(opt.value)}
              className={`h-full flex-row items-center gap-2.5 rounded-2xl border-[1.5px] px-3.5 py-3 ${
                selected ? 'border-accent bg-accent-soft' : 'border-line bg-inset active:border-faint'
              }`}
            >
              {opt.leading ? <View>{opt.leading}</View> : null}
              <View className="flex-1">
                <Text className={`text-[14px] ${selected ? 'font-sans-sb text-ink' : 'font-sans-md text-ink'}`}>
                  {opt.label}
                </Text>
                {opt.hint ? <Text className="text-[11px] text-faint">{opt.hint}</Text> : null}
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={18} color={c.accent} /> : null}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
