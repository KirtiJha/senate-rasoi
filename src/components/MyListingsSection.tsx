import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { haptics } from '../lib/haptics';
import { deleteListing, fetchMyListings, setListingStatus } from '../lib/listings';
import { getService } from '../lib/services';
import { ListingRow } from '../lib/types';
import { useThemeColors } from '../theme';
import { Avatar, Button, Container } from './ui';

export function MyListingsSection() {
  const { userId } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const c = useThemeColors();

  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setListings(await fetchMyListings(userId));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (l: ListingRow) => {
    const doDelete = async () => {
      await deleteListing(l.id);
      haptics.success();
      toast.show('Listing removed ✅');
      load();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${l.title}"?`)) doDelete();
    } else {
      Alert.alert('Remove', `Remove "${l.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleToggleSold = async (l: ListingRow) => {
    await setListingStatus(l.id, l.status === 'sold' ? 'active' : 'sold');
    haptics.tap();
    load();
  };

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
          <Text style={{ fontSize: 30 }}>📋</Text>
        </View>
        <Text className="mb-1.5 font-display text-xl text-ink">No listings yet</Text>
        <Text className="mb-5 max-w-xs text-center text-[14px] leading-6 text-muted">
          Post a service, product, or recommendation and your neighbours can find it here.
        </Text>
        <Button label="Post a listing" icon="add" onPress={() => router.push('/post')} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Container narrow>
        {listings.map((l) => {
          const cat = getService(l.category);
          return (
            <View
              key={l.id}
              className="mb-3 overflow-hidden rounded-2xl bg-surface"
              style={{ borderWidth: 1, borderColor: c.line }}
            >
              {cat && <View style={{ height: 3, backgroundColor: cat.color }} />}
              <View className="flex-row items-center gap-3 p-3.5">
                {/* Category icon */}
                <View
                  className="h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
                  style={{ backgroundColor: (cat?.color ?? '#888') + '20' }}
                >
                  <Ionicons name={(cat?.icon as any) ?? 'grid-outline'} size={20} color={cat?.color ?? c.muted} />
                </View>

                {/* Info */}
                <View className="flex-1">
                  <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{l.title}</Text>
                  <View className="mt-0.5 flex-row items-center gap-2 flex-wrap">
                    <Text className="text-[11px] font-sans-md text-muted">{cat?.label ?? l.category}</Text>
                    {l.price != null && (
                      <Text className="text-[11px] font-sans-sb text-accent">₹{l.price.toLocaleString('en-IN')}</Text>
                    )}
                    <View className={`rounded-full px-1.5 py-0.5 ${l.status === 'active' ? 'bg-[#E4F5EC]' : 'bg-inset'}`}>
                      <Text className={`text-[10px] font-sans-sb uppercase ${l.status === 'active' ? 'text-[#27AE60]' : 'text-muted'}`}>
                        {l.status}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Actions */}
                <View className="flex-row gap-1.5">
                  {l.category === 'market' && (
                    <View
                      className="items-center justify-center rounded-xl border border-line px-2.5 py-1.5"
                      onTouchEnd={() => handleToggleSold(l)}
                    >
                      <Text className="font-sans-sb text-[11px] text-muted">
                        {l.status === 'sold' ? 'Unsell' : 'Sold'}
                      </Text>
                    </View>
                  )}
                  <View
                    className="items-center justify-center rounded-xl bg-[#FEEAEA] px-2.5 py-1.5"
                    onTouchEnd={() => handleDelete(l)}
                  >
                    <Ionicons name="trash-outline" size={14} color="#E0322B" />
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </Container>
    </ScrollView>
  );
}
