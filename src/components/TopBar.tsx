import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wordmark } from './Brand';
import { LiveDot } from './ui/Badge';
import { useThemeColors } from '../theme';

// Slim brand bar used as the phone header.
export function TopBar({ live = false }: { live?: boolean }) {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  return (
    <View className="border-b border-line bg-bg" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 py-2.5">
        <Wordmark size={20} />
        {live ? (
          <View className="flex-row items-center gap-1.5 rounded-full bg-inset px-2.5 py-1">
            <LiveDot color={c.accent} size={6} />
            <Text className="font-sans-sb text-[11px] text-muted">Live</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
