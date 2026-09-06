import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { useThemeColors } from '../../theme';

/**
 * The one status pill.
 *
 * Every tile had grown its own: a rounded View with a Tailwind hex behind a
 * ten-point Text with another hex — forty-odd copies, none of which knew
 * about dark mode. A tone names the state; the theme decides the colours on
 * whichever ground the pill lands.
 */
export type BadgeTone = 'accent' | 'success' | 'warn' | 'danger' | 'info' | 'neutral' | 'highlight' | 'whatsapp' | 'onPhoto';

export function Badge({
  label,
  tone = 'neutral',
  size = 'md',
  icon,
  className = '',
}: {
  label: string;
  tone?: BadgeTone;
  /** `sm` is the in-card pill; `md` the standalone one. */
  size?: 'sm' | 'md';
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
}) {
  const c = useThemeColors();
  const t = {
    accent: { bg: c.accentSoft, fg: c.accent },
    success: { bg: c.successSoft, fg: c.successInk },
    warn: { bg: c.warnSoft, fg: c.warnInk },
    danger: { bg: c.dangerSoft, fg: c.dangerInk },
    info: { bg: c.infoSoft, fg: c.infoInk },
    neutral: { bg: c.inset, fg: c.muted },
    highlight: { bg: c.highlightSoft, fg: c.highlightInk },
    whatsapp: { bg: c.whatsappSoft, fg: c.success },
    onPhoto: { bg: 'rgba(0,0,0,0.55)', fg: '#FFFFFF' },
  }[tone];
  const sm = size === 'sm';
  return (
    <View
      className={`flex-row items-center gap-1 rounded-full ${sm ? 'px-2 py-0.5' : 'px-2.5 py-1'} ${className}`}
      style={{ backgroundColor: t.bg }}
    >
      {icon ? <Ionicons name={icon} size={sm ? 10 : 12} color={t.fg} /> : null}
      <Text className={'text-[11px] font-sans-sb'} style={{ color: t.fg }}>{label}</Text>
    </View>
  );
}

export function LiveDot({ color = '#fff', size = 7 }: { color?: string; size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.5, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ scale }], opacity }}
    />
  );
}
