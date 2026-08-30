import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { useThemeColors } from '../../theme';
import { Touchable } from './Touchable';

/**
 * A module in a grid — the shape used by "What are you posting?" and by
 * Home's "All of Aangan" index.
 *
 * It existed twice, and the two had drifted: the same tile with the same
 * accent rule along its top, but one on a 16px radius and the other on the
 * 22px niche radius. A 3px rule inside a 22px corner gets pinched into a
 * sliver, so the softer radius is the one that reads correctly — and it is
 * kept here as a deliberate exception to the niche radius, which is for
 * surfaces that HOLD content rather than ones capped by a rule.
 *
 * One component now, so they cannot drift again.
 */
export function ModuleTile({
  icon,
  label,
  blurb,
  badge = 0,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  blurb?: string;
  /** Shown only when it is something you need to act on. */
  badge?: number;
  onPress: () => void;
}) {
  const c = useThemeColors();

  return (
    <Touchable
      haptic={null}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge}` : label}
    >
      <View
        className="overflow-hidden rounded-2xl"
        style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}
      >
        <View style={{ height: 3, backgroundColor: c.accent }} />
        <View className="p-3.5">
          <View
            className="mb-2.5 h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: c.accentSoft }}
          >
            <Ionicons name={icon} size={20} color={c.accent} />
          </View>
          <Text className="font-sans-bold text-[13px] text-ink" numberOfLines={1}>{label}</Text>
          {blurb ? (
            <Text className="mt-0.5 text-[11px] font-sans-md text-muted" numberOfLines={2}>{blurb}</Text>
          ) : null}
        </View>

        {badge > 0 ? (
          <View
            className="absolute items-center justify-center rounded-full px-1.5"
            style={{ top: 12, right: 12, minWidth: 20, height: 20, backgroundColor: c.highlight }}
          >
            <Text className="font-sans-bold text-[11px]" style={{ color: c.ink }}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        ) : null}
      </View>
    </Touchable>
  );
}
