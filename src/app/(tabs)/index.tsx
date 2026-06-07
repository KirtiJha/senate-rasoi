import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Container, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { SERVICES, ServiceCategory } from '../../lib/services';
import { useThemeColors } from '../../theme';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { profile } = useAuth();
  const c = useThemeColors();

  const greeting = getGreeting();

  const handleCategoryPress = (cat: ServiceCategory) => {
    if (cat.key === 'food') {
      router.push('/food');
    } else {
      router.push(`/c/${cat.key}` as any);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingTop: isDesktop ? insets.top + 24 : 24, paddingBottom: 40, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <Container>
        {/* Header */}
        <View className="mb-7">
          <Text className="text-[13px] font-sans-md text-accent">{greeting}</Text>
          <Text className="font-display-x text-[28px] leading-9 text-ink">
            {profile?.name ? `Welcome, ${profile.name.split(' ')[0]}` : 'Your neighbourhood hub'}
          </Text>
          <Text className="mt-1 text-[14px] font-sans-md text-muted">
            What can your society help you with today?
          </Text>
        </View>

        {/* Service grid */}
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
          {SERVICES.map((cat) => (
            <ServiceTile key={cat.key} cat={cat} onPress={() => handleCategoryPress(cat)} />
          ))}
        </View>
      </Container>
    </ScrollView>
  );
}

function ServiceTile({ cat, onPress }: { cat: ServiceCategory; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <View style={{ width: '50%', padding: 6 }}>
      <Pressable
        onPress={onPress}
        className="overflow-hidden rounded-2xl bg-surface active:opacity-80"
        style={{ borderWidth: 1, borderColor: c.line }}
      >
        {/* Colour accent strip */}
        <View style={{ height: 4, backgroundColor: cat.color }} />

        <View className="p-4">
          {/* Icon bubble */}
          <View
            className="mb-3 h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: cat.color + '20' }}
          >
            <Ionicons name={cat.icon as any} size={22} color={cat.color} />
          </View>

          <Text className="font-sans-bold text-[15px] text-ink" numberOfLines={1}>
            {cat.label}
          </Text>
          <Text className="mt-0.5 text-[12px] font-sans-md leading-[18px] text-muted" numberOfLines={2}>
            {cat.blurb}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning ☀️';
  if (h >= 12 && h < 17) return 'Good afternoon 🍛';
  if (h >= 17 && h < 21) return 'Good evening 🌙';
  return 'Good night 🌃';
}
