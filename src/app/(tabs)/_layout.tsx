import { Ionicons } from '@expo/vector-icons';
import { Redirect, Slot, Tabs } from 'expo-router';
import { ColorValue, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../components/TopBar';
import { useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useThemeColors } from '../../theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

export default function TabsLayout() {
  const { isDesktop } = useResponsive();
  const { ready, session, isChef, isAdmin } = useAuth();
  const c = useThemeColors();

  // Auth gate.
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  if (!session) return <Redirect href="/sign-in" />;

  // Desktop / wide: NavRail is rendered at root layout level (persists across all
  // stack screens). Just render the tab content here.
  if (isDesktop) {
    return <Slot />;
  }

  // Phone: bottom tab bar with a header brand bar.
  return <PhoneTabs isChef={isChef} />;
}

function tabIcon(focused: IoniconName, unfocused: IoniconName) {
  return ({ color, focused: isF }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={isF ? focused : unfocused} size={24} color={color as string} />
  );
}

function PhoneTabs({ isChef }: { isChef: boolean }) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();

  // On web the tab bar must accommodate the browser's chrome at the bottom.
  // Avoid a fixed height — it fights React Navigation's internal safe-area
  // padding and leaves no room for the label. Instead just pad generously.
  const isWeb = Platform.OS === 'web';
  const webBottomPad = isWeb ? Math.max(insets.bottom + 8, 16) : 0;

  return (
    <Tabs
      screenOptions={{
        header: () => <TopBar />,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.faint,
        tabBarStyle: {
          backgroundColor: c.bg,
          borderTopColor: c.line,
          borderTopWidth: 1,
          paddingTop: isWeb ? 10 : 0,
          paddingBottom: webBottomPad,
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'HankenGrotesk_600SemiBold', marginTop: 2 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="food"
        options={{ title: 'Food', tabBarIcon: tabIcon('restaurant', 'restaurant-outline'), href: null }}
      />
      <Tabs.Screen
        name="c/[category]"
        options={{ href: null, title: '' }}
      />
      <Tabs.Screen
        name="feed"
        options={{ title: 'Feed', tabBarIcon: tabIcon('chatbubbles', 'chatbubbles-outline') }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: 'Post',
          tabBarIcon: tabIcon('add-circle', 'add-circle-outline'),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: 'Search', tabBarIcon: tabIcon('search', 'search-outline') }}
      />
      <Tabs.Screen
        name="you"
        options={{ title: 'You', tabBarIcon: tabIcon('person', 'person-outline') }}
      />
    </Tabs>
  );
}
