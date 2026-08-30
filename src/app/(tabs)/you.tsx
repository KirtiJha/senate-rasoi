import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';

import { MyListingsSection } from '../../components/MyListingsSection';
import { SavedSection } from '../../components/SavedSection';
import { Avatar, Container, Rise, Touchable, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { haptics } from '../../lib/haptics';
import { dur, ease, spring } from '../../lib/motion';
import { useThemeColors } from '../../theme';

type Tab = 'listings' | 'saved';

/**
 * Your corner of the society.
 *
 * The screen used to open with a "You" header beneath a tab bar whose selected
 * item already said You, then stack a name, a role badge, an admin row and a
 * segmented control — four separate blocks before any content. It is now one
 * identity card that answers who you are and what you can do, then the content
 * itself.
 */
export default function YouScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const { isDesktop } = useResponsive();
  const { profile, isAdmin } = useAuth();

  const [tab, setTab] = useState<Tab>('listings');
  const [counts, setCounts] = useState<{ listings?: number; saved?: number }>({});

  // The indicator slides between tabs rather than cutting, so the eye follows
  // the selection instead of re-finding it.
  const [tabWidth, setTabWidth] = useState(0);
  const slide = useSharedValue(0);

  useEffect(() => {
    slide.set(withSpring(tab === 'listings' ? 0 : 1, spring.card));
  }, [tab, slide]);

  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.get() * tabWidth }],
    width: tabWidth,
  }));

  const onTabsLayout = (e: LayoutChangeEvent) => setTabWidth(e.nativeEvent.layout.width / 2);

  const pick = (next: Tab) => {
    if (next === tab) return;
    haptics.select();
    setTab(next);
  };

  return (
    <View className="flex-1 bg-bg">
      <View style={{ paddingHorizontal: 20, paddingTop: isDesktop ? 24 : 12 }}>
        <Container>
          {/* ── Identity ─────────────────────────────────────────────
              One card instead of a name, a badge and an admin row stacked
              separately. Tapping it opens the profile editor; the gear is
              its own target so Settings does not need a second trip. */}
          <Rise index={0}>
            <View
              className="overflow-hidden card"
              style={{ padding: 16 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Touchable
                  haptic={null}
                  onPress={() => router.push('/profile/me' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit your profile"
                  style={{ flex: 1 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Avatar name={profile?.name ?? 'You'} size={56} />
                    <View style={{ flex: 1, minWidth: 0, marginLeft: 14 }}>
                      <Text
                        className="font-display-x text-[21px] leading-[26px] text-ink"
                        numberOfLines={1}
                      >
                        {profile?.name ?? 'You'}
                      </Text>
                      <Text className="mt-0.5 text-[13px] font-sans-md text-subtle" numberOfLines={1}>
                        {[profile?.flat ? `Flat ${profile.flat}` : null, profile?.phone]
                          .filter(Boolean)
                          .join(' · ') || 'Tap to complete your profile'}
                      </Text>
                    </View>
                  </View>
                </Touchable>

                <Touchable
                  haptic={null}
                  feel="icon"
                  onPress={() => router.push('/settings' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Settings"
                >
                  <View
                    style={{
                      width: 40, height: 40, borderRadius: 20,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: c.inset,
                    }}
                  >
                    <Ionicons name="settings-outline" size={19} color={c.muted} />
                  </View>
                </Touchable>
              </View>

              {isAdmin ? (
                <Touchable
                  haptic={null}
                  onPress={() => router.push('/admin')}
                  accessibilityRole="button"
                  accessibilityLabel="Admin — manage members, roles and reports"
                  style={{ marginTop: 14 }}
                >
                  <View
                    className="flex-row items-center gap-2.5 rounded-xl px-3 py-2.5"
                    style={{ backgroundColor: c.accentSoft }}
                  >
                    <Ionicons name="shield-checkmark" size={16} color={c.accent} />
                    <Text
                      className="flex-1 font-sans-sb text-[13px]"
                      style={{ color: c.accent }}
                      numberOfLines={1}
                    >
                      Admin · members, roles and reports
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={c.accent} />
                  </View>
                </Touchable>
              ) : null}
            </View>
          </Rise>

          {/* ── Tabs ─────────────────────────────────────────────────
              The counts turn two labels into an answer: whether there is
              anything in there at all. */}
          <Rise index={1} style={{ marginTop: 18 }}>
            <View onLayout={onTabsLayout}>
              <View style={{ flexDirection: 'row' }}>
                <TabButton
                  label="My listings"
                  count={counts.listings}
                  active={tab === 'listings'}
                  onPress={() => pick('listings')}
                  c={c}
                />
                <TabButton
                  label="Saved"
                  count={counts.saved}
                  active={tab === 'saved'}
                  onPress={() => pick('saved')}
                  c={c}
                />
              </View>

              <View style={{ height: 2, backgroundColor: c.line, borderRadius: 1 }}>
                <Animated.View
                  style={[
                    indicator,
                    { height: 2, borderRadius: 1, backgroundColor: c.accent },
                  ]}
                />
              </View>
            </View>
          </Rise>
        </Container>
      </View>

      <View style={{ flex: 1, marginTop: 8 }}>
        {tab === 'saved' ? (
          <SavedSection onCount={(n) => setCounts((p) => ({ ...p, saved: n }))} />
        ) : (
          <MyListingsSection onCount={(n) => setCounts((p) => ({ ...p, listings: n }))} />
        )}
      </View>
    </View>
  );
}

function TabButton({
  label, count, active, onPress, c,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  // The count fades in when it arrives rather than appearing mid-layout.
  const shown = useSharedValue(count == null ? 0 : 1);
  useEffect(() => {
    shown.set(withTiming(count == null ? 0 : 1, { duration: dur.standard, easing: ease.standard }));
  }, [count, shown]);
  const countStyle = useAnimatedStyle(() => ({ opacity: shown.get() }));

  return (
    <Touchable
      haptic={null}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={count == null ? label : `${label}, ${count}`}
      style={{ flex: 1 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 }}>
        <Text
          className="text-[14px]"
          style={{
            color: active ? c.ink : c.muted,
            fontFamily: active ? 'HankenGrotesk_600SemiBold' : 'HankenGrotesk_500Medium',
          }}
        >
          {label}
        </Text>
        <Animated.View style={countStyle}>
          <View
            className="rounded-full px-1.5"
            style={{ minWidth: 20, paddingVertical: 1, backgroundColor: active ? c.accentSoft : c.inset }}
          >
            <Text
              className="text-center font-sans-sb text-[11px]"
              style={{ color: active ? c.accent : c.subtle }}
            >
              {count ?? 0}
            </Text>
          </View>
        </Animated.View>
      </View>
    </Touchable>
  );
}
