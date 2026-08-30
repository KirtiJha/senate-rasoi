import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { MyListingsSection } from '../../components/MyListingsSection';
import { SavedSection } from '../../components/SavedSection';
import { Avatar, Container, Rise, Touchable, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { haptics } from '../../lib/haptics';
import { spring } from '../../lib/motion';
import { useThemeColors } from '../../theme';

type Tab = 'listings' | 'saved';

/**
 * Your corner of the society.
 *
 * THE SHAPE: who you are, then what you can do, then what you have.
 *
 * The settings gear used to float beside the avatar, which put a destination
 * inside an identity — you were looking at a picture of yourself with an
 * unrelated door attached to it. Settings is an action, so it sits with the
 * other actions in a row beneath, where "Edit profile", "Settings" and "Admin"
 * read as three doors of equal standing instead of one door and a decoration.
 *
 * That row also scales: the next account-level thing to add has an obvious
 * home, rather than becoming a second floating icon.
 */
export default function YouScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const { isDesktop } = useResponsive();
  const { profile, isAdmin } = useAuth();

  const [tab, setTab] = useState<Tab>('listings');
  const [tabWidth, setTabWidth] = useState(0);

  // The indicator slides rather than cuts, so the eye follows the selection
  // instead of re-finding it.
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
      <View style={{ paddingHorizontal: 20, paddingTop: isDesktop ? 24 : 16 }}>
        <Container>
          {/* ── Who you are ──────────────────────────────────────────
              Nothing tappable in here. An identity that is also a button
              makes you guess what tapping your own face does. */}
          <Rise index={0}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={profile?.name ?? 'You'} size={60} />
              <View style={{ flex: 1, minWidth: 0, marginLeft: 14 }}>
                <Text className="font-display-x text-[23px] leading-[28px] text-ink" numberOfLines={1}>
                  {profile?.name ?? 'You'}
                </Text>
                <Text className="mt-0.5 text-[13px] font-sans-md text-subtle" numberOfLines={1}>
                  {[profile?.flat ? `Flat ${profile.flat}` : null, profile?.phone]
                    .filter(Boolean)
                    .join(' · ') || 'Add your flat and number'}
                </Text>
              </View>
            </View>
          </Rise>

          {/* ── What you can do ──────────────────────────────────────
              Equal-weight doors, in the app's tile language. */}
          <Rise index={1} style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <ActionTile
                  icon="person-outline"
                  label="Edit profile"
                  onPress={() => router.push('/profile/me' as any)}
                  c={c}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ActionTile
                  icon="settings-outline"
                  label="Settings"
                  onPress={() => router.push('/settings' as any)}
                  c={c}
                />
              </View>
              {isAdmin ? (
                <View style={{ flex: 1 }}>
                  <ActionTile
                    icon="shield-checkmark-outline"
                    label="Admin"
                    onPress={() => router.push('/admin')}
                    c={c}
                  />
                </View>
              ) : null}
            </View>
          </Rise>

          {/* ── What you have ────────────────────────────────────── */}
          <Rise index={2} style={{ marginTop: 22 }}>
            <View onLayout={onTabsLayout}>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1 }}>
                  <TabButton label="My listings" active={tab === 'listings'} onPress={() => pick('listings')} c={c} />
                </View>
                <View style={{ flex: 1 }}>
                  <TabButton label="Saved" active={tab === 'saved'} onPress={() => pick('saved')} c={c} />
                </View>
              </View>
              <View style={{ height: 2, backgroundColor: c.line, borderRadius: 1 }}>
                <Animated.View
                  style={[indicator, { height: 2, borderRadius: 1, backgroundColor: c.accent }]}
                />
              </View>
            </View>
          </Rise>
        </Container>
      </View>

      <View style={{ flex: 1, marginTop: 8 }}>
        {tab === 'saved' ? <SavedSection /> : <MyListingsSection />}
      </View>
    </View>
  );
}

/**
 * One account action. Deliberately the same vocabulary as the Home tiles —
 * accent plate, glyph, label — because they are the same kind of thing: a
 * door with a name on it.
 */
function ActionTile({
  icon, label, onPress, c,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Touchable
      haptic={null}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View className="items-center card" style={{ paddingVertical: 14, paddingHorizontal: 8 }}>
        <View
          className="items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, backgroundColor: c.accentSoft }}
        >
          <Ionicons name={icon} size={18} color={c.accent} />
        </View>
        <Text className="mt-2 text-[12px] font-sans-sb text-ink" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Touchable>
  );
}

function TabButton({
  label, active, onPress, c,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Touchable
      haptic={null}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <View style={{ alignItems: 'center', paddingVertical: 11 }}>
        <Text
          className="text-[14px]"
          style={{
            color: active ? c.ink : c.muted,
            fontFamily: active ? 'HankenGrotesk_600SemiBold' : 'HankenGrotesk_500Medium',
          }}
        >
          {label}
        </Text>
      </View>
    </Touchable>
  );
}
