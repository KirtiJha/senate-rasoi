import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../context/auth';
import { fetchSavedListings } from '../lib/saved';
import { getService } from '../lib/services';
import { ListingRow } from '../lib/types';
import { useThemeColors } from '../theme';
import { Container } from './ui';

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
      <View className="flex-1 items-center justify-center">
        <Text className="text-muted">Loading…</Text>
      </View>
    );
  }

  if (listings.length === 0) {
    return (
      <View className="flex-1 items-center px-6 py-16">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-inset">
          <Ionicons name="bookmark-outline" size={32} color={c.faint} />
        </View>
        <Text className="mb-1.5 font-display text-xl text-ink">No saved listings</Text>
        <Text className="max-w-xs text-center text-[14px] leading-6 text-muted">
          Tap the bookmark icon on any listing to save it here for later.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Container>
        {listings.map((l: ListingRow) => {
          const cat = getService(l.category);
          return (
            <Pressable
              key={l.id}
              onPress={() => router.push(`/listing/${l.id}` as any)}
              className="mb-3 overflow-hidden rounded-2xl border border-line bg-surface active:opacity-80"
            >
              {cat && <View style={{ height: 3, backgroundColor: cat.color }} />}
              <View className="flex-row items-center gap-3 p-3.5">
                <View
                  className="h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
                  style={{ backgroundColor: (cat?.color ?? '#888') + '20' }}
                >
                  <Ionicons name={(cat?.icon as any) ?? 'grid-outline'} size={20} color={cat?.color ?? c.muted} />
                </View>
                <View className="flex-1">
                  <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{l.title}</Text>
                  <View className="mt-0.5 flex-row items-center gap-2 flex-wrap">
                    <Text className="text-[11px] font-sans-md text-muted">{cat?.label ?? l.category}</Text>
                    {l.price != null && (
                      <Text className="text-[11px] font-sans-sb text-accent">₹{l.price.toLocaleString('en-IN')}</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.faint} />
              </View>
            </Pressable>
          );
        })}
      </Container>
    </ScrollView>
  );
}
