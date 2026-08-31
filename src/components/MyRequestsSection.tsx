import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { useAuth } from '../context/auth';
import { fetchMyInquiries } from '../lib/inquiries';
import { getService } from '../lib/services';
import { InquiryRow } from '../lib/types';
import { useThemeColors } from '../theme';
import { Container, Touchable } from './ui';

/**
 * Everything you have asked to join, buy or book.
 *
 * WHY IT DID NOT EXIST. `fetchMyInquiries` was written and never called from
 * anywhere. So asking to join a carpool wrote a row, notified nobody the app
 * could show, and vanished — the person who asked had no list, no receipt and
 * no way to tell whether the message had gone anywhere at all. Their own words
 * were sitting in a table they could not see.
 *
 * Sits beside "My listings" because those are the two halves of the same
 * question: what am I offering, and what have I asked for.
 */
export function MyRequestsSection() {
  const c = useThemeColors();
  const router = useRouter();
  const { userId } = useAuth();

  const [rows, setRows] = useState<InquiryRow[] | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setRows([]); return; }
    try { setRows(await fetchMyInquiries(userId)); } catch { setRows([]); }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (rows === null) {
    return (
      <View className="items-center py-12">
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View className="items-center px-8 py-12">
        <Ionicons name="paper-plane-outline" size={34} color={c.faint} />
        <Text className="font-sans-sb mt-3 text-[15px] text-ink">Nothing asked yet</Text>
        <Text className="font-sans mt-1 text-center text-[13px] leading-[19px]" style={{ color: c.subtle }}>
          When you ask to join a ride or enquire about a listing, it shows up here
          with whatever you wrote.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Container narrow>
        {rows.map((r) => {
          const l = r.listing;
          const cat = l ? getService(l.category) : undefined;
          const photo = l?.photos?.[0];
          const gone = !l || l.status === 'closed';

          return (
            <Touchable
              key={r.id}
              onPress={() => (l ? router.push(`/listing/${l.id}` as never) : undefined)}
              accessibilityRole="button"
              accessibilityLabel={l?.title ?? 'Request'}
            >
              <View pointerEvents="none" className="mb-2 card p-3.5" style={{ opacity: gone ? 0.6 : 1 }}>
                <View className="flex-row items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-xl"
                    style={{ backgroundColor: c.inset }}>
                    {photo ? (
                      <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                      <Ionicons name={(cat?.icon as never) ?? 'grid-outline'} size={20} color={c.accent} />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text className="font-sans-sb text-[14.5px] text-ink" numberOfLines={1}>
                      {l?.title ?? 'Listing removed'}
                    </Text>
                    <Text className="font-sans text-[12px]" style={{ color: c.faint }}>
                      {cat?.ctaLabel ? `${cat.ctaLabel} · ` : ''}
                      {l?.status === 'sold' ? 'Taken' : l?.status === 'closed' ? 'Closed' : 'Sent'}
                    </Text>
                  </View>
                </View>

                {/* The words they typed, which until now were stored and
                    unreadable by the person who typed them. */}
                {r.message ? (
                  <Text className="font-sans mt-2.5 text-[13px] leading-[19px]" style={{ color: c.subtle }}>
                    “{r.message}”
                  </Text>
                ) : null}
              </View>
            </Touchable>
          );
        })}
      </Container>
    </ScrollView>
  );
}
