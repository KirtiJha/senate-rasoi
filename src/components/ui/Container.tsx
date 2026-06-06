import { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { layout } from '../../theme';

/** Breakpoint-aware layout info, derived from the window width. */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const columns = width >= 1040 ? 3 : width >= 680 ? 2 : 1;
  return {
    width,
    height,
    columns,
    isWide: width >= 680,
    isDesktop: width >= 1040,
  };
}

/**
 * Centers content with a max width so the app feels intentional on tablets and
 * desktop browsers instead of stretching edge-to-edge.
 */
export function Container({
  children,
  narrow,
  className = '',
}: {
  children: ReactNode;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <View className={`w-full self-center ${className}`} style={{ maxWidth: narrow ? layout.maxNarrow : layout.maxContent }}>
      {children}
    </View>
  );
}
