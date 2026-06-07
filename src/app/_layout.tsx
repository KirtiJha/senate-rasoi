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

import { AuthProvider } from '../context/auth';
import { ThemeProvider } from '../context/theme';
import { ToastProvider } from '../context/toast';
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

  // ThemeProvider must wrap everything so useThemeColors / useIsDark work throughout.
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
          <ToastProvider>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <View style={{ flex: 1, backgroundColor: c.bg }}>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="admin" />
              </Stack>
            </View>
          </ToastProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
