import { Redirect, Slot } from 'expo-router';
import { View } from 'react-native';
import { TopBar } from '../../components/TopBar';
import { useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useThemeColors } from '../../theme';

/**
 * The tab routes (Home, Feed, Listings, Post, Search, You + hidden Food/category).
 * Both desktop and mobile render the matched route via <Slot/>; navigation comes
 * from the persistent NavRail (desktop) / BottomBar (mobile) at the root layout.
 * Mobile adds the slim TopBar (brand + theme + bell) above the content.
 */
export default function TabsLayout() {
  const { isDesktop } = useResponsive();
  const { ready, session } = useAuth();
  const c = useThemeColors();

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  if (!session) return <Redirect href={'/landing' as any} />;

  if (isDesktop) return <Slot />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar />
      <Slot />
    </View>
  );
}
