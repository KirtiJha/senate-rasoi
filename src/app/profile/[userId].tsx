import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Container, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { getProfile } from '../../lib/auth';
import { getOrCreateThread } from '../../lib/dm';
import { fetchMyListings } from '../../lib/listings';
import { getService } from '../../lib/services';
import { DbProfile, ListingRow } from '../../lib/types';
import { useThemeColors } from '../../theme';

export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { userId: meId } = useAuth();

  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const startChat = useCallback(async () => {
    if (!userId || starting) return;
    setStarting(true);
    try {
      const threadId = await getOrCreateThread(userId);
      router.push(`/messages/${threadId}` as any);
    } catch { toast.show('Could not start chat'); }
    finally { setStarting(false); }
  }, [userId, starting, router, toast]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [p, l] = await Promise.all([
        getProfile(userId),
        fetchMyListings(userId),
      ]);
      setProfile(p);
      setListings(l.filter((x: ListingRow) => x.status === 'active'));
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Loading…</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Profile not found.</Text>
      </View>
    );
  }

  const displayName = profile.name ?? 'Neighbour';

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
        <View className="flex-row items-center gap-2">
          {!isDesktop ? (
            <Pressable onPress={() => router.back()} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
              <Ionicons name="chevron-back" size={22} color={c.ink} />
            </Pressable>
          ) : null}
          <Text className="font-display-x text-[20px] text-ink flex-1">{displayName}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* Profile card */}
          <View className="mx-4 mt-5 items-center rounded-3xl border border-line bg-surface px-6 py-6">
            <Avatar name={displayName} size={72} />
            <Text className="mt-3 font-display-x text-[22px] text-ink">{displayName}</Text>
            {profile.flat ? (
              <Text className="mt-0.5 text-[13px] text-muted">Flat {profile.flat}</Text>
            ) : null}
            {profile.resident_type || profile.profession ? (
              <Text className="mt-0.5 text-[13px] text-muted">
                {profile.resident_type ? (profile.resident_type === 'owner' ? 'Owner' : 'Tenant') : ''}
                {profile.resident_type && profile.profession ? ' · ' : ''}
                {profile.profession ?? ''}
              </Text>
            ) : null}
            {/* Role chip */}
            <View className="mt-3 flex-row flex-wrap justify-center gap-1.5">
              <View className="rounded-full border border-line bg-inset px-3 py-1">
                <Text className="text-[11px] font-sans-sb text-muted">
                  {(profile.roles ?? []).includes('admin') ? 'Admin' : 'Member'}
                </Text>
              </View>
            </View>

            {/* Message this neighbour (not shown on your own profile) */}
            {meId && meId !== userId ? (
              <View className="mt-4 w-full">
                <Button
                  label={starting ? 'Opening…' : 'Message'}
                  icon="chatbubble-outline"
                  fullWidth
                  disabled={starting}
                  onPress={startChat}
                />
              </View>
            ) : null}
          </View>

          {/* Active listings */}
          {listings.length > 0 ? (
            <View className="mx-4 mt-5">
              <Text className="mb-3 font-sans-sb text-[13px] uppercase tracking-wider text-muted">
                Active Listings ({listings.length})
              </Text>
              <View className="gap-3">
                {listings.map((l: ListingRow) => {
                  const cat = getService(l.category);
                  return (
                    <Pressable
                      key={l.id}
                      onPress={() => router.push(`/listing/${l.id}` as any)}
                      className="overflow-hidden rounded-2xl border border-line bg-surface active:opacity-80"
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
                          <View className="mt-0.5 flex-row items-center gap-2">
                            <Text className="text-[11px] text-muted">{cat?.label ?? l.category}</Text>
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
              </View>
            </View>
          ) : (
            <View className="mt-10 items-center px-6">
              <Ionicons name="list-outline" size={36} color={c.faint} />
              <Text className="mt-2 text-[14px] text-muted">No active listings</Text>
            </View>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}
