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

/**
 * Tactile selectable tiles — a modern replacement for radio lists.
 *
 * LAID OUT IN EXPLICIT ROWS, NOT BY WRAPPING.
 *
 * This used a wrapping row of `width: 100/columns %` tiles. In exact
 * arithmetic two 50% tiles fit a line perfectly; on a device they do not
 * always, because Yoga rounds percentages to physical pixels and at some
 * densities the pair comes to a fraction over the line. The second tile then
 * wraps onto its own row, and a 2x2 grid silently becomes a 4x1 column —
 * twice as tall, which is how it was reported: "Meal slot is stretched too
 * much vertically".
 *
 * It is a rounding failure, so it is invisible on whatever device you test on
 * and obvious on someone else's. Chunking into rows and giving each cell
 * `flex: 1` removes percentages from the layout entirely: the row divides
 * exactly whatever width it is given, at any density, and can never wrap
 * because nothing is asking to.
 *
 * Short final rows are padded with empty cells, so three options across two
 * columns leave a gap rather than one double-width tile.
 *
 * Height comes from `flex: 1` in a column cell rather than `height: 100%` —
 * same reason. A percentage of a parent that is itself being stretched is a
 * value that resolves differently depending on when it is measured.
 */
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

  const rows: (Choice<T> | null)[][] = [];
  for (let i = 0; i < options.length; i += columns) {
    const row: (Choice<T> | null)[] = options.slice(i, i + columns);
    while (row.length < columns) row.push(null);
    rows.push(row);
  }

  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', alignItems: 'stretch', gap: 8 }}>
          {row.map((opt, i) => {
            if (!opt) return <View key={`pad${i}`} style={{ flex: 1 }} />;
            const selected = value === opt.value;
            return (
              <View key={opt.value} style={{ flex: 1 }}>
                <Pressable
                  onPress={() => onChange(opt.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={opt.hint ? `${opt.label}, ${opt.hint}` : opt.label}
                  style={{ flex: 1 }}
                  className={`flex-row items-center gap-2.5 rounded-2xl border-[1.5px] px-3.5 py-3 ${
                    selected ? 'border-accent bg-accent-soft' : 'border-line bg-inset active:border-faint'
                  }`}
                >
                  {opt.leading ? <View>{opt.leading}</View> : null}
                  <View className="min-w-0 flex-1">
                    <Text
                      className={`text-[14px] ${selected ? 'font-sans-sb text-ink' : 'font-sans-md text-ink'}`}
                      numberOfLines={1}
                    >
                      {opt.label}
                    </Text>
                    {opt.hint ? (
                      <Text className="font-sans text-[11px] text-faint" numberOfLines={1}>{opt.hint}</Text>
                    ) : null}
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={18} color={c.accent} /> : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
