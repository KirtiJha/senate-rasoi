import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Container, ScreenHeader, useResponsive } from '../components/ui';
import { useThemeColors } from '../theme';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function AboutScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="information-circle-outline" title="About" showBack />
      <ScrollView
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 60, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Container narrow>
        {/* App Identity */}
        <View className="mb-6 items-center py-6">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-3xl bg-accent">
            <Ionicons name="home" size={36} color={c.onAccent} />
          </View>
          <Text className="font-display-x text-[28px] text-ink">Aangan</Text>
          <Text className="mt-1 text-[14px] text-muted">Your neighbourhood community hub</Text>
          <View className="mt-3 rounded-full border border-line bg-surface px-4 py-1.5">
            <Text className="text-[12px] font-sans-md text-faint">Version {APP_VERSION}</Text>
          </View>
        </View>

        {/* About the app */}
        <View className="mb-5 rounded-3xl border border-line bg-surface p-5">
          <Text className="mb-3 font-sans-sb text-[13px] text-muted">ABOUT</Text>
          <Text className="text-[14px] leading-6 text-ink">
            Aangan brings your residential society together — order home food, discover local services, post on the community feed, and connect with your neighbours.
          </Text>
          <Text className="mt-3 text-[14px] leading-6 text-ink">
            Built for Indian housing societies, Aangan works across all society types — apartments, gated communities, and more.
          </Text>
        </View>

        {/* Features */}
        <View className="mb-5 rounded-3xl border border-line bg-surface p-5">
          <Text className="mb-3 font-sans-sb text-[13px] text-muted">FEATURES</Text>
          <View className="gap-3">
            {FEATURES.map((f) => (
              <View key={f.label} className="flex-row items-start gap-3">
                <View className="mt-0.5 h-7 w-7 items-center justify-center rounded-xl" style={{ backgroundColor: f.color + '20' }}>
                  <Ionicons name={f.icon as any} size={14} color={f.color} />
                </View>
                <View className="flex-1">
                  <Text className="font-sans-sb text-[13px] text-ink">{f.label}</Text>
                  <Text className="text-[12px] text-muted">{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Technical Info */}
        <View className="mb-5 rounded-3xl border border-line bg-surface p-5">
          <Text className="mb-3 font-sans-sb text-[13px] text-muted">TECHNICAL</Text>
          <View className="gap-2.5">
            <InfoRow label="Platform" value="React Native (Expo)" c={c} />
            <InfoRow label="Version" value={APP_VERSION} c={c} />
            <InfoRow label="Runtime" value={`Expo SDK ${Constants.expoConfig?.sdkVersion ?? '56'}`} c={c} />
            <InfoRow label="Backend" value="Supabase (PostgreSQL + Realtime)" c={c} />
          </View>
        </View>

        {/* Legal */}
        <View className="rounded-3xl border border-line bg-surface p-5">
          <Text className="mb-3 font-sans-sb text-[13px] text-muted">LEGAL</Text>
          <View className="gap-2">
            <LinkRow label="Privacy Policy" icon="shield-outline" c={c} onPress={() => {}} />
            <LinkRow label="Terms of Service" icon="document-text-outline" c={c} onPress={() => {}} />
          </View>
        </View>

        <Text className="mt-6 text-center text-[12px] text-faint">
          Made with ❤️ for Indian communities
        </Text>
        </Container>
      </ScrollView>
    </View>
  );
}

const FEATURES = [
  { icon: 'restaurant', color: '#F97316', label: 'Home Food & Tiffins', desc: 'Order from neighbour chefs daily' },
  { icon: 'construct-outline', color: '#3B82F6', label: 'Local Services', desc: 'Find plumbers, tutors, and more' },
  { icon: 'chatbubbles-outline', color: '#8B5CF6', label: 'Community Feed', desc: 'Post, discuss, and stay informed' },
  { icon: 'search-outline', color: '#10B981', label: 'Smart Search', desc: 'Find anything across all categories' },
  { icon: 'shield-checkmark-outline', color: '#EF4444', label: 'Society Access Control', desc: 'Private to your verified society' },
  { icon: 'notifications-outline', color: '#F59E0B', label: 'Realtime Updates', desc: 'Live feed with instant notifications' },
];

function InfoRow({ label, value, c }: { label: string; value: string; c: ReturnType<typeof useThemeColors> }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-[13px] text-muted">{label}</Text>
      <Text className="text-[13px] font-sans-md text-ink">{value}</Text>
    </View>
  );
}

function LinkRow({ label, icon, c, onPress }: { label: string; icon: string; c: ReturnType<typeof useThemeColors>; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-2.5 rounded-xl py-1.5 active:opacity-70">
      <Ionicons name={icon as any} size={16} color={c.muted} />
      <Text className="flex-1 text-[13px] text-ink">{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={c.faint} />
    </Pressable>
  );
}
