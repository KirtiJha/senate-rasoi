import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useThemeColors } from '../../theme';
import { Touchable } from './Touchable';

/**
 * One row in a grouped list.
 *
 * The shape "Around the aangan" needs, and the shape the Settings screen,
 * documents, payments and the directory were each rebuilding by hand: a
 * leading glyph or avatar, a primary line, a secondary line, and a trailing
 * timestamp or chevron.
 *
 * The separator insets past the leading element rather than running full
 * bleed — that indent is what makes a list read as grouped rows instead of a
 * stack of boxes, and it is the detail hand-rolled rows always miss.
 */
export function ListRow({
  icon,
  leading,
  title,
  subtitle,
  meta,
  onPress,
  danger,
  last,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  /** An avatar or other custom leading element, used instead of `icon`. */
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  /** Trailing text — a timestamp, a count. Replaces the chevron. */
  meta?: string;
  onPress?: () => void;
  danger?: boolean;
  /** Suppresses the separator on the final row of a group. */
  last?: boolean;
}) {
  const c = useThemeColors();
  const tint = danger ? c.danger : c.ink;

  const body = (
    <View>
      <View className="flex-row items-center gap-3 px-4" style={{ minHeight: 64, paddingVertical: 12 }}>
        {leading ?? (icon ? (
          <View
            className="items-center justify-center rounded-xl"
            style={{ width: 40, height: 40, backgroundColor: danger ? c.dangerSoft : c.inset }}
          >
            <Ionicons name={icon} size={19} color={danger ? c.danger : c.muted} />
          </View>
        ) : null)}

        <View className="min-w-0 flex-1">
          <Text className="font-sans-sb text-[15px]" style={{ color: tint }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text className="mt-0.5 text-[13px] font-sans-md text-muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {meta ? (
          <Text className="text-[12px] font-sans-md text-subtle" numberOfLines={1}>{meta}</Text>
        ) : onPress ? (
          <Ionicons name="chevron-forward" size={17} color={c.subtle} />
        ) : null}
      </View>

      {!last ? (
        <View style={{ height: 1, marginLeft: 68, backgroundColor: c.line }} />
      ) : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Touchable haptic={null} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      {body}
    </Touchable>
  );
}
