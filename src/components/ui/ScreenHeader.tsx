import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth';
import { useThemeColors } from '../../theme';
import { useResponsive } from './Container';

/**
 * The standard page header used across every screen except Home: a full-width
 * bar with an icon + bold title on the left and (where relevant) a circular
 * add button on the far right. A back chevron shows on mobile for pushed
 * screens (`showBack`). Render filter chips / search below via `subBar`.
 *
 * On mobile a small society pill sits above the title so the society name is
 * visible on community/detail pages (which have no TopBar). Pass `hideSociety`
 * on the tab screens that already show it in the TopBar, to avoid duplicates.
 */
export function ScreenHeader({
  icon, iconColor, title, onAdd, addLabel = 'Add', showBack, right, subBar, hideSociety,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  onAdd?: () => void;
  addLabel?: string;
  showBack?: boolean;
  right?: ReactNode;
  subBar?: ReactNode;
  hideSociety?: boolean;
}) {
  const { isDesktop } = useResponsive();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { community } = useAuth();

  const showSociety = !isDesktop && !hideSociety && !!community;

  return (
    <View style={{ paddingTop: isDesktop ? insets.top + 16 : insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
      {showSociety ? (
        <View
          className="mb-2 flex-row items-center gap-1 self-start rounded-full px-2.5 py-1"
          style={{ backgroundColor: '#0D948822', borderWidth: 1, borderColor: '#0D948855', maxWidth: '100%' }}
        >
          <Ionicons name="business" size={11} color="#0D9488" />
          <Text className="text-[11px] font-sans-sb" numberOfLines={1} style={{ color: '#0D9488', flexShrink: 1 }}>{community!.name}</Text>
        </View>
      ) : null}

      <View className="flex-row items-center gap-2">
        {showBack && !isDesktop ? (
          <Pressable onPress={() => router.back()} hitSlop={10} className="-ml-1.5 h-9 w-9 items-center justify-center rounded-full active:bg-inset">
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
        ) : null}
        {icon ? <Ionicons name={icon} size={20} color={iconColor ?? c.ink} /> : null}
        <Text className="flex-1 font-display-x text-[20px] text-ink" numberOfLines={1}>{title}</Text>
        {right}
        {onAdd ? (
          <Pressable
            onPress={onAdd}
            accessibilityLabel={addLabel}
            className="h-9 w-9 items-center justify-center rounded-full bg-accent active:bg-accent-press"
          >
            <Ionicons name="add" size={22} color={c.onAccent} />
          </Pressable>
        ) : null}
      </View>
      {subBar ? <View className="mt-2.5">{subBar}</View> : null}
    </View>
  );
}
