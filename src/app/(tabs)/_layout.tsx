import { Ionicons } from '@expo/vector-icons';
import { Redirect, Slot, Tabs } from 'expo-router';
import { ColorValue, Platform, View } from 'react-native';
import { NavRail } from '../../components/NavRail';
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

  // Desktop / wide: left rail + content outlet.
  if (isDesktop) {
    return (
      <View className="flex-1 flex-row bg-bg">
        <NavRail />
        <View className="flex-1">
          <Slot />
        </View>
      </View>
    );
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
          height: Platform.OS === 'web' ? 64 : undefined,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'HankenGrotesk_600SemiBold', marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 4 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Discover', tabBarIcon: tabIcon('compass', 'compass-outline') }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: 'Post',
          tabBarIcon: tabIcon('add-circle', 'add-circle-outline'),
          href: isChef ? '/post' : null, // only chefs get the Post tab
        }}
      />
      <Tabs.Screen
        name="you"
        options={{ title: 'You', tabBarIcon: tabIcon('person', 'person-outline') }}
      />
    </Tabs>
  );
}
