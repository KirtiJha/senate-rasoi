import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MyListingsSection } from '../../components/MyListingsSection';
import { SavedSection } from '../../components/SavedSection';
import { Avatar, Container, Touchable, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useThemeColors } from '../../theme';

type Tab = 'listings' | 'saved';

/**
 * Your corner of the society.
 *
 * WHAT CHANGED
 * The screen opened with a "You" header directly beneath a tab bar whose
 * selected item already said You — a title that told the reader something they
 * had just tapped. It is gone, and the profile takes its place: on a screen
 * about you, your name IS the header.
 *
 * The role also said itself twice: an "Admin" badge under the name, and then a
 * row reading "Admin · manage members & roles". One is a label and the other
 * is a door; only the door earns its space, so the badge goes and the row
 * keeps the meaning.
 */
export default function YouScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const { isDesktop } = useResponsive();
  const { profile, isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('listings');

  return (
    <View className="flex-1 bg-bg">
      <View style={{ paddingHorizontal: 20, paddingTop: isDesktop ? 24 : 12, paddingBottom: 4 }}>
        <Container>
          {/* Identity. Tapping the block opens the profile editor — the whole
              row is the target, not just the avatar, which was a 46px hit area
              for the most-used destination on the screen. */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Touchable
              haptic={null}
              onPress={() => router.push('/profile/me' as any)}
              accessibilityRole="button"
              accessibilityLabel="Edit your profile"
              style={{ flex: 1 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Avatar name={profile?.name ?? 'You'} size={52} />
                <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                  <Text className="font-display-x text-[24px] leading-[29px] text-ink" numberOfLines={1}>
                    {profile?.name ?? 'You'}
                  </Text>
                  <Text className="mt-0.5 text-[13px] font-sans-md text-subtle" numberOfLines={1}>
                    {[profile?.flat ? `Flat ${profile.flat}` : null, profile?.phone]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </View>
            </Touchable>

            <Touchable
              haptic={null}
              onPress={() => router.push('/settings' as any)}
              feel="icon"
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
              accessibilityLabel="Admin — manage members and roles"
              style={{ marginTop: 14 }}
            >
              <View className="flex-row items-center gap-3 card px-4 py-3">
                <View
                  style={{
                    width: 34, height: 34, borderRadius: 12,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: c.accentSoft,
                  }}
                >
                  <Ionicons name="shield-checkmark-outline" size={17} color={c.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text className="font-sans-sb text-[14px] text-ink">Admin</Text>
                  <Text className="mt-0.5 text-[12px] text-subtle" numberOfLines={1}>
                    Members, roles and reports
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={c.subtle} />
              </View>
            </Touchable>
          ) : null}

          {/* An underline rather than a pill-in-a-trough. The trough version
              drew two boxes and a background for what is really one choice
              between two words. */}
          <View style={{ flexDirection: 'row', marginTop: 18, borderBottomWidth: 1, borderBottomColor: c.line }}>
            <Segment label="My listings" active={tab === 'listings'} onPress={() => setTab('listings')} c={c} />
            <Segment label="Saved" active={tab === 'saved'} onPress={() => setTab('saved')} c={c} />
          </View>
        </Container>
      </View>

      {tab === 'saved' ? <SavedSection /> : <MyListingsSection />}
    </View>
  );
}

function Segment({
  label, active, onPress, c,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={{ flex: 1, alignItems: 'center', paddingVertical: 11 }}
    >
      <Text
        className="text-[14px]"
        style={{
          color: active ? c.ink : c.muted,
          fontFamily: active ? 'HankenGrotesk_600SemiBold' : 'HankenGrotesk_500Medium',
        }}
      >
        {label}
      </Text>
      <View
        style={{
          position: 'absolute', bottom: -1, left: '22%', right: '22%',
          height: 2, borderRadius: 1,
          backgroundColor: active ? c.accent : 'transparent',
        }}
      />
    </Pressable>
  );
}
