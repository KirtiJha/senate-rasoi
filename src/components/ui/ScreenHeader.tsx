import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
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
  icon, iconNode, iconColor, title, onAdd, addLabel = 'Add', showBack, backHref, right, subBar, hideSociety,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  iconNode?: ReactNode; // custom leading element (e.g. the app logo); overrides `icon`
  iconColor?: string;
  title: string;
  onAdd?: () => void;
  addLabel?: string;
  showBack?: boolean;
  backHref?: string; // fallback target when there's no history (e.g. a hard refresh on web)
  right?: ReactNode;
  subBar?: ReactNode;
  hideSociety?: boolean;
}) {
  const { isDesktop } = useResponsive();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();

  // Inside the (tabs) group, TopBar sits above this header and has ALREADY
  // applied insets.top — adding it again pays for the status bar twice and
  // leaves an unexplained band under the bar. Pushed screens have no TopBar,
  // so there this header is what keeps the title out of the status bar.
  const underTopBar = segments[0] === '(tabs)';
  const { community } = useAuth();

  // On web, refreshing a deep route leaves an empty history stack, so router.back()
  // is a no-op. Fall back to a sensible parent (or Home) in that case.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace((backHref ?? '/') as any);
  };

  const showSociety = !isDesktop && !hideSociety && !!community;

  return (
    <View style={{ paddingTop: isDesktop ? insets.top + 16 : underTopBar ? 10 : insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
      {showSociety ? (
        <View
          className="mb-2 flex-row items-center gap-1 self-start rounded-full px-2.5 py-1"
          style={{ backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accentLine, maxWidth: '100%' }}
        >
          <Ionicons name="business" size={11} color={c.accent} />
          <Text className="text-[11px] font-sans-sb" numberOfLines={1} style={{ color: c.accent, flexShrink: 1 }}>{community!.name}</Text>
        </View>
      ) : null}

      <View className="flex-row items-center gap-2">
        {showBack ? (
          <Pressable
            onPress={goBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="-ml-1.5 h-10 w-10 items-center justify-center rounded-full active:bg-inset"
          >
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
        ) : null}
        {iconNode ?? (icon ? <Ionicons name={icon} size={20} color={iconColor ?? c.ink} /> : null)}
        <Text className="flex-1 font-display-x text-[20px] text-ink" numberOfLines={1}>{title}</Text>
        {right}
        {onAdd ? (
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={addLabel}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full bg-accent active:bg-accent-press"
          >
            <Ionicons name="add" size={22} color={c.onAccent} />
          </Pressable>
        ) : null}
      </View>
      {subBar ? <View className="mt-2.5">{subBar}</View> : null}
    </View>
  );
}
