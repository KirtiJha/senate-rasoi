import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dur, ease } from '../lib/motion';
import { useIsDark, useThemeColors } from '../theme';
import { DiversityEmblem, EmblemGloss } from './Brand';
import { Rise, Touchable } from './ui';

/**
 * The welcome a phone gets.
 *
 * WHY THIS EXISTS
 * `landing.tsx` is a web marketing page — six sections, a WhatsApp comparison
 * table, a feature grid, roughly two thousand pixels of scroll. Serving that to
 * someone who opened an app means the first screen answers a question they
 * didn't ask and hides the only two things they came for: get in, or sign in.
 *
 * So phones get this and wide screens keep the marketing page. The split is at
 * `isWide` (680px), which is also where that page's multi-column layouts start
 * making sense.
 *
 * THE SHAPE — one screenful that is complete on its own: what this is, who it
 * is for, and both ways in, all above the fold. Everything below is optional
 * reading for anyone who scrolls, not a toll gate before the buttons.
 *
 * The emblem leads because it is the most distinctive thing the product owns
 * and it was previously used once, in the footer. It blooms in on open and
 * turns slowly — alive rather than
 * as an animation being performed at you.
 */

/**
 * Seconds for one full turn of the emblem.
 *
 * Started at 90s, which was below the threshold where the eye reads movement:
 * you noticed it had changed, never that it was moving. 50s still reads as
 * ambient rather than as an animation demanding attention — and because the
 * flower is eight-fold symmetric, a petal reaches its neighbour's position
 * every ~6s, which is the beat you actually perceive.
 */
const TURN_MS = 50000;

/** Fixed width so cards size to their own content. See the carousel note. */
const CARD_W = 210;

/**
 * One line at a time, rotating. The marketing page lists six benefits at once,
 * which reads as a wall and gets skipped; a single line that changes gets read.
 */
const PITCH = [
  'Order home-cooked meals from the flat upstairs.',
  'Find a tuition, a tailor, a plumber — inside your gate.',
  'Ask anything. Aangan already knows your society.',
  'Polls, payments and the directory, all in one place.',
];

const INSIDE = [
  { icon: 'restaurant', title: 'Home food & tiffins', body: 'Daily dishes from verified home chefs. Reserve a plate, subscribe to a tiffin.' },
  { icon: 'pricetags', title: 'Marketplace', body: 'Buy, sell and find trusted help across 15 categories — tuitions to carpooling.' },
  { icon: 'sparkles', title: 'Ask Aangan', body: 'Your society’s own assistant. Ask in plain words, in your own language.' },
  { icon: 'people', title: 'Resident directory', body: 'Owners and tenants by flat, with one-tap call, WhatsApp or invite.' },
  { icon: 'stats-chart', title: 'Polls & notices', body: 'Decide together with live results, instead of forty “+1” messages.' },
  { icon: 'wallet', title: 'UPI payments', body: 'Pay neighbour to neighbour, with a ledger both sides confirm.' },
];

const TRUST = [
  { icon: 'shield-checkmark', title: 'Society-scoped', body: 'You only ever see your own society — never strangers.' },
  { icon: 'id-card', title: 'Real neighbours', body: 'Owner or tenant, flat, profession — a directory that is actually true.' },
  { icon: 'lock-closed', title: 'Yours alone', body: 'No ads, no selling data, and phone numbers you choose to show.' },
];

export function PhoneWelcome() {
  const router = useRouter();
  const c = useThemeColors();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();

  // The hero owns the first screenful exactly: enough that both CTAs are
  // reachable without scrolling, not so much that what follows is invisible.
  const heroHeight = Math.max(540, height - insets.top - 28);

  // ── The emblem, turning like an object rather than a picture ────────
  //
  // Three layers do the work. The petals carry their own shading, so it turns
  // with them (correct — that is the body of the thing). A perspective tilt
  // makes the disc lean in space instead of spinning flat, which is what
  // separates a turning object from a rotating sticker. And the highlight
  // above it does not move at all, so petals pass through the light one after
  // another the way a real surface does.
  const spin = useSharedValue(0);
  const tilt = useSharedValue(0);
  const sway = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    spin.set(withRepeat(withTiming(1, { duration: TURN_MS, easing: ease.linear }), -1, false));
    // Two loops at different, non-multiple periods, so the lean never repeats
    // on a beat the eye can catch and start predicting.
    tilt.set(withRepeat(withTiming(1, { duration: 7300, easing: ease.standard }), -1, true));
    sway.set(withRepeat(withTiming(1, { duration: 11000, easing: ease.standard }), -1, true));
  }, [reduced, spin, tilt, sway]);

  const emblemSpin = useAnimatedStyle(() => ({
    transform: [
      // Perspective must come first in the array or the rotations are flat.
      { perspective: 900 },
      { rotateX: `${(-9 + tilt.get() * 18).toFixed(2)}deg` },
      { rotateY: `${(-11 + sway.get() * 22).toFixed(2)}deg` },
      { rotate: `${(spin.get() * 360).toFixed(2)}deg` },
    ],
  }));

  // The ground shadow tracks the lean: it slides the opposite way and tightens
  // as the disc turns edge-on, which is what tells you it is above a surface.
  const shadowStyle = useAnimatedStyle(() => {
    const lean = sway.get() * 2 - 1;
    return {
      opacity: 0.16 - Math.abs(lean) * 0.05,
      transform: [{ translateX: -lean * 14 }, { scaleX: 1 - Math.abs(lean) * 0.18 }],
    };
  });

  const [pitch, setPitch] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setPitch((i) => (i + 1) % PITCH.length), 3400);
    return () => clearInterval(id);
  }, [reduced]);

  const fade = useSharedValue(1);
  useEffect(() => {
    fade.set(0);
    fade.set(withTiming(1, { duration: dur.standard, easing: ease.standard }));
  }, [pitch, fade]);
  const pitchStyle = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [{ translateY: (1 - fade.get()) * 8 }],
  }));

  const ground: [string, string, string] = isDark
    ? ['#0C1F18', '#08150F', '#0D2A20']
    : ['#EDF7F3', '#DCF0E8', '#F4FAF7'];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <LinearGradient colors={ground} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}>
          <View
            style={{
              height: heroHeight,
              paddingTop: insets.top + 12,
              paddingBottom: 20,
              paddingHorizontal: 24,
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Rise index={0}>
                <View style={{ alignItems: 'center' }}>
                  <Animated.View style={emblemSpin}>
                    <DiversityEmblem size={128} />
                  </Animated.View>
                  {/* Still while the emblem turns underneath. */}
                  <View pointerEvents="none" style={{ position: 'absolute', top: 0 }}>
                    <EmblemGloss size={128} />
                  </View>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      shadowStyle,
                      {
                        position: 'absolute',
                        bottom: -16,
                        width: 96,
                        height: 13,
                        borderRadius: 999,
                        backgroundColor: '#000',
                      },
                    ]}
                  />
                </View>
              </Rise>

              <Rise index={1} style={{ marginTop: 20, alignItems: 'center' }}>
                <Text className="font-display-x text-center" style={{ fontSize: 40, lineHeight: 44, color: c.ink }}>
                  Aangan
                </Text>
                <Text
                  className="font-sans-sb mt-1.5 text-center"
                  style={{ fontSize: 11, letterSpacing: 2.6, color: c.accent }}
                >
                  आँगन · YOUR COURTYARD
                </Text>
              </Rise>

              <Rise index={2} style={{ marginTop: 24, alignItems: 'center' }}>
                <Text
                  className="font-display text-center"
                  style={{ fontSize: 23, lineHeight: 31, color: c.ink, maxWidth: 330 }}
                >
                  Everything neighbours do for each other, in one private app.
                </Text>
              </Rise>

              {/* Fixed height so the buttons below never shift as the line
                  changes length. */}
              <View style={{ height: 46, marginTop: 12, justifyContent: 'center' }}>
                <Animated.View style={pitchStyle}>
                  <Text
                    className="font-sans-md text-center"
                    style={{ fontSize: 14.5, lineHeight: 21, color: c.subtle, maxWidth: 320 }}
                  >
                    {PITCH[pitch]}
                  </Text>
                </Animated.View>
              </View>
            </View>

            <Rise index={3}>
              <Touchable
                onPress={() => router.push('/onboard' as any)}
                accessibilityRole="button"
                accessibilityLabel="Find your society"
              >
                <View
                  pointerEvents="none"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: c.accent,
                    borderRadius: 18,
                    paddingVertical: 17,
                  }}
                >
                  <Text className="font-sans-bold" style={{ fontSize: 16, color: c.onAccent }}>
                    Find your society
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={c.onAccent} />
                </View>
              </Touchable>

              <View style={{ height: 10 }} />

              <Touchable
                onPress={() => router.push('/sign-in' as any)}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
              >
                <View
                  pointerEvents="none"
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 18,
                    paddingVertical: 15,
                    borderWidth: 1,
                    borderColor: c.accentLine,
                    backgroundColor: c.accentSoft,
                  }}
                >
                  <Text className="font-sans-sb" style={{ fontSize: 15, color: c.accent }}>
                    I already have an account
                  </Text>
                </View>
              </Touchable>

              <Text className="font-sans mt-3.5 text-center" style={{ fontSize: 11.5, color: c.subtle }}>
                Phone + PIN. No SMS, no OTP, no ads.
              </Text>
            </Rise>
          </View>
        </LinearGradient>

        {/* ── What's inside ────────────────────────────────────────
            A snap carousel, not a wrapped grid. The grid gave every card
            `h-full`, so each stretched to the tallest in its row and a
            two-line card sat in a box built for five. Fixed-width cards in a
            row size to their own content, and nothing stretches. */}
        <View style={{ paddingTop: 34 }}>
          <View style={{ paddingHorizontal: 24 }}>
            <Text
              className="font-sans-sb"
              style={{ fontSize: 11, letterSpacing: 1.6, color: c.accent }}
            >
              WHAT&apos;S INSIDE
            </Text>
            <Text className="font-display-x mt-1.5" style={{ fontSize: 25, lineHeight: 31, color: c.ink }}>
              A society that runs itself
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={CARD_W + 12}
            snapToAlignment="start"
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 18, gap: 12 }}
          >
            {INSIDE.map((f) => (
              <View
                key={f.title}
                style={{
                  width: CARD_W,
                  borderRadius: 20,
                  padding: 16,
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.line,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 13,
                    marginBottom: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: c.accentSoft,
                  }}
                >
                  <Ionicons name={f.icon as never} size={20} color={c.accent} />
                </View>
                <Text className="font-sans-bold" style={{ fontSize: 15, color: c.ink }}>{f.title}</Text>
                <Text className="font-sans-md mt-1" style={{ fontSize: 12.5, lineHeight: 18, color: c.subtle }}>
                  {f.body}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ── Why it's safe ────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 34 }}>
          <Text className="font-sans-sb" style={{ fontSize: 11, letterSpacing: 1.6, color: c.accent }}>
            BUILT ON TRUST
          </Text>
          <Text className="font-display-x mt-1.5" style={{ fontSize: 25, lineHeight: 31, color: c.ink }}>
            Neighbours, not strangers
          </Text>
          <View style={{ marginTop: 16, gap: 10 }}>
            {TRUST.map((t) => (
              <View
                key={t.title}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  borderRadius: 18,
                  padding: 15,
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.line,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: c.accentSoft,
                  }}
                >
                  <Ionicons name={t.icon as never} size={17} color={c.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text className="font-sans-bold" style={{ fontSize: 14, color: c.ink }}>{t.title}</Text>
                  <Text className="font-sans-md mt-0.5" style={{ fontSize: 12.5, lineHeight: 18, color: c.subtle }}>
                    {t.body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Closing ──────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 34 }}>
          <View style={{ borderRadius: 26, overflow: 'hidden' }}>
            <LinearGradient colors={['#15936F', '#0A4F3A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={{ alignItems: 'center', paddingHorizontal: 22, paddingVertical: 34 }}>
                <DiversityEmblem size={54} />
                <Text className="font-display-x mt-4 text-center" style={{ fontSize: 23, lineHeight: 30, color: '#fff' }}>
                  Your society, finally in one place
                </Text>
                <Text
                  className="font-sans-md mt-2 text-center"
                  style={{ fontSize: 13.5, lineHeight: 20, color: 'rgba(255,255,255,0.88)' }}
                >
                  Free for residents. Set up in a couple of minutes.
                </Text>
                <View style={{ height: 18 }} />
                <Touchable
                  onPress={() => router.push('/onboard' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Get started"
                >
                  <View
                    pointerEvents="none"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: '#fff',
                      borderRadius: 16,
                      paddingHorizontal: 26,
                      paddingVertical: 14,
                    }}
                  >
                    <Text className="font-sans-bold" style={{ fontSize: 15.5, color: '#0F6E56' }}>Get started</Text>
                    <Ionicons name="arrow-forward" size={17} color="#0F6E56" />
                  </View>
                </Touchable>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* ── Footer ───────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 26, paddingBottom: insets.bottom + 28 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
            <Text onPress={() => router.push('/legal' as any)} className="font-sans-sb" style={{ fontSize: 12.5, color: c.subtle }}>
              Terms
            </Text>
            <Text
              onPress={() => router.push('/legal?tab=privacy' as any)}
              className="font-sans-sb"
              style={{ fontSize: 12.5, color: c.subtle }}
            >
              Privacy
            </Text>
            <Text onPress={() => router.push('/about' as any)} className="font-sans-sb" style={{ fontSize: 12.5, color: c.accent }}>
              About
            </Text>
          </View>
          <Text className="font-sans mt-3.5 text-center" style={{ fontSize: 11, lineHeight: 16, color: c.subtle }}>
            Payments happen directly between neighbours over UPI. Aangan never holds your money.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
