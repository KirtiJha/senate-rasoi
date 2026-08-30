import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { haptics } from '../../lib/haptics';
import { useThemeColors } from '../../theme';
import { Touchable } from './Touchable';

/**
 * A filter or selection chip.
 *
 * WHY THIS EXISTS
 * Filter rows were hand-rolled on every screen that has one — food, listings,
 * feed, borrow, places, sports, recommend — each with its own padding, radius
 * and, until the accent sweep, its own colour. They also disagreed about what
 * "selected" looks like: some tinted the background, some changed only the
 * text, some did both.
 *
 * A filter bar needs an unmistakable state, so selection here is a solid accent
 * fill rather than a soft one. Everything painted sits on a plain View, because
 * Touchable owns its own `style` and a className carrying a background on it
 * silently loses.
 */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  count,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Shown as a suffix — "Veg 12" — never as a separate badge. */
  count?: number;
}) {
  const c = useThemeColors();

  return (
    <Touchable
      haptic={null}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={count != null ? `${label}, ${count}` : label}
    >
      <View
        className="flex-row items-center gap-1.5 rounded-full px-3.5"
        style={{
          height: 34,
          backgroundColor: selected ? c.accent : c.surface,
          borderWidth: 1,
          borderColor: selected ? c.accent : c.line,
        }}
      >
        {icon ? (
          <Ionicons name={icon} size={14} color={selected ? c.onAccent : c.muted} />
        ) : null}
        <Text
          className="font-sans-sb text-[13px]"
          style={{ color: selected ? c.onAccent : c.ink }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {count != null ? (
          <Text
            className="font-sans-sb text-[11px]"
            style={{ color: selected ? c.onAccent : c.subtle, opacity: selected ? 0.8 : 1 }}
          >
            {count}
          </Text>
        ) : null}
      </View>
    </Touchable>
  );
}
