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
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomBar } from '../components/BottomBar';
import { NavRail } from '../components/NavRail';
import { useResponsive } from '../components/ui';
import { AuthProvider } from '../context/auth';
import { ConfirmProvider } from '../context/confirm';
import { TranslationProvider } from '../context/translations';
import { NotificationsProvider } from '../context/notifications';
import { ThemeProvider } from '../context/theme';
import { ToastProvider, useToast } from '../context/toast';
import { setPhotoErrorHandler } from '../lib/photo';
import { UnreadDmsProvider } from '../context/unread';
import { BlocksProvider } from '../context/blocks';
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
          <TranslationProvider>
            <UnreadDmsProvider>
              <BlocksProvider>
                <NotificationsProvider>
                  <ToastProvider>
                    <ConfirmProvider>
                      <StatusBar style={isDark ? 'light' : 'dark'} />
                      <DesktopShell />
                    </ConfirmProvider>
                  </ToastProvider>
                </NotificationsProvider>
              </BlocksProvider>
            </UnreadDmsProvider>
          </TranslationProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * On desktop: renders the persistent NavRail alongside the Stack navigator so
 * navigating to admin/polls/emergency/sports/about never hides the sidebar.
 * On mobile: renders a persistent bottom bar below the Stack so it stays
 * visible across every screen (tabs and community pages alike).
 */
// Tapping a push notification routes to the relevant screen (data.route is set
// by the server-side push payload). Covers both background taps and cold starts.
function usePushTapNavigation() {
  const router = useRouter();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      const route = resp?.notification.request.content.data?.route;
      if (typeof route === 'string') router.push(route as never);
    });
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const route = resp.notification.request.content.data?.route;
      if (typeof route === 'string') router.push(route as never);
    });
    return () => sub.remove();
  }, [router]);
}

function DesktopShell() {
  const c = useThemeColors();
  const toast = useToast();

  // The photo picker is called from plain event handlers all over the app, so
  // it reports failures through a module-level handler rather than a hook.
  // Point that at the toast once, here, inside ToastProvider.
  useEffect(() => { setPhotoErrorHandler(toast.show); }, [toast.show]);

  const { isDesktop } = useResponsive();
  const { ready, session } = useAuth();
  usePushTapNavigation();
  const showRail = isDesktop && ready && !!session;
  const showBottomBar = !isDesktop && ready && !!session;

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
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.bg },
            // slide_from_right is Android-only and resolves to the native push
            // on iOS — one value, correct on both platforms.
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="landing" />
          <Stack.Screen name="legal" />
          <Stack.Screen name="delete-account" />
          <Stack.Screen name="child-safety" />
          <Stack.Screen name="onboard" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="about" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="directory" />
          <Stack.Screen name="food" />
          <Stack.Screen name="post" options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="listings" />
          <Stack.Screen name="search" />
          <Stack.Screen name="c/[category]" />
          <Stack.Screen name="profile/me" />
          <Stack.Screen name="profile/[userId]" />
          <Stack.Screen name="feed/[postId]" />
          <Stack.Screen name="listing/[id]" />
          <Stack.Screen name="listing/edit" options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="dish/[id]" />
          <Stack.Screen name="emergency" />
          <Stack.Screen name="polls" />
          <Stack.Screen name="sports" />
          <Stack.Screen name="sports/[id]" />
          <Stack.Screen name="sports/dues" />
          <Stack.Screen name="documents" />
          <Stack.Screen name="payments" />
          <Stack.Screen name="properties" />
          <Stack.Screen name="property/[id]" />
          <Stack.Screen name="property/new" options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="recommend" />
          <Stack.Screen name="recommend/[id]" />
          <Stack.Screen name="borrow" />
          <Stack.Screen name="borrow/new" options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="borrow/[id]" />
          <Stack.Screen name="places" />
          <Stack.Screen name="place/new" options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="place/[id]" />
          <Stack.Screen name="helpers" />
          <Stack.Screen name="ask" options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="messages/new" />
          <Stack.Screen name="messages/[threadId]" />
        </Stack>
      </View>
      {showBottomBar ? <BottomBar /> : null}
    </View>
  );
}
