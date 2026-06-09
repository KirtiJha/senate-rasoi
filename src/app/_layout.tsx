import '../global.css';

import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NavRail } from '../components/NavRail';
import { useResponsive } from '../components/ui';
import { AuthProvider } from '../context/auth';
import { NotificationsProvider } from '../context/notifications';
import { ThemeProvider } from '../context/theme';
import { ToastProvider } from '../context/toast';
import { UnreadDmsProvider } from '../context/unread';
import { useAuth } from '../context/auth';
import { useIsDark, useThemeColors } from '../theme';

SplashScreen.preventAutoHideAsync();

// Show order notifications while the app is foregrounded (native only).
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

function AppShell() {
  const c = useThemeColors();
  const isDark = useIsDark();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaProvider>
        <AuthProvider>
          <UnreadDmsProvider>
            <NotificationsProvider>
              <ToastProvider>
                <StatusBar style={isDark ? 'light' : 'dark'} />
                <DesktopShell />
              </ToastProvider>
            </NotificationsProvider>
          </UnreadDmsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * On desktop: renders the persistent NavRail alongside the Stack navigator so
 * that navigating to admin/polls/emergency/about never hides the sidebar.
 * On mobile: just renders the Stack (bottom tabs handle navigation there).
 */
function DesktopShell() {
  const c = useThemeColors();
  const { isDesktop } = useResponsive();
  const { ready, session } = useAuth();
  const showRail = isDesktop && ready && !!session;

  return (
    <View
      style={{
        flex: 1,
        flexDirection: showRail ? 'row' : 'column',
        backgroundColor: c.bg,
      }}
    >
      {showRail ? <NavRail /> : null}
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="about" />
          <Stack.Screen name="listings" />
          <Stack.Screen name="profile/me" />
          <Stack.Screen name="profile/[userId]" />
          <Stack.Screen name="feed/[postId]" />
          <Stack.Screen name="listing/[id]" />
          <Stack.Screen name="emergency" />
          <Stack.Screen name="polls" />
          <Stack.Screen name="messages/index" />
          <Stack.Screen name="messages/new" />
          <Stack.Screen name="messages/[threadId]" />
        </Stack>
      </View>
    </View>
  );
}
