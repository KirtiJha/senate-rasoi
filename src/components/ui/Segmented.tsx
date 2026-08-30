import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptics } from '../../lib/haptics';
import { spring } from '../../lib/motion';
import { useThemeColors } from '../../theme';
import { Touchable } from './Touchable';

export type SegmentedItem<K extends string> = {
  key: K;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Appended to the label as "Requests 3" — never a separate floating badge. */
  count?: number;
};

/**
 * The app's one way to switch between views of the same screen.
 *
 * WHY THIS EXISTS
 * Three screens each invented their own answer to the same question. The You
 * screen slid an underline; Admin used a pill sitting in a sunken trough;
 * Settings' appearance picker used a third variant of that trough with an
 * accent-tinted pill. Same gesture, same meaning, three different shapes — the
 * clearest signal that Admin and Profile were built before the design system
 * and never brought forward.
 *
 * The underline won because it is the one that reads at a glance: a trough with
 * a pill in it puts a filled box next to two unfilled boxes, and on a small
 * screen the eye has to work out which of three boxes is the lit one. A single
 * bar sitting under the active word has one job.
 *
 * The indicator springs rather than cuts so the eye follows the selection
 * across instead of re-finding it on the other side.
 */
export function Segmented<K extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly SegmentedItem<K>[];
  value: K;
  onChange: (next: K) => void;
}) {
  const c = useThemeColors();
  const [trackWidth, setTrackWidth] = useState(0);

  const index = Math.max(0, items.findIndex((i) => i.key === value));
  const cell = trackWidth / items.length;

  const slide = useSharedValue(index);
  useEffect(() => {
    slide.set(withSpring(index, spring.card));
  }, [index, slide]);

  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.get() * cell }],
    width: cell,
  }));

  const pick = (next: K) => {
    if (next === value) return;
    haptics.select();
    onChange(next);
  };

  return (
    <View onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row' }}>
        {items.map((item) => {
          const active = item.key === value;
          const tint = active ? c.ink : c.muted;
          return (
            // Layout lives on a plain View: Touchable composes its own animated
            // style, so a flex handed to it never reaches the layout.
            <View key={item.key} style={{ flex: 1 }}>
              <Touchable
                haptic={null}
                onPress={() => pick(item.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={item.label}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 11,
                  }}
                >
                  {item.icon ? (
                    <Ionicons name={item.icon} size={15} color={active ? c.accent : c.muted} />
                  ) : null}
                  <Text
                    className="text-[14px]"
                    numberOfLines={1}
                    style={{
                      color: tint,
                      fontFamily: active ? 'HankenGrotesk_600SemiBold' : 'HankenGrotesk_500Medium',
                    }}
                  >
                    {item.label}
                    {item.count ? <Text style={{ color: c.accent }}>{`  ${item.count}`}</Text> : null}
                  </Text>
                </View>
              </Touchable>
            </View>
          );
        })}
      </View>
      <View style={{ height: 2, backgroundColor: c.line, borderRadius: 1 }}>
        <Animated.View style={[indicator, { height: 2, borderRadius: 1, backgroundColor: c.accent }]} />
      </View>
    </View>
  );
}
