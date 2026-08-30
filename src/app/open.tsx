import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { BrandMark } from '../components/BrandMark';
import { Container } from '../components/ui';
import { PLAY_STORE_URL, deepLink } from '../lib/links';
import { useThemeColors } from '../theme';

/**
 * The landing page for every link Aangan shares outside itself.
 *
 * A link posted in a WhatsApp group is opened by three kinds of people, and it
 * has to do something sensible for each:
 *
 *   • Android, app installed  → open the app at the right screen
 *   • Android, no app         → send them to the Play Store
 *   • Laptop, or anything else → just show them the web app
 *
 * There is no reliable way to ask a browser "is this app installed", so we do
 * the standard thing: attempt the app's scheme, and if we are still here a
 * moment later, it wasn't. If the app *does* open, the browser tab is
 * backgrounded — that fires `visibilitychange`, which is our signal to cancel
 * the store redirect. Without that cancel, someone who successfully opened the
 * app would come back to the browser later and find the Play Store.
 *
 * Registered as a public route: this must work for someone with no account.
 */

const APP_OPEN_GRACE_MS = 1200;

export default function OpenScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const { to } = useLocalSearchParams<{ to?: string }>();
  const target = typeof to === 'string' && to.startsWith('/') ? to : '/';
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    // Opened inside the app already — nothing to negotiate, just navigate.
    if (Platform.OS !== 'web') {
      router.replace(target as never);
      return;
    }
    if (typeof window === 'undefined') return;

    const isAndroid = /android/i.test(window.navigator.userAgent);
    if (!isAndroid) {
      // Desktop and iOS have no app to open — the website is the app.
      router.replace(target as never);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setStalled(true);
      window.location.href = PLAY_STORE_URL;
    }, APP_OPEN_GRACE_MS);

    // The app opened and backgrounded this tab — don't yank them to the store.
    const onVisibility = () => {
      if (document.hidden) {
        cancelled = true;
        clearTimeout(timer);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    window.location.href = deepLink(target);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [target, router]);

  const go = (url: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.href = url;
  };

  return (
    <View className="flex-1 items-center justify-center bg-bg px-6">
      <Container narrow>
        <View className="items-center">
          <BrandMark size={56} />
          <Text className="mt-4 font-display-x text-[22px] text-ink">Opening Aangan…</Text>
          <Text className="font-sans mt-1 text-center text-[13px] leading-[19px] text-muted">
            {stalled
              ? "Taking you to the Play Store to install Aangan."
              : "If nothing happens in a moment, pick an option below."}
          </Text>

          <View className="mt-6 w-full gap-2">
            <Pressable
              onPress={() => go(PLAY_STORE_URL)}
              className="flex-row items-center justify-center gap-2 rounded-2xl px-5 py-3 active:opacity-85"
              style={{ backgroundColor: c.accent }}
            >
              <Ionicons name="logo-google-playstore" size={17} color={c.onAccent} />
              <Text className="font-sans-sb text-[14px]" style={{ color: c.onAccent }}>
                Get Aangan on Play Store
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.replace(target as never)}
              className="flex-row items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-5 py-3 active:opacity-70"
            >
              <Ionicons name="globe-outline" size={17} color={c.muted} />
              <Text className="font-sans-sb text-[14px] text-muted">Continue in browser</Text>
            </Pressable>
          </View>

          <Text className="font-sans mt-5 text-center text-[12px] text-faint">
            Aangan is private to your society — you'll need your registered phone number to sign in.
          </Text>
        </View>
      </Container>
    </View>
  );
}
