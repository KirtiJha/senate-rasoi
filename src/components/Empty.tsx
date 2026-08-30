import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { ZoomIn } from 'react-native-reanimated';

import { AView, dur, ease } from '../lib/motion';
import { useThemeColors } from '../theme';

/**
 * Nothing here yet.
 *
 * The shape rhymes with ErrorState on purpose — same silhouette, different
 * glyph and tone — so "nothing here" and "we couldn't load it" read as
 * siblings rather than as two unrelated screens. Which they are: the
 * distinction between them is the whole point of the error work.
 */
export function Empty({
  icon,
  title,
  children,
  action,
}: {
  /** An Ionicon name. */
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const c = useThemeColors();

  return (
    <View className="items-center px-6" style={{ paddingVertical: 56 }}>
      <AView
        entering={ZoomIn.duration(dur.expressive).easing(ease.emphasized)
          .withInitialValues({ transform: [{ scale: 0.7 }] })}
        className="mb-4 items-center justify-center"
        style={{
          width: 72,
          height: 72,
          backgroundColor: c.inset,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderBottomLeftRadius: 14,
          borderBottomRightRadius: 14,
        }}
      >
        <Ionicons name={icon} size={30} color={c.muted} />
      </AView>

      <Text className="mb-1.5 text-center font-display text-[17px] text-ink">{title}</Text>
      {children ? (
        <Text className="mb-5 max-w-[280px] text-center font-sans text-[14px] leading-6 text-muted">
          {children}
        </Text>
      ) : null}
      {action}
    </View>
  );
}
