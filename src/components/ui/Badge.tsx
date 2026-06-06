import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

type Tone = 'accent' | 'success' | 'neutral' | 'onPhoto';

const TONE: Record<Tone, { box: string; text: string }> = {
  accent: { box: 'bg-accent-soft', text: 'text-accent' },
  success: { box: 'bg-[#E4F5EC] dark:bg-[#10271D]', text: 'text-success' },
  neutral: { box: 'bg-inset', text: 'text-muted' },
  onPhoto: { box: 'bg-black/55', text: 'text-white' },
};

export function Badge({
  label,
  tone = 'neutral',
  className = '',
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <View className={`rounded-full px-2.5 py-1 ${t.box} ${className}`}>
      <Text className={`text-[11px] font-sans-sb ${t.text}`}>{label}</Text>
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
