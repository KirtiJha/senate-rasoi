import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Empty } from './Empty';
import { useAuth } from '../context/auth';
import { fetchSavedListings } from '../lib/saved';
import { getService } from '../lib/services';
import { ListingRow } from '../lib/types';
import { useThemeColors } from '../theme';
import { Container, RowSkeleton, Touchable } from './ui';

export function SavedSection() {
  const { userId } = useAuth();
  const router = useRouter();
  const c = useThemeColors();
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      setListings(await fetchSavedListings(userId));
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Container>
          <View className="overflow-hidden card"><RowSkeleton count={5} /></View>
        </Container>
      </ScrollView>
    );
  }

  if (listings.length === 0) {
    return (
      <Empty icon="bookmark-outline" title="Nothing saved yet">
        Tap the bookmark on any listing to keep it here for later.
      </Empty>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <Container>
        {listings.map((l: ListingRow) => {
          const cat = getService(l.category);
          return (
            <Touchable
              key={l.id}
              haptic={null}
              onPress={() => router.push(`/listing/${l.id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={l.title}
              style={{ marginBottom: 10 }}
            >
              <View className="flex-row items-center gap-3 card px-3.5 py-3">
                <View
                  style={{
                    width: 40, height: 40, borderRadius: 14,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: c.accentSoft,
                  }}
                >
                  <Ionicons name={(cat?.icon as any) ?? 'grid-outline'} size={19} color={c.accent} />
                </View>

                <View className="flex-1" style={{ minWidth: 0 }}>
                  <Text className="font-sans-sb text-[15px] text-ink" numberOfLines={1}>{l.title}</Text>
                  <View className="mt-0.5 flex-row items-center" style={{ flexWrap: 'wrap' }}>
                    <Text className="text-[12px] font-sans-md text-subtle">{cat?.label ?? l.category}</Text>
                    {l.price != null ? (
                      <Text className="text-[12px] font-sans-sb text-ink">
                        {'  ·  ₹' + l.price.toLocaleString('en-IN')}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={16} color={c.subtle} />
              </View>
            </Touchable>
          );
        })}
      </Container>
    </ScrollView>
  );
}
