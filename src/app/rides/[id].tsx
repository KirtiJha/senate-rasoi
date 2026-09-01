import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../context/auth';
import { useConfirm } from '../../context/confirm';
import { useToast } from '../../context/toast';
import { haptics } from '../../lib/haptics';
import {
  PREFERENCE_LABELS,
  Ride,
  RideRequest,
  answerRequest,
  deleteRide,
  fetchRide,
  fetchRideRequests,
  fetchMyRideRequests,
  formatRideDate,
  formatRideTime,
  RideStanding,
  StandingSkip,
  answerStanding,
  fetchMyStanding,
  fetchStanding,
  fetchStandingSkips,
  requestSeat,
  requestStanding,
  routeUrl,
  seatsTakenOn,
  setStandingSkip,
  todayIso,
  upcomingDates,
  withdrawRequest,
  withdrawStanding,
} from '../../lib/rides';
import { useThemeColors } from '../../theme';
import {
  Avatar, Badge, Button, Container, DateField, ErrorState, KeyboardAvoider, ScreenHeader, Stepper, Touchable,
} from '../../components/ui';

function openUrl(u: string) {
  if (Platform.OS === 'web') window.open(u, '_blank');
  else Linking.openURL(u);
}

/**
 * One ride, and the seats on it.
 *
 * A recurring ride has no rows for its individual journeys — a request carries
 * the date instead — so this screen is where "Tuesdays at 9" becomes a list of
 * actual Tuesdays you can ask for. Seats left are counted per journey, because
 * a car that is full on Monday is empty again on Tuesday.
 */
export default function RideDetailScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { userId, isAdmin } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [ride, setRide] = useState<Ride | null | 'missing'>(null);
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [myReqs, setMyReqs] = useState<RideRequest[]>([]);
  const [standing, setStanding] = useState<RideStanding[]>([]);
  const [myStanding, setMyStanding] = useState<RideStanding | null>(null);
  const [skips, setSkips] = useState<StandingSkip[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [seats, setSeats] = useState(1);
  const [note, setNote] = useState('');
  const [endsOn, setEndsOn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetchRide(id);
      if (!r) { setRide('missing'); return; }
      setRide(r);

      const isDriver = r.driver_user_id === userId;
      // A rider may only read their own requests; the driver reads all of them.
      const [all, mine, allStanding, myStand] = await Promise.all([
        isDriver ? fetchRideRequests(id) : Promise.resolve([]),
        userId ? fetchMyRideRequests(userId) : Promise.resolve([]),
        isDriver ? fetchStanding(id) : Promise.resolve([]),
        userId ? fetchMyStanding(userId) : Promise.resolve([]),
      ]);
      setRequests(all);
      setMyReqs(mine.filter((x) => x.ride_id === id));
      setStanding(allStanding);

      const own = myStand.find((x) => x.ride_id === id) ?? null;
      setMyStanding(own);

      // Seats-left has to know who is not coming, so the driver needs every
      // arrangement's skips; a rider only ever needs their own.
      const ids = isDriver ? allStanding.map((x) => x.id) : own ? [own.id] : [];
      setSkips(ids.length ? await fetchStandingSkips(ids) : []);

      setDate((d) => d ?? upcomingDates(r)[0] ?? null);
    } catch {
      setRide('missing');
    }
  }, [id, userId]);

  useEffect(() => { load(); }, [load]);

  if (ride === null) {
    return <View className="flex-1 items-center justify-center bg-bg"><ActivityIndicator color={c.accent} /></View>;
  }
  if (ride === 'missing') {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="car-outline" title="Carpool" showBack backHref="/rides" />
        <ErrorState message="This ride is no longer available." />
      </View>
    );
  }

  const isDriver = ride.driver_user_id === userId;
  const dates = upcomingDates(ride);
  const myForDate = myReqs.find((r) => r.ride_date === date && r.status !== 'cancelled');

  // The driver's own view already knows every request; a rider only ever sees
  // their own, so seats-left is shown to the driver and to nobody else.
  const takenForDate = date ? seatsTakenOn(date, requests, standing, skips) : 0;
  const left = ride.seats_total - takenForDate;

  const ask = async () => {
    if (!userId || !date || busy) return;
    setBusy(true);
    try {
      await requestSeat({ rideId: ride.id, riderUserId: userId, rideDate: date, seats, note });
      haptics.success();
      toast.show('Asked — the driver will confirm');
      setNote('');
      await load();
    } catch (e) {
      const m = String((e as { message?: string })?.message ?? '');
      toast.show(/seat/i.test(m) ? m : 'Could not ask — try again');
    } finally {
      setBusy(false);
    }
  };

  const answer = async (r: RideRequest, status: 'accepted' | 'declined') => {
    setBusy(true);
    try {
      await answerRequest(r.id, status);
      haptics.success();
      await load();
    } catch (e) {
      const m = String((e as { message?: string })?.message ?? '');
      toast.show(/seat/i.test(m) ? m : 'Could not update');
    } finally {
      setBusy(false);
    }
  };

  const askStanding = async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      await requestStanding({ rideId: ride.id, riderUserId: userId, seats, note, endsOn });
      haptics.success();
      toast.show('Asked — the driver will confirm your regular seat');
      setNote('');
      await load();
    } catch (e) {
      const m = String((e as { message?: string })?.message ?? '');
      toast.show(/seat|week/i.test(m) ? m : 'Could not ask — try again');
    } finally {
      setBusy(false);
    }
  };

  const answerStandingReq = async (r: RideStanding, status: 'accepted' | 'declined') => {
    setBusy(true);
    try {
      await answerStanding(r.id, status);
      haptics.success();
      await load();
    } catch (e) {
      const m = String((e as { message?: string })?.message ?? '');
      toast.show(/seat|week/i.test(m) ? m : 'Could not update');
    } finally {
      setBusy(false);
    }
  };

  const toggleSkip = async (d: string) => {
    if (!myStanding || busy) return;
    const on = skips.some((k) => k.standing_id === myStanding.id && k.skip_date === d);
    setBusy(true);
    haptics.select();
    try { await setStandingSkip(myStanding.id, d, !on); await load(); }
    catch { toast.show('Could not save that'); }
    finally { setBusy(false); }
  };

  const removeRide = async () => {
    const ok = await confirm({
      title: 'Remove this ride?',
      message: 'Everyone who has asked for a seat will lose their request.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    try { await deleteRide(ride.id); router.replace('/rides' as never); }
    catch { toast.show('Could not remove'); }
  };

  return (
    <KeyboardAvoider>
      <ScreenHeader
        icon="car-outline"
        title={`${ride.from_text} → ${ride.to_text}`}
        showBack
        backHref="/rides"
        right={isDriver || isAdmin ? (
          <Touchable onPress={removeRide} accessibilityRole="button" accessibilityLabel="Remove ride">
            <View pointerEvents="none" className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: c.inset }}>
              <Ionicons name="trash-outline" size={15} color={c.muted} />
            </View>
          </Touchable>
        ) : undefined}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* ── The journey ──────────────────────────────────────── */}
          <View className="card p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="time-outline" size={15} color={c.accent} />
              <Text className="font-sans-sb text-[15px] text-ink">
                {formatRideTime(ride.depart_time)}
                {ride.duration_min ? ` · about ${ride.duration_min} min` : ''}
              </Text>
            </View>

            <View className="mt-2 flex-row flex-wrap items-center gap-x-2 gap-y-1">
              <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.inset }}>
                <Text className="text-[11.5px] font-sans-sb" style={{ color: c.muted }}>
                  {ride.seats_total} seat{ride.seats_total === 1 ? '' : 's'}
                </Text>
              </View>
              {ride.price_per_seat != null ? (
                <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.inset }}>
                  <Text className="text-[11.5px] font-sans-sb" style={{ color: c.muted }}>
                    {ride.price_per_seat === 0 ? 'Free' : `₹${ride.price_per_seat} a seat`}
                  </Text>
                </View>
              ) : null}
              {ride.preference !== 'all' ? (
                <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.accentSoft }}>
                  <Text className="text-[11.5px] font-sans-sb" style={{ color: c.accent }}>
                    {PREFERENCE_LABELS[ride.preference]}
                  </Text>
                </View>
              ) : null}
              {ride.vehicle ? (
                <Text className="font-sans text-[12px]" style={{ color: c.subtle }}>{ride.vehicle}</Text>
              ) : null}
            </View>

            {ride.note ? (
              <Text className="font-sans mt-2.5 text-[13.5px] leading-[20px] text-ink">{ride.note}</Text>
            ) : null}

            <View className="mt-3 flex-row items-center gap-2.5 border-t border-line pt-3">
              <Avatar name={ride.driver?.name ?? '?'} size={30} />
              <Text className="flex-1 font-sans text-[13px]" style={{ color: c.subtle }}>
                {isDriver ? 'You are driving' : ride.driver?.name ?? 'A neighbour'}
                {!isDriver && ride.driver?.flat ? ` · ${ride.driver.flat}` : ''}
              </Text>
            </View>

            <View className="mt-3">
              <Button label="See the route" icon="navigate-outline" variant="outline" size="sm"
                onPress={() => openUrl(routeUrl(ride))} />
            </View>
          </View>

          {/* ── Which journey ────────────────────────────────────── */}
          {dates.length === 0 ? (
            <Text className="font-sans mt-4 text-center text-[13px]" style={{ color: c.faint }}>
              Nothing scheduled in the next fortnight.
            </Text>
          ) : (
            <View className="mt-5">
              <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
                {isDriver ? 'Journeys'
                  : myStanding?.status === 'accepted' ? 'Your days — tap one you are missing'
                    : 'Pick a day'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {dates.map((d) => {
                  const on = d === date;
                  const asked = myReqs.find((r) => r.ride_date === d && r.status !== 'cancelled');
                  // For a standing rider the day is already booked, so the only
                  // question is whether they are coming — tapping toggles the
                  // skip rather than selecting the day.
                  const regular = !isDriver && myStanding?.status === 'accepted'
                    && (!myStanding.ends_on || myStanding.ends_on >= d);
                  const away = !!regular && skips.some((k) => k.standing_id === myStanding?.id && k.skip_date === d);
                  const mark = away ? ' ✕' : regular ? ' ✓' : asked ? (asked.status === 'accepted' ? ' ✓' : ' ·') : '';
                  return (
                    <Touchable
                      key={d}
                      onPress={() => (regular ? toggleSkip(d) : setDate(d))}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={regular
                        ? `${away ? 'Take' : 'Skip'} ${formatRideDate(d)}`
                        : formatRideDate(d)}
                    >
                      <View pointerEvents="none" className="rounded-full px-3.5 py-2"
                        style={{
                          backgroundColor: !away && on ? c.accent : c.inset,
                          borderWidth: 1,
                          borderColor: !away && on ? c.accent : c.line,
                          opacity: away ? 0.6 : 1,
                        }}>
                        <Text className="font-sans-sb text-[12.5px]"
                          style={{
                            color: !away && on ? c.onAccent : c.muted,
                            textDecorationLine: away ? 'line-through' : 'none',
                          }}>
                          {formatRideDate(d)}{mark}
                        </Text>
                      </View>
                    </Touchable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ── A regular seat ───────────────────────────────────── */}
          {!isDriver && ride.days_of_week.length > 0 ? (
            <View className="mt-4 card p-4">
              {myStanding && myStanding.status !== 'cancelled' ? (
                <>
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="repeat" size={15} color={c.accent} />
                    <Text className="flex-1 font-sans-sb text-[14.5px] text-ink">
                      {myStanding.status === 'accepted' ? 'You have a regular seat'
                        : myStanding.status === 'declined' ? 'No regular seat on this ride'
                          : 'Regular seat requested'}
                    </Text>
                    <Badge
                      label={myStanding.status === 'accepted' ? 'Every week'
                        : myStanding.status === 'declined' ? 'Declined' : 'Pending'}
                      tone={myStanding.status === 'accepted' ? 'success' : 'neutral'}
                    />
                  </View>
                  <Text className="font-sans mt-1 text-[12.5px]" style={{ color: c.subtle }}>
                    {myStanding.seats} seat{myStanding.seats === 1 ? '' : 's'}
                    {myStanding.ends_on ? ` · until ${formatRideDate(myStanding.ends_on)}` : ''}
                    {myStanding.status === 'accepted'
                      ? ' · tap a day below to skip it'
                      : ''}
                  </Text>
                  {myStanding.status !== 'declined' ? (
                    <View className="mt-3">
                      <Button label="Give up the regular seat" variant="ghost" size="sm" disabled={busy}
                        onPress={async () => {
                          setBusy(true);
                          try { await withdrawStanding(myStanding.id); await load(); toast.show('Given up'); }
                          catch { toast.show('Could not update'); }
                          finally { setBusy(false); }
                        }} />
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="repeat-outline" size={15} color={c.accent} />
                    <Text className="flex-1 font-sans-sb text-[14.5px] text-ink">Travel this way every week?</Text>
                  </View>
                  <Text className="font-sans mt-1 text-[13px] leading-[19px]" style={{ color: c.subtle }}>
                    Agree it once and the seat is yours on every one of these days.
                    Skip any day you are away — asking twenty times a month is not a commute.
                  </Text>
                  <View className="mt-3">
                    <DateField
                      label="Until (optional)"
                      value={endsOn}
                      onChange={setEndsOn}
                      placeholder="No end — until I give it up"
                      minDate={todayIso()}
                    />
                  </View>
                  <View className="mt-3">
                    <Button label="Ask for a regular seat" icon="repeat" variant="outline" size="sm"
                      disabled={busy} onPress={askStanding} />
                  </View>
                </>
              )}
            </View>
          ) : null}

          {/* ── Asking, or answering ─────────────────────────────── */}
          {!isDriver && date ? (
            <View className="mt-4 card p-4">
              {myForDate ? (
                <>
                  <View className="flex-row items-center gap-2">
                    <Text className="flex-1 font-sans-sb text-[14.5px] text-ink">
                      {myForDate.status === 'accepted' ? 'Your seat is confirmed'
                        : myForDate.status === 'declined' ? 'The driver could not fit you in'
                          : 'Waiting for the driver'}
                    </Text>
                    <Badge
                      label={myForDate.status === 'accepted' ? 'Confirmed'
                        : myForDate.status === 'declined' ? 'Declined' : 'Pending'}
                      tone={myForDate.status === 'accepted' ? 'success' : 'neutral'}
                    />
                  </View>
                  <Text className="font-sans mt-1 text-[12.5px]" style={{ color: c.subtle }}>
                    {formatRideDate(myForDate.ride_date)} · {myForDate.seats} seat{myForDate.seats === 1 ? '' : 's'}
                  </Text>
                  {myForDate.status !== 'declined' ? (
                    <View className="mt-3">
                      <Button label="Withdraw" variant="ghost" size="sm" disabled={busy}
                        onPress={async () => {
                          setBusy(true);
                          try { await withdrawRequest(myForDate.id); await load(); toast.show('Withdrawn'); }
                          catch { toast.show('Could not withdraw'); }
                          finally { setBusy(false); }
                        }} />
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
                    Seats you need
                  </Text>
                  <Stepper value={seats} min={1} max={ride.seats_total} onChange={setSeats} />

                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Anything to tell the driver — pickup point, timing…"
                    placeholderTextColor={c.faint}
                    className="mt-3 rounded-xl px-3 py-2.5 text-[15px] text-ink"
                    style={{ backgroundColor: c.inset, outline: 'none' } as never}
                  />

                  <View className="mt-3">
                    <Button label={busy ? 'Asking…' : 'Ask for a seat'} disabled={busy} onPress={ask} />
                  </View>
                  <Text className="font-sans mt-2 text-center text-[12px]" style={{ color: c.faint }}>
                    The driver confirms — you will be told either way.
                  </Text>
                </>
              )}
            </View>
          ) : null}

          {isDriver && standing.filter((r) => r.status !== 'cancelled').length ? (
            <View className="mt-5">
              <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
                Regulars
              </Text>
              {standing.filter((r) => r.status !== 'cancelled').map((r) => {
                const away = date && skips.some((k) => k.standing_id === r.id && k.skip_date === date);
                return (
                  <View key={r.id} className="mb-2 card p-3.5">
                    <View className="flex-row items-center gap-2.5">
                      <Avatar name={r.rider?.name ?? '?'} size={32} />
                      <View style={{ flex: 1 }}>
                        <Text className="font-sans-sb text-[14px] text-ink">
                          {r.rider?.name ?? 'A neighbour'}
                          {r.rider?.flat ? <Text className="font-sans text-faint"> · {r.rider.flat}</Text> : null}
                        </Text>
                        <Text className="font-sans text-[12px]" style={{ color: c.subtle }}>
                          {r.seats} seat{r.seats === 1 ? '' : 's'} every week
                          {r.ends_on ? ` · until ${formatRideDate(r.ends_on)}` : ''}
                          {away ? ' · not coming this day' : ''}
                        </Text>
                      </View>
                      {r.status !== 'pending' ? (
                        <Badge label={r.status === 'accepted' ? 'Confirmed' : 'Declined'}
                          tone={r.status === 'accepted' ? 'success' : 'neutral'} />
                      ) : null}
                    </View>

                    {r.note ? (
                      <Text className="font-sans mt-2 text-[13px] leading-[19px] text-ink">{r.note}</Text>
                    ) : null}

                    {r.status === 'pending' ? (
                      <View className="mt-3 flex-row gap-2">
                        <View style={{ flex: 1 }}>
                          <Button label="Confirm" size="sm" disabled={busy}
                            onPress={() => answerStandingReq(r, 'accepted')} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button label="Can't fit" variant="outline" size="sm" disabled={busy}
                            onPress={() => answerStandingReq(r, 'declined')} />
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* ── The driver's list for the chosen day ─────────────── */}
          {isDriver && date ? (
            <View className="mt-4">
              <View className="mb-2 flex-row items-center gap-2">
                <Text className="flex-1 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
                  {formatRideDate(date)}
                </Text>
                <Text className="font-sans text-[12px]" style={{ color: left > 0 ? c.accent : c.muted }}>
                  {left > 0 ? `${left} of ${ride.seats_total} free` : 'Full'}
                </Text>
              </View>

              {requests.filter((r) => r.ride_date === date && r.status !== 'cancelled').length === 0 ? (
                <Text className="font-sans py-4 text-center text-[13px]" style={{ color: c.faint }}>
                  Nobody has asked for this day yet.
                </Text>
              ) : (
                requests
                  .filter((r) => r.ride_date === date && r.status !== 'cancelled')
                  .map((r) => (
                    <View key={r.id} className="mb-2 card p-3.5">
                      <View className="flex-row items-center gap-2.5">
                        <Avatar name={r.rider?.name ?? '?'} size={32} />
                        <View style={{ flex: 1 }}>
                          <Text className="font-sans-sb text-[14px] text-ink">
                            {r.rider?.name ?? 'A neighbour'}
                            {r.rider?.flat ? <Text className="font-sans text-faint"> · {r.rider.flat}</Text> : null}
                          </Text>
                          <Text className="font-sans text-[12px]" style={{ color: c.subtle }}>
                            {r.seats} seat{r.seats === 1 ? '' : 's'}
                          </Text>
                        </View>
                        {r.status !== 'pending' ? (
                          <Badge label={r.status === 'accepted' ? 'Confirmed' : 'Declined'}
                            tone={r.status === 'accepted' ? 'success' : 'neutral'} />
                        ) : null}
                      </View>

                      {r.note ? (
                        <Text className="font-sans mt-2 text-[13px] leading-[19px] text-ink">{r.note}</Text>
                      ) : null}

                      {r.status === 'pending' ? (
                        <View className="mt-3 flex-row gap-2">
                          <View style={{ flex: 1 }}>
                            <Button label="Confirm" size="sm" disabled={busy}
                              onPress={() => answer(r, 'accepted')} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Button label="Can't fit" variant="outline" size="sm" disabled={busy}
                              onPress={() => answer(r, 'declined')} />
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ))
              )}
            </View>
          ) : null}
        </Container>
      </ScrollView>
    </KeyboardAvoider>
  );
}
