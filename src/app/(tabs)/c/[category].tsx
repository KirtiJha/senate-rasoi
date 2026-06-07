import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Container } from '../../../components/ui';
import { getService } from '../../../lib/services';
import { useThemeColors } from '../../../theme';

export default function CategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();

  const cat = getService(category ?? '');

  if (!cat) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Category not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingTop: 24, paddingBottom: 40, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <Container>
        {/* Back + header */}
        <Pressable
          onPress={() => router.back()}
          className="mb-5 flex-row items-center gap-1.5 self-start active:opacity-60"
        >
          <Ionicons name="chevron-back" size={18} color={c.muted} />
          <Text className="text-[14px] font-sans-md text-muted">Home</Text>
        </Pressable>

        {/* Hero block */}
        <View
          className="mb-8 items-center rounded-3xl py-10"
          style={{ backgroundColor: cat.color + '15' }}
        >
          <View
            className="mb-4 h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: cat.color + '25' }}
          >
            <Ionicons name={cat.icon as any} size={32} color={cat.color} />
          </View>
          <Text className="font-display-x text-[22px] text-ink">{cat.label}</Text>
          <Text className="mt-1 max-w-xs text-center text-[14px] font-sans-md text-muted">
            {cat.blurb}
          </Text>
        </View>

        {/* Coming soon card */}
        <View
          className="rounded-2xl bg-surface p-6"
          style={{ borderWidth: 1, borderColor: c.line }}
        >
          <View className="mb-3 flex-row items-center gap-2.5">
            <Ionicons name="construct-outline" size={20} color={c.muted} />
            <Text className="font-sans-bold text-[16px] text-ink">Coming soon</Text>
          </View>
          <Text className="text-[14px] font-sans-md leading-6 text-muted">
            We're building the {cat.label} board for your society. Neighbours will be able to post{' '}
            {cat.listingType === 'product' ? 'products' : cat.listingType === 'recommendation' ? 'recommendations' : 'services'}{' '}
            here and connect directly with each other.
          </Text>
          <View className="mt-4 rounded-xl bg-inset px-4 py-3">
            <Text className="text-[12px] font-sans-md text-faint">
              Phase 2 · Listings engine
            </Text>
          </View>
        </View>
      </Container>
    </ScrollView>
  );
}
