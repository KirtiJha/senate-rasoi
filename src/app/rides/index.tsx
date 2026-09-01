import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

import { useAuth } from '../../context/auth';
import {
  PREFERENCE_LABELS,
  Ride,
  RideRequest,
  RideStanding,
  fetchMyRideRequests,
  fetchMyStanding,
  fetchRides,
  formatRideDate,
  formatRideTime,
  standingEnded,
  upcomingDates,
} from '../../lib/rides';
import { useThemeColors } from '../../theme';
import { Badge, Container, ScreenHeader, Touchable } from '../../components/ui';

/**
 * Rides.
 *
 * Carpooling used to be a classified ad: "Join ride" wrote an inquiry, which
 * is a message with no state, so a neighbour who asked saw "Sent" forever and
 * the driver had no way to say yes. Seats were a number nobody counted, and
 * "Daily" was a word rather than a set of journeys.
 *
 * The order here follows what a resident opens the screen to find out, which
 * is almost never "what rides exist": it is "am I in for tomorrow?". So their
 * own requests, with status, come first — then the rides they drive, then
 * everything on offer.
 */
export default function RidesScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const { userId, communityId } = useAuth();

  const [rides, setRides] = useState<Ride[] | null>(null);
  const [mine, setMine] = useState<RideRequest[]>([]);
  const [standing, setStanding] = useState<RideStanding[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [all, reqs, stand] = await Promise.all([
        fetchRides(communityId ?? undefined),
        userId ? fetchMyRideRequests(userId) : Promise.resolve([]),
        userId ? fetchMyStanding(userId) : Promise.resolve([]),
      ]);
      setRides(all);
      setMine(reqs.filter((r) => r.status !== 'cancelled'));
      // An arrangement past its last day is history, not a live seat.
      setStanding(stand.filter((x) => !standingEnded(x)));
    } catch {
      setRides([]);
    }
  }, [communityId, userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const iDrive = (rides ?? []).filter((r) => r.driver_user_id === userId);
  const others = (rides ?? []).filter((r) => r.driver_user_id !== userId);

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="car-outline"
        title="Carpool"
        showBack
        onAdd={() => router.push('/rides/new' as never)}
        addLabel="Offer a ride"
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 44 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Container narrow>
          {rides === null ? (
            <View className="items-center py-12"><ActivityIndicator color={c.accent} /></View>
          ) : (
            <>
              {/* ── What you asked for ───────────────────────────── */}
              {mine.length || standing.length ? (
                <View className="mb-5">
                  <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
                    Your seats
                  </Text>
                  {standing.map((r) => (
                    <Touchable key={r.id} onPress={() => router.push(`/rides/${r.ride_id}` as never)}
                      accessibilityRole="button" accessibilityLabel="Your regular seat">
                      <View pointerEvents="none" className="mb-2 card p-3.5">
                        <View className="flex-row items-center gap-2">
                          <View style={{ flex: 1 }}>
                            <Text className="font-sans-sb text-[14.5px] text-ink" numberOfLines={1}>
                              {r.ride?.from_text} → {r.ride?.to_text}
                            </Text>
                            <Text className="font-sans mt-0.5 text-[12.5px]" style={{ color: c.subtle }}>
                              Every week · {formatRideTime(r.ride?.depart_time)}
                              {r.seats > 1 ? ` · ${r.seats} seats` : ''}
                              {r.ends_on ? ` · until ${formatRideDate(r.ends_on)}` : ''}
                            </Text>
                          </View>
                          <Badge
                            label={r.status === 'accepted' ? 'Regular' : 'Pending'}
                            tone={r.status === 'accepted' ? 'success' : 'neutral'}
                          />
                        </View>
                      </View>
                    </Touchable>
                  ))}
                  {mine.map((r) => (
                    <Touchable key={r.id} onPress={() => router.push(`/rides/${r.ride_id}` as never)}
                      accessibilityRole="button" accessibilityLabel={`Your request for ${formatRideDate(r.ride_date)}`}>
                      <View pointerEvents="none" className="mb-2 card p-3.5">
                        <View className="flex-row items-center gap-2">
                          <View style={{ flex: 1 }}>
                            <Text className="font-sans-sb text-[14.5px] text-ink" numberOfLines={1}>
                              {r.ride?.from_text} → {r.ride?.to_text}
                            </Text>
                            <Text className="font-sans mt-0.5 text-[12.5px]" style={{ color: c.subtle }}>
                              {formatRideDate(r.ride_date)} · {formatRideTime(r.ride?.depart_time)}
                              {r.seats > 1 ? ` · ${r.seats} seats` : ''}
                            </Text>
                          </View>
                          <StatusPill status={r.status} />
                        </View>
                      </View>
                    </Touchable>
                  ))}
                </View>
              ) : null}

              {/* ── Rides you drive ──────────────────────────────── */}
              {iDrive.length ? (
                <View className="mb-5">
                  <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
                    You are driving
                  </Text>
                  {iDrive.map((r) => <RideCard key={r.id} ride={r} mine c={c}
                    onPress={() => router.push(`/rides/${r.id}` as never)} />)}
                </View>
              ) : null}

              {/* ── On offer ─────────────────────────────────────── */}
              <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
                Going your way
              </Text>
              {others.length === 0 ? (
                <View className="items-center px-6 py-10">
                  <Ionicons name="car-outline" size={30} color={c.faint} />
                  <Text className="font-sans-sb mt-3 text-[15px] text-ink">No rides yet</Text>
                  <Text className="font-sans mt-1 text-center text-[13px] leading-[19px]" style={{ color: c.subtle }}>
                    Driving somewhere regularly? Offer the empty seats — someone in the
                    building is almost certainly going the same way.
                  </Text>
                </View>
              ) : (
                others.map((r) => <RideCard key={r.id} ride={r} c={c}
                  onPress={() => router.push(`/rides/${r.id}` as never)} />)
              )}
            </>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function StatusPill({ status }: { status: RideRequest['status'] }) {
  const map = {
    pending: { label: 'Waiting for driver', tone: 'neutral' as const },
    accepted: { label: 'Confirmed', tone: 'success' as const },
    declined: { label: 'Declined', tone: 'neutral' as const },
    cancelled: { label: 'Withdrawn', tone: 'neutral' as const },
  };
  const m = map[status];
  return <Badge label={m.label} tone={m.tone} />;
}

function RideCard({
  ride, mine, c, onPress,
}: {
  ride: Ride;
  mine?: boolean;
  c: ReturnType<typeof useThemeColors>;
  onPress: () => void;
}) {
  const next = upcomingDates(ride)[0];

  return (
    <Touchable onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`${ride.from_text} to ${ride.to_text}`}>
      <View pointerEvents="none" className="mb-2 card p-4">
        <View className="flex-row items-start gap-2">
          <View style={{ flex: 1 }}>
            <Text className="font-display-sb text-[16px] text-ink" numberOfLines={1}>
              {ride.from_text} → {ride.to_text}
            </Text>
            <Text className="font-sans mt-0.5 text-[12.5px]" style={{ color: c.subtle }}>
              {formatRideTime(ride.depart_time)}
              {next ? ` · next ${formatRideDate(next)}` : ' · nothing scheduled'}
              {ride.duration_min ? ` · ~${ride.duration_min} min` : ''}
            </Text>
          </View>
          {ride.price_per_seat != null ? (
            <Text className="font-display text-[15px] text-ink">
              {ride.price_per_seat === 0 ? 'Free' : `₹${ride.price_per_seat}`}
            </Text>
          ) : null}
        </View>

        <View className="mt-2.5 flex-row flex-wrap items-center gap-x-2 gap-y-1">
          {!mine ? (
            <Text className="font-sans text-[12px]" style={{ color: c.subtle }}>
              {ride.driver?.name ?? 'A neighbour'}
              {ride.driver?.flat ? ` · ${ride.driver.flat}` : ''}
            </Text>
          ) : null}
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: c.inset }}>
            <Text className="text-[11px] font-sans-sb" style={{ color: c.muted }}>
              {ride.seats_total} seat{ride.seats_total === 1 ? '' : 's'}
            </Text>
          </View>
          {ride.preference !== 'all' ? (
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: c.accentSoft }}>
              <Text className="text-[11px] font-sans-sb" style={{ color: c.accent }}>
                {PREFERENCE_LABELS[ride.preference]}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Touchable>
  );
}
