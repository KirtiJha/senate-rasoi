import { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle } from 'react-native';
import { useThemeColors } from '../../theme';

export function Skeleton({ style, radius = 8 }: { style?: ViewStyle; radius?: number }) {
  const c = useThemeColors();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[{ opacity, backgroundColor: c.inset, borderRadius: radius }, style]} />;
}

export function ListingCardSkeleton() {
  return (
    <View className="overflow-hidden rounded-2xl border border-line bg-surface">
      <Skeleton style={{ height: 140 }} radius={0} />
      <View className="p-3" style={{ gap: 8 }}>
        <Skeleton style={{ width: '80%', height: 14 }} />
        <Skeleton style={{ width: '40%', height: 12 }} />
        <View className="flex-row items-center gap-1.5">
          <Skeleton style={{ width: 18, height: 18 }} radius={9} />
          <Skeleton style={{ width: '55%', height: 10 }} />
        </View>
        <Skeleton style={{ height: 30, marginTop: 2 }} radius={12} />
      </View>
    </View>
  );
}

/** A generic list/table row placeholder: icon + two lines + trailing action. */
export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} className="flex-row items-center gap-3 border-b border-line px-3.5 py-3.5">
          <Skeleton style={{ width: 38, height: 38 }} radius={12} />
          <View className="flex-1" style={{ gap: 7 }}>
            <Skeleton style={{ width: '45%', height: 13 }} />
            <Skeleton style={{ width: '28%', height: 11 }} />
          </View>
          <Skeleton style={{ width: 64, height: 30 }} radius={15} />
        </View>
      ))}
    </View>
  );
}

export function DishCardSkeleton() {
  return (
    <View className="overflow-hidden rounded-3xl border border-line bg-surface">
      <Skeleton style={{ height: 180 }} radius={0} />
      <View className="p-4">
        <View className="flex-row items-center gap-2.5">
          <Skeleton style={{ width: 36, height: 36 }} radius={18} />
          <View style={{ gap: 6 }}>
            <Skeleton style={{ width: 120, height: 11 }} />
            <Skeleton style={{ width: 70, height: 9 }} />
          </View>
        </View>
        <Skeleton style={{ width: '75%', height: 20, marginTop: 14 }} />
        <Skeleton style={{ width: '50%', height: 12, marginTop: 10 }} />
        <View className="mt-4 flex-row items-center justify-between">
          <Skeleton style={{ width: 64, height: 22 }} />
          <Skeleton style={{ width: 96, height: 40, borderRadius: 14 }} />
        </View>
      </View>
    </View>
  );
}
