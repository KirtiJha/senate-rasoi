import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import {
  SessionView, cancelSession, createBooking, deleteBooking, fetchGroupSessions, respondToSession,
} from '../lib/courts';
import { durationLabel, formatTime, isValidTime } from '../lib/schedule';
import { useThemeColors } from '../theme';
import { WeekdayChips } from './WeekdayChips';
import { Button, Sheet } from './ui';

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return iso; }
}

/** Court bookings, attendance and the live cost-split for one sports group. */
export function CourtBookings({
  groupId, communityId, accent, isMember, facility,
}: {
  groupId: string;
  communityId: string;
  accent: string;
  isMember: boolean;
  facility: string; // 'Court' | 'Net' | 'Table' …
}) {
  const noun = facility.toLowerCase();
  const c = useThemeColors();
  const toast = useToast();
  const router = useRouter();
  const { userId } = useAuth();

  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setSessions(await fetchGroupSessions(groupId, userId)); }
    catch { /* keep prior */ }
    finally { setLoading(false); }
  }, [groupId, userId]);

  useEffect(() => { load(); }, [load]);

  const respond = async (s: SessionView, status: 'confirmed' | 'declined') => {
    if (!userId) return;
    setBusy(s.id);
    try { await respondToSession(s.id, userId, status); await load(); }
    catch { toast.show('Could not update — try again'); }
    finally { setBusy(null); }
  };

  const onCancelSession = (s: SessionView) => {
    const run = async () => { try { await cancelSession(s.id); await load(); } catch { toast.show('Could not cancel'); } };
    const msg = `Cancel the ${fmtDate(s.session_date)} session?`;
    if (Platform.OS === 'web') { if (window.confirm(msg)) run(); }
    else Alert.alert('Cancel session', msg, [{ text: 'Back', style: 'cancel' }, { text: 'Cancel session', style: 'destructive', onPress: run }]);
  };

  const upcoming = sessions.filter((s) => !s.ended);
  const recent = sessions.filter((s) => s.ended).slice(0, 4);

  return (
    <View className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-[11px] font-sans-sb uppercase tracking-wider text-muted">{facility} bookings</Text>
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => router.push('/sports/dues' as any)} hitSlop={6} className="flex-row items-center gap-1 rounded-full bg-inset px-2.5 py-1 active:opacity-80">
            <Ionicons name="wallet-outline" size={13} color={c.muted} />
            <Text className="text-[12px] font-sans-sb text-muted">Dues</Text>
          </Pressable>
          {isMember ? (
            <Pressable onPress={() => setShowCreate(true)} hitSlop={6} className="flex-row items-center gap-1 rounded-full px-2.5 py-1 active:opacity-80" style={{ backgroundColor: accent + '1A' }}>
              <Ionicons name="add" size={14} color={accent} />
              <Text className="text-[12px] font-sans-sb" style={{ color: accent }}>Book</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading ? (
        <Text className="py-2 text-[13px] text-muted">Loading…</Text>
      ) : sessions.length === 0 ? (
        <Text className="py-2 text-[13px] text-muted">No {noun} booked yet. {isMember ? 'Book one and your group gets notified to confirm.' : ''}</Text>
      ) : (
        <View className="gap-2.5">
          {upcoming.map((s) => (
            <SessionCard key={s.id} s={s} userId={userId} accent={accent} c={c} busy={busy === s.id}
              onRespond={respond} onCancel={onCancelSession} />
          ))}
          {recent.length ? (
            <>
              <Text className="mt-1 text-[10px] font-sans-sb uppercase tracking-wider text-faint">Recent</Text>
              {recent.map((s) => (
                <SessionCard key={s.id} s={s} userId={userId} accent={accent} c={c} busy={busy === s.id}
                  onRespond={respond} onCancel={onCancelSession} />
              ))}
            </>
          ) : null}
        </View>
      )}

      <CreateBookingSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        accent={accent}
        facility={facility}
        c={c}
        onCreate={async (form) => {
          if (!userId) return;
          setShowCreate(false);
          try {
            await createBooking({ groupId, communityId, bookerUserId: userId, ...form });
            toast.show(`${facility} booked — your group has been notified 🏸`);
            await load();
          } catch { toast.show('Could not create booking'); }
        }}
      />
    </View>
  );
}

function SessionCard({
  s, userId, accent, c, busy, onRespond, onCancel,
}: {
  s: SessionView; userId: string | null; accent: string; c: ReturnType<typeof useThemeColors>;
  busy: boolean; onRespond: (s: SessionView, status: 'confirmed' | 'declined') => void; onCancel: (s: SessionView) => void;
}) {
  const isBooker = s.booker_user_id === userId;
  const time = s.start_time ? formatTime(s.start_time) : '';
  return (
    <View className="rounded-xl border border-line bg-inset p-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="font-sans-bold text-[14px] text-ink">{fmtDate(s.session_date)}{time ? ` · ${time}` : ''}</Text>
          <Text className="mt-0.5 text-[12px] text-muted">
            {[s.title, s.location, durationLabel(s.duration_min)].filter(Boolean).join(' · ') || 'Court session'}
          </Text>
        </View>
        {isBooker ? (
          <Pressable onPress={() => onCancel(s)} hitSlop={6}><Ionicons name="trash-outline" size={15} color={c.faint} /></Pressable>
        ) : null}
      </View>

      {/* split + confirmed */}
      <View className="mt-2 flex-row items-center gap-2">
        <View className="flex-row items-center gap-1 rounded-full bg-surface px-2 py-0.5">
          <Ionicons name="people" size={12} color={accent} />
          <Text className="text-[11px] font-sans-sb" style={{ color: accent }}>{s.confirmedCount} in</Text>
        </View>
        {s.charge > 0 ? (
          <Text className="text-[11px] text-muted">₹{s.charge} · ₹{s.perHead}/head{s.ended ? '' : ' (so far)'}</Text>
        ) : <Text className="text-[11px] text-faint">Free court</Text>}
      </View>
      {s.confirmed.length ? (
        <Text className="mt-1 text-[11px] text-faint" numberOfLines={1}>
          {s.confirmed.map((p) => (p.user_id === userId ? 'You' : p.profile?.name ?? 'Member')).join(', ')}
        </Text>
      ) : null}

      {/* my response */}
      {s.ended ? (
        <Text className="mt-2 text-[11px] font-sans-sb text-faint">Session ended{s.myStatus === 'confirmed' && !isBooker ? ' · settle in Dues' : ''}</Text>
      ) : isBooker ? (
        <Text className="mt-2 text-[11px] font-sans-sb" style={{ color: accent }}>You booked · you're in</Text>
      ) : (
        <View className="mt-2.5 flex-row gap-2">
          <Pressable
            onPress={() => onRespond(s, 'confirmed')}
            disabled={busy}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2"
            style={{ backgroundColor: s.myStatus === 'confirmed' ? accent : c.surface, borderWidth: 1, borderColor: s.myStatus === 'confirmed' ? accent : c.line }}
          >
            <Ionicons name="checkmark" size={14} color={s.myStatus === 'confirmed' ? '#fff' : c.muted} />
            <Text className="text-[12px] font-sans-sb" style={{ color: s.myStatus === 'confirmed' ? '#fff' : c.muted }}>I'm in</Text>
          </Pressable>
          <Pressable
            onPress={() => onRespond(s, 'declined')}
            disabled={busy}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2"
            style={{ backgroundColor: s.myStatus === 'declined' ? '#9CA3AF' : c.surface, borderWidth: 1, borderColor: s.myStatus === 'declined' ? '#9CA3AF' : c.line }}
          >
            <Ionicons name="close" size={14} color={s.myStatus === 'declined' ? '#fff' : c.muted} />
            <Text className="text-[12px] font-sans-sb" style={{ color: s.myStatus === 'declined' ? '#fff' : c.muted }}>Can't</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function CreateBookingSheet({
  visible, onClose, onCreate, accent, facility, c,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (form: { title: string | null; location: string | null; days: number[]; startTime: string; durationMin: number; charge: number; weeks: number; oneOffDate: string | null; upi: string | null }) => void;
  accent: string;
  facility: string;
  c: ReturnType<typeof useThemeColors>;
}) {
  const { profile } = useAuth();
  const noun = facility.toLowerCase();
  const [mode, setMode] = useState<'weekly' | 'oneoff'>('weekly');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [weeks, setWeeks] = useState('4');
  const [oneOff, setOneOff] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [charge, setCharge] = useState('');
  const [upi, setUpi] = useState(profile?.upi ?? '');

  useEffect(() => { if (visible) setUpi(profile?.upi ?? ''); }, [visible, profile?.upi]);

  const input = 'rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink';
  const lbl = 'mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted';

  const durMin = parseInt(duration, 10) || 0;
  const chargeNum = parseFloat(charge) || 0;
  const valid = isValidTime(time) && durMin > 0 &&
    (mode === 'weekly' ? days.length > 0 && (parseInt(weeks, 10) || 0) > 0 : /^\d{4}-\d{2}-\d{2}$/.test(oneOff));

  const submit = () => {
    if (!valid) return;
    onCreate({
      title: title.trim() || null,
      location: location.trim() || null,
      days, startTime: time.trim(), durationMin: durMin, charge: chargeNum,
      weeks: mode === 'weekly' ? parseInt(weeks, 10) || 1 : 1,
      oneOffDate: mode === 'oneoff' ? oneOff.trim() : null,
      upi: upi.trim() || null,
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Book the ${noun}`} footer={<Button label="Book & notify group" fullWidth disabled={!valid} onPress={submit} />}>
      <Text className={lbl}>Title (optional)</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Evening doubles" placeholderTextColor={c.faint} className={`mb-3 ${input}`} style={{ outline: 'none' } as any} />

      {/* recurrence */}
      <View className="mb-3 flex-row gap-2">
        {(['weekly', 'oneoff'] as const).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} className="flex-1 items-center rounded-xl border py-2" style={{ borderColor: mode === m ? accent : c.line, backgroundColor: mode === m ? accent + '14' : c.inset }}>
            <Text className="text-[13px] font-sans-sb" style={{ color: mode === m ? accent : c.muted }}>{m === 'weekly' ? 'Repeats weekly' : 'One-off'}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'weekly' ? (
        <>
          <Text className={lbl}>Days</Text>
          <View className="mb-3"><WeekdayChips value={days} onChange={setDays} accent={accent} /></View>
          <Text className={lbl}>For how many weeks</Text>
          <TextInput value={weeks} onChangeText={setWeeks} keyboardType="number-pad" placeholder="4" placeholderTextColor={c.faint} className={`mb-3 ${input}`} style={{ outline: 'none' } as any} />
        </>
      ) : (
        <>
          <Text className={lbl}>Date</Text>
          <TextInput value={oneOff} onChangeText={setOneOff} placeholder="2026-06-20" placeholderTextColor={c.faint} className={`mb-3 ${input}`} style={{ outline: 'none' } as any} />
        </>
      )}

      <View className="mb-3 flex-row gap-2">
        <View className="flex-1">
          <Text className={lbl}>Time</Text>
          <TextInput value={time} onChangeText={setTime} placeholder="18:00" placeholderTextColor={c.faint} className={input} style={{ outline: 'none' } as any} />
        </View>
        <View className="flex-1">
          <Text className={lbl}>Duration (min)</Text>
          <TextInput value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="60" placeholderTextColor={c.faint} className={input} style={{ outline: 'none' } as any} />
        </View>
      </View>

      <View className="mb-3 flex-row gap-2">
        <View className="flex-1">
          <Text className={lbl}>{facility} charge / session</Text>
          <TextInput value={charge} onChangeText={setCharge} keyboardType="decimal-pad" placeholder="₹ 400" placeholderTextColor={c.faint} className={input} style={{ outline: 'none' } as any} />
        </View>
        <View className="flex-1">
          <Text className={lbl}>{facility} / venue</Text>
          <TextInput value={location} onChangeText={setLocation} placeholder={`${facility} 1`} placeholderTextColor={c.faint} className={input} style={{ outline: 'none' } as any} />
        </View>
      </View>

      <Text className={lbl}>Your UPI (to collect shares)</Text>
      <TextInput value={upi} onChangeText={setUpi} autoCapitalize="none" placeholder="name@bank" placeholderTextColor={c.faint} className={`mb-2 ${input}`} style={{ outline: 'none' } as any} />
      <Text className="mb-1 text-[11px] leading-[16px] text-faint">
        Players confirm per day. After each session the charge splits equally among everyone who played (including you), and they pay their share to this UPI.
      </Text>
    </Sheet>
  );
}
