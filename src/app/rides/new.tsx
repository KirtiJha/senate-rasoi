import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { haptics } from '../../lib/haptics';
import { PREFERENCE_LABELS, RidePreference, createRide, fetchRide, updateRide } from '../../lib/rides';
import { useThemeColors } from '../../theme';
import {
  Button, Container, DateField, KeyboardAvoider, ScreenHeader, Stepper, TimeField, Touchable,
} from '../../components/ui';

const DAYS = [
  { i: 1, label: 'M' }, { i: 2, label: 'T' }, { i: 3, label: 'W' },
  { i: 4, label: 'T' }, { i: 5, label: 'F' }, { i: 6, label: 'S' }, { i: 0, label: 'S' },
];

/**
 * Offering a ride — or correcting one.
 *
 * The old carpool form took a departure time as free text ("9am") and a
 * schedule as the word "Daily", which is why nothing could ever list what was
 * on tomorrow or remind anybody. Here the time is a picker and the recurrence
 * is a real set of weekdays, so the ride can be booked per journey.
 *
 * `?ride=<id>` edits instead of creating. `updateRide` had sat unused, so
 * moving a departure from 8:00 to 8:15 meant deleting the ride — and requests
 * and standing seats cascade, so every rider was quietly unbooked.
 */
export default function NewRideScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const toast = useToast();
  const { userId, communityId } = useAuth();
  const { ride: editId } = useLocalSearchParams<{ ride?: string }>();
  const editing = typeof editId === 'string' && editId.length > 0;

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [time, setTime] = useState<string | null>('09:00');
  const [duration, setDuration] = useState('');
  const [repeats, setRepeats] = useState(true);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [oneOff, setOneOff] = useState<string | null>(null);
  const [seats, setSeats] = useState(2);
  const [price, setPrice] = useState('');
  const [preference, setPreference] = useState<RidePreference>('all');
  const [vehicle, setVehicle] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    if (!editing || !editId) return;
    let alive = true;
    fetchRide(editId)
      .then((r) => {
        if (!alive || !r) return;
        setFrom(r.from_text); setTo(r.to_text);
        setTime((r.depart_time ?? '09:00').slice(0, 5));
        setDuration(r.duration_min != null ? String(r.duration_min) : '');
        setRepeats(!r.one_off_date);
        setDays(r.days_of_week ?? []);
        setOneOff(r.one_off_date);
        setSeats(r.seats_total);
        setPrice(r.price_per_seat != null ? String(r.price_per_seat) : '');
        setPreference(r.preference);
        setVehicle(r.vehicle ?? '');
        setNote(r.note ?? '');
      })
      .catch(() => toast.show('Could not load that ride'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [editing, editId, toast]);

  const label = 'mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted';
  const input = 'mb-4 rounded-2xl border border-line px-3.5 py-3 text-[15px] text-ink';

  const save = async () => {
    if (busy || !userId) return;
    if (!from.trim() || !to.trim()) { toast.show('Where from, and where to?'); return; }
    if (!time) { toast.show('What time do you leave?'); return; }
    if (repeats && days.length === 0) { toast.show('Pick at least one day'); return; }
    if (!repeats && !oneOff) { toast.show('Which day?'); return; }

    setBusy(true);
    try {
      if (editing && editId) {
        await updateRide(editId, {
          from_text: from.trim(),
          to_text: to.trim(),
          depart_time: time,
          duration_min: duration.trim() ? Number(duration) : null,
          days_of_week: repeats ? days : [],
          one_off_date: repeats ? null : oneOff,
          seats_total: seats,
          price_per_seat: price.trim() ? Number(price) : null,
          preference,
          vehicle: vehicle.trim() || null,
          note: note.trim() || null,
        });
        haptics.success();
        toast.show('Ride updated');
        router.replace(`/rides/${editId}` as never);
        return;
      }
      const id = await createRide({
        communityId: communityId ?? undefined,
        driverUserId: userId,
        fromText: from,
        toText: to,
        departTime: time,
        durationMin: duration.trim() ? Number(duration) : null,
        daysOfWeek: days,
        oneOffDate: repeats ? null : oneOff,
        seatsTotal: seats,
        pricePerSeat: price.trim() ? Number(price) : null,
        preference,
        vehicle,
        note,
      });
      haptics.success();
      toast.show('Ride offered 🚗');
      router.replace(`/rides/${id}` as never);
    } catch (e) {
      console.error(e);
      toast.show('Could not save — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoider>
      <ScreenHeader
        icon="car-outline"
        title={editing ? 'Edit this lift' : 'Offer a lift'}
        showBack
        backHref={editing && editId ? (`/rides/${editId}` as never) : '/rides'}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          <Text className={label}>From</Text>
          <TextInput
            value={from} onChangeText={setFrom}
            placeholder="Society main gate" placeholderTextColor={c.faint}
            className={input} style={{ backgroundColor: c.inset, outline: 'none' } as never}
          />

          <Text className={label}>To</Text>
          <TextInput
            value={to} onChangeText={setTo}
            placeholder="Electronic City Phase 1" placeholderTextColor={c.faint}
            className={input} style={{ backgroundColor: c.inset, outline: 'none' } as never}
          />
          <Text className="font-sans -mt-2 mb-4 text-[12px]" style={{ color: c.faint }}>
            Written as you would say it — the route link hands this straight to Google Maps.
          </Text>

          <View className="mb-4 flex-row gap-2">
            <View style={{ flex: 1 }}>
              <TimeField label="Leaves at" value={time} onChange={setTime} clearable={false} />
            </View>
            <View style={{ flex: 1 }}>
              <Text className={label}>Takes (min)</Text>
              <TextInput
                value={duration} onChangeText={setDuration} keyboardType="number-pad"
                placeholder="45" placeholderTextColor={c.faint}
                className="rounded-2xl border border-line px-3.5 py-3 text-[15px] text-ink"
                style={{ backgroundColor: c.inset, outline: 'none' } as never}
              />
            </View>
          </View>

          {/* ── When ─────────────────────────────────────────────── */}
          <Text className={label}>How often</Text>
          <View className="mb-3 flex-row gap-2">
            {[true, false].map((r) => (
              <View key={String(r)} style={{ flex: 1 }}>
                <Touchable onPress={() => setRepeats(r)} accessibilityRole="button"
                  accessibilityState={{ selected: repeats === r }}
                  accessibilityLabel={r ? 'Repeats weekly' : 'One trip only'}>
                  <View pointerEvents="none" className="items-center rounded-xl py-2.5"
                    style={{ backgroundColor: repeats === r ? c.accent : c.inset }}>
                    <Text className="text-[13px] font-sans-sb"
                      style={{ color: repeats === r ? c.onAccent : c.muted }}>
                      {r ? 'Every week' : 'One trip'}
                    </Text>
                  </View>
                </Touchable>
              </View>
            ))}
          </View>

          {repeats ? (
            <View className="mb-4 flex-row gap-1.5">
              {DAYS.map((d) => {
                const on = days.includes(d.i);
                return (
                  <View key={d.i} style={{ flex: 1 }}>
                    <Touchable
                      onPress={() => setDays((cur) => on ? cur.filter((x) => x !== d.i) : [...cur, d.i])}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`Day ${d.i}`}
                    >
                      <View pointerEvents="none" className="items-center rounded-xl py-2.5"
                        style={{ backgroundColor: on ? c.accent : c.inset }}>
                        <Text className="text-[13px] font-sans-sb"
                          style={{ color: on ? c.onAccent : c.muted }}>{d.label}</Text>
                      </View>
                    </Touchable>
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="mb-4">
              <DateField label="Which day" value={oneOff} onChange={setOneOff} minDate={new Date().toISOString().slice(0, 10)} />
            </View>
          )}

          {/* ── Seats and cost ───────────────────────────────────── */}
          <Text className={label}>Seats you can offer</Text>
          <View className="mb-4">
            <Stepper value={seats} min={1} max={8} onChange={setSeats} />
          </View>

          <Text className={label}>Cost a seat</Text>
          <TextInput
            value={price} onChangeText={setPrice} keyboardType="number-pad"
            placeholder="Leave blank to sort it out between you" placeholderTextColor={c.faint}
            className={input} style={{ backgroundColor: c.inset, outline: 'none' } as never}
          />

          <Text className={label}>Who can join</Text>
          <View className="mb-4 flex-row gap-2">
            {(['all', 'women', 'men'] as RidePreference[]).map((p) => (
              <View key={p} style={{ flex: 1 }}>
                <Touchable onPress={() => setPreference(p)} accessibilityRole="button"
                  accessibilityState={{ selected: preference === p }}
                  accessibilityLabel={PREFERENCE_LABELS[p]}>
                  <View pointerEvents="none" className="items-center rounded-xl py-2.5"
                    style={{ backgroundColor: preference === p ? c.accent : c.inset }}>
                    <Text className="text-[12.5px] font-sans-sb"
                      style={{ color: preference === p ? c.onAccent : c.muted }}>
                      {PREFERENCE_LABELS[p]}
                    </Text>
                  </View>
                </Touchable>
              </View>
            ))}
          </View>

          <Text className={label}>Vehicle (optional)</Text>
          <TextInput
            value={vehicle} onChangeText={setVehicle}
            placeholder="White Swift · KA 01 AB 1234" placeholderTextColor={c.faint}
            className={input} style={{ backgroundColor: c.inset, outline: 'none' } as never}
          />

          <Text className={label}>Anything else</Text>
          <TextInput
            value={note} onChangeText={setNote} multiline
            placeholder="Pickup point, luggage space, whether you can wait five minutes…"
            placeholderTextColor={c.faint}
            className={input}
            style={{ backgroundColor: c.inset, minHeight: 84, textAlignVertical: 'top', outline: 'none' } as never}
          />

          <Button
            label={busy ? 'Saving…' : editing ? 'Save changes' : 'Offer this ride'}
            onPress={save}
            disabled={busy || loading}
          />
        </Container>
      </ScrollView>
    </KeyboardAvoider>
  );
}
