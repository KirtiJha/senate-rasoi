import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useAuth } from '../context/auth';
import { useConfirm } from '../context/confirm';
import { useToast } from '../context/toast';
import {
  SessionView, bookerSetAttendance, cancelSession, createBooking, deleteBooking, fetchGroupSessions,
  respondToSession, subscribeGroupSessions, updateBooking,
} from '../lib/courts';
import { haptics } from '../lib/haptics';
import { durationLabel, formatTime, isValidTime, rsvpLocked } from '../lib/schedule';
import { GroupMember, fetchGroupMembers } from '../lib/sports';
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
  const confirm = useConfirm();

  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [manageSession, setManageSession] = useState<SessionView | null>(null);
  const [editSession, setEditSession] = useState<SessionView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setSessions(await fetchGroupSessions(groupId, userId)); }
    catch { /* keep prior */ }
    finally { setLoading(false); }
  }, [groupId, userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchGroupMembers(groupId).then(setMembers).catch(() => {}); }, [groupId]);

  // Live updates: counts & statuses refresh when anyone in the group responds.
  useEffect(() => subscribeGroupSessions(groupId, load), [groupId, load]);

  // Keep the open manage/edit sheet in sync with reloaded session data.
  const liveManage = manageSession ? sessions.find((s) => s.id === manageSession.id) ?? manageSession : null;
  const liveEdit = editSession ? sessions.find((s) => s.id === editSession.id) ?? editSession : null;

  const respond = async (s: SessionView, status: 'confirmed' | 'declined') => {
    if (!userId || busy) return;
    haptics.tap();
    setBusy(s.id);
    // Optimistic: flip my choice (and the live count) instantly so the control reflects it.
    setSessions((prev) => prev.map((x) => {
      if (x.id !== s.id) return x;
      const was = x.myStatus;
      let confirmedCount = x.confirmedCount;
      if (status === 'confirmed' && was !== 'confirmed') confirmedCount += 1;
      if (status !== 'confirmed' && was === 'confirmed') confirmedCount = Math.max(0, confirmedCount - 1);
      const perHead = confirmedCount > 0 ? Math.ceil(x.charge / confirmedCount) : x.charge;
      return { ...x, myStatus: status, confirmedCount, perHead };
    }));
    try {
      await respondToSession(s.id, userId, status);
      toast.show(status === 'confirmed' ? "You're in ✓" : "Marked as can't come");
      await load();
    } catch {
      toast.show('Could not update — try again');
      await load(); // reconcile back to the server truth
    } finally { setBusy(null); }
  };

  const onCancelSession = (s: SessionView) => {
    const run = async () => { try { await cancelSession(s.id); await load(); } catch { toast.show('Could not cancel'); } };
    const msg = `Cancel the ${fmtDate(s.session_date)} session?`;
    confirm({ title: 'Cancel session', message: msg, confirmLabel: 'Cancel session', destructive: true }).then((ok) => { if (ok) run(); });
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
              onRespond={respond} onCancel={onCancelSession} onManage={setManageSession} onEdit={setEditSession} />
          ))}
          {recent.length ? (
            <>
              <Text className="mt-1 text-[10px] font-sans-sb uppercase tracking-wider text-faint">Recent</Text>
              {recent.map((s) => (
                <SessionCard key={s.id} s={s} userId={userId} accent={accent} c={c} busy={busy === s.id}
                  onRespond={respond} onCancel={onCancelSession} onManage={setManageSession} onEdit={setEditSession} />
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

      <ManagePlayersSheet
        session={liveManage} members={members} accent={accent} c={c}
        onClose={() => setManageSession(null)}
        onSet={async (uid, status) => {
          if (!liveManage) return;
          try { await bookerSetAttendance(liveManage.id, uid, status); await load(); }
          catch { toast.show('Could not update'); }
        }}
      />

      <EditBookingSheet
        session={liveEdit} accent={accent} facility={facility} c={c}
        onClose={() => setEditSession(null)}
        onSave={async (f) => {
          if (!liveEdit) return;
          try {
            await updateBooking(liveEdit.booking_id, f);
            setEditSession(null);
            toast.show(f.reset ? 'Booking updated — group asked to re-confirm' : 'Booking updated');
            await load();
          } catch { toast.show('Could not update booking'); }
        }}
      />
    </View>
  );
}

function SessionCard({
  s, userId, accent, c, busy, onRespond, onCancel, onManage, onEdit,
}: {
  s: SessionView; userId: string | null; accent: string; c: ReturnType<typeof useThemeColors>;
  busy: boolean; onRespond: (s: SessionView, status: 'confirmed' | 'declined') => void; onCancel: (s: SessionView) => void;
  onManage: (s: SessionView) => void; onEdit: (s: SessionView) => void;
}) {
  const isBooker = s.booker_user_id === userId;
  const time = s.start_time ? formatTime(s.start_time) : '';
  const locked = rsvpLocked(s.session_date, s.start_time ?? '');
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
          <View className="flex-row items-center gap-3">
            {!s.ended ? <Pressable onPress={() => onEdit(s)} hitSlop={6}><Ionicons name="create-outline" size={16} color={c.faint} /></Pressable> : null}
            <Pressable onPress={() => onCancel(s)} hitSlop={6}><Ionicons name="trash-outline" size={15} color={c.faint} /></Pressable>
          </View>
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

      {/* booker controls / my response */}
      {isBooker ? (
        <View className="mt-2.5 flex-row items-center justify-between">
          <Text className="text-[11px] font-sans-sb" style={{ color: accent }}>You booked · you're in</Text>
          <Pressable onPress={() => onManage(s)} className="flex-row items-center gap-1 rounded-full bg-surface px-2.5 py-1" style={{ borderWidth: 1, borderColor: c.line }}>
            <Ionicons name="people-outline" size={13} color={c.muted} />
            <Text className="text-[11.5px] font-sans-sb text-muted">Manage players</Text>
          </Pressable>
        </View>
      ) : s.ended ? (
        <Text className="mt-2 text-[11px] font-sans-sb text-faint">Session ended{s.myStatus === 'confirmed' ? ' · settle in Dues' : ''}</Text>
      ) : locked ? (
        <View className="mt-2.5 rounded-xl px-3 py-2" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
          <Text className="text-[11.5px] font-sans-sb" style={{ color: s.myStatus === 'confirmed' ? accent : c.muted }}>
            {s.myStatus === 'confirmed' ? "You're in ✓" : s.myStatus === 'declined' ? "You marked: can't come" : 'No response recorded'}
          </Text>
          <Text className="mt-0.5 text-[11px] text-faint">RSVP closed (15 min after start). Ask the booker to change your attendance.</Text>
        </View>
      ) : (
        <View className="mt-2.5">
          <Text className="mb-1.5 text-[11px] font-sans-sb text-muted">
            {s.myStatus === 'confirmed' ? "You're in — tap to change" : s.myStatus === 'declined' ? "Not coming — tap to change" : 'Coming along?'}
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => onRespond(s, 'confirmed')}
              disabled={busy}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2"
              style={{ backgroundColor: s.myStatus === 'confirmed' ? accent : c.surface, borderWidth: 1.5, borderColor: s.myStatus === 'confirmed' ? accent : c.line, opacity: busy ? 0.6 : 1 }}
            >
              <Ionicons name={s.myStatus === 'confirmed' ? 'checkmark-circle' : 'checkmark'} size={15} color={s.myStatus === 'confirmed' ? '#fff' : c.muted} />
              <Text className="text-[12.5px] font-sans-sb" style={{ color: s.myStatus === 'confirmed' ? '#fff' : c.muted }}>I'm in</Text>
            </Pressable>
            <Pressable
              onPress={() => onRespond(s, 'declined')}
              disabled={busy}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2"
              style={{ backgroundColor: s.myStatus === 'declined' ? '#6B7280' : c.surface, borderWidth: 1.5, borderColor: s.myStatus === 'declined' ? '#6B7280' : c.line, opacity: busy ? 0.6 : 1 }}
            >
              <Ionicons name={s.myStatus === 'declined' ? 'close-circle' : 'close'} size={15} color={s.myStatus === 'declined' ? '#fff' : c.muted} />
              <Text className="text-[12.5px] font-sans-sb" style={{ color: s.myStatus === 'declined' ? '#fff' : c.muted }}>Can't</Text>
            </Pressable>
          </View>
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
  const [oneOff, setOneOff] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [time, setTime] = useState('18:00');
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
          <View className="mb-3"><NumberChips options={[1, 2, 4, 8, 12]} value={parseInt(weeks, 10) || 0} onChange={(v) => setWeeks(String(v))} suffix=" wk" accent={accent} c={c} /></View>
        </>
      ) : (
        <>
          <Text className={lbl}>Date</Text>
          <View className="mb-3"><DateChips value={oneOff} onChange={setOneOff} accent={accent} c={c} /></View>
        </>
      )}

      <Text className={lbl}>Start time</Text>
      <View className="mb-3"><TimePicker value={time} onChange={setTime} accent={accent} c={c} /></View>

      <Text className={lbl}>Duration</Text>
      <View className="mb-3"><DurationChips value={durMin} onChange={(m) => setDuration(String(m))} accent={accent} c={c} /></View>

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

// ── Tap-to-select inputs for the booking form ───────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0');
type Cols = ReturnType<typeof useThemeColors>;

const chipStyle = (active: boolean, accent: string, c: Cols) => ({
  backgroundColor: active ? accent : c.surface,
  borderWidth: 1,
  borderColor: active ? accent : c.line,
});

/** Hour (1–12) + minute (00/15/30/45) + AM/PM. Emits "HH:MM" (24-hour). */
function TimePicker({ value, onChange, accent, c }: { value: string; onChange: (v: string) => void; accent: string; c: Cols }) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value || '');
  const h24 = m ? parseInt(m[1], 10) : 18;
  const min = m ? m[2] : '00';
  const pm = h24 >= 12;
  const h12 = h24 % 12 || 12;
  const set = (nh12: number, nmin: string, npm: boolean) => {
    let h = nh12 % 12;
    if (npm) h += 12;
    onChange(`${pad2(h)}:${nmin}`);
  };
  return (
    <View className="rounded-2xl border border-line bg-inset p-2.5">
      <View className="flex-row flex-wrap gap-1.5">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((hh) => (
          <Pressable key={hh} onPress={() => set(hh, min, pm)} className="items-center justify-center rounded-lg" style={[{ width: 34, height: 30 }, chipStyle(h12 === hh, accent, c)]}>
            <Text className="text-[12px] font-sans-sb" style={{ color: h12 === hh ? '#fff' : c.ink }}>{hh}</Text>
          </Pressable>
        ))}
      </View>
      <View className="mt-2 flex-row gap-1.5">
        {['00', '15', '30', '45'].map((mm) => (
          <Pressable key={mm} onPress={() => set(h12, mm, pm)} className="flex-1 items-center rounded-lg py-1.5" style={chipStyle(min === mm, accent, c)}>
            <Text className="text-[12px] font-sans-sb" style={{ color: min === mm ? '#fff' : c.ink }}>:{mm}</Text>
          </Pressable>
        ))}
        {([['AM', false], ['PM', true]] as const).map(([label, p]) => (
          <Pressable key={label} onPress={() => set(h12, min, p)} className="flex-1 items-center rounded-lg py-1.5" style={chipStyle(pm === p, accent, c)}>
            <Text className="text-[12px] font-sans-sb" style={{ color: pm === p ? '#fff' : c.ink }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Duration as tappable pills (30m … 2h). */
function DurationChips({ value, onChange, accent, c }: { value: number; onChange: (m: number) => void; accent: string; c: Cols }) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {[30, 45, 60, 90, 120].map((mins) => (
        <Pressable key={mins} onPress={() => onChange(mins)} className="rounded-full px-3.5 py-1.5" style={chipStyle(value === mins, accent, c)}>
          <Text className="text-[12.5px] font-sans-sb" style={{ color: value === mins ? '#fff' : c.muted }}>{durationLabel(mins)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Next 14 days as tappable date pills. Emits YYYY-MM-DD. */
function DateChips({ value, onChange, accent, c }: { value: string; onChange: (iso: string) => void; accent: string; c: Cols }) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = d.toLocaleDateString('en-CA');
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return { iso, label };
  });
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {days.map((d) => (
        <Pressable key={d.iso} onPress={() => onChange(d.iso)} className="rounded-full px-3 py-1.5" style={chipStyle(value === d.iso, accent, c)}>
          <Text className="text-[12px] font-sans-sb" style={{ color: value === d.iso ? '#fff' : c.muted }}>{d.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Generic number pills (used for "how many weeks"). */
function NumberChips({ options, value, onChange, suffix, accent, c }: { options: number[]; value: number; onChange: (v: number) => void; suffix?: string; accent: string; c: Cols }) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {options.map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} className="rounded-full px-3.5 py-1.5" style={chipStyle(value === n, accent, c)}>
          <Text className="text-[12.5px] font-sans-sb" style={{ color: value === n ? '#fff' : c.muted }}>{n}{suffix ?? ''}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Booker: mark who actually played (overrides the member RSVP lock) ─
function ManagePlayersSheet({ session, members, accent, c, onClose, onSet }: {
  session: SessionView | null; members: GroupMember[]; accent: string; c: Cols;
  onClose: () => void; onSet: (userId: string, status: 'confirmed' | 'declined') => void;
}) {
  const statusOf = (uid: string) => session?.players.find((p) => p.user_id === uid)?.status ?? null;
  return (
    <Sheet visible={!!session} onClose={onClose} title="Who played?">
      <Text className="mb-3 text-[12.5px] leading-[18px] text-muted">
        Mark each member in or out — the cost splits among everyone marked “in”, so no one who played is left off and your share stays fair.
      </Text>
      <View className="gap-1.5">
        {members.map((m) => {
          const st = statusOf(m.user_id);
          const isBooker = session?.booker_user_id === m.user_id;
          return (
            <View key={m.user_id} className="flex-row items-center gap-2 rounded-xl border border-line bg-inset px-3 py-2">
              <View className="flex-1">
                <Text className="font-sans-sb text-[13px] text-ink" numberOfLines={1}>{m.profile?.name ?? 'Member'}{isBooker ? ' · booker' : ''}</Text>
                {m.profile?.flat ? <Text className="text-[11px] text-faint">Flat {m.profile.flat}</Text> : null}
              </View>
              {isBooker ? (
                <Text className="text-[11.5px] font-sans-sb" style={{ color: accent }}>In</Text>
              ) : (
                <View className="flex-row gap-1.5">
                  <Pressable onPress={() => onSet(m.user_id, 'confirmed')} className="rounded-lg px-2.5 py-1.5" style={chipStyle(st === 'confirmed', accent, c)}>
                    <Text className="text-[11.5px] font-sans-sb" style={{ color: st === 'confirmed' ? '#fff' : c.muted }}>In</Text>
                  </Pressable>
                  <Pressable onPress={() => onSet(m.user_id, 'declined')} className="rounded-lg px-2.5 py-1.5" style={chipStyle(st === 'declined', '#6B7280', c)}>
                    <Text className="text-[11.5px] font-sans-sb" style={{ color: st === 'declined' ? '#fff' : c.muted }}>Out</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
        {members.length === 0 ? <Text className="text-[12px] text-faint">No members yet.</Text> : null}
      </View>
    </Sheet>
  );
}

// ── Booker: edit the booking (flows to upcoming sessions; optional re-confirm) ─
function EditBookingSheet({ session, accent, facility, c, onClose, onSave }: {
  session: SessionView | null; accent: string; facility: string; c: Cols;
  onClose: () => void;
  onSave: (f: { title: string | null; location: string | null; startTime: string | null; durationMin: number; charge: number; reset: boolean }) => void;
}) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState('60');
  const [charge, setCharge] = useState('');
  const [reset, setReset] = useState(true);

  useEffect(() => {
    if (!session) return;
    setTitle(session.title ?? '');
    setLocation(session.location ?? '');
    setTime(session.start_time && isValidTime(session.start_time) ? session.start_time : '18:00');
    setDuration(String(session.duration_min || 60));
    setCharge(session.charge ? String(session.charge) : '');
    setReset(true);
  }, [session]);

  const input = 'rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink';
  const lbl = 'mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted';
  const durMin = parseInt(duration, 10) || 0;
  const valid = isValidTime(time) && durMin > 0;

  const save = () => {
    if (!valid) return;
    onSave({ title: title.trim() || null, location: location.trim() || null, startTime: time.trim(), durationMin: durMin, charge: parseFloat(charge) || 0, reset });
  };

  return (
    <Sheet visible={!!session} onClose={onClose} title="Edit booking" footer={<Button label="Save changes" fullWidth disabled={!valid} onPress={save} />}>
      <Text className="mb-3 text-[12px] leading-[18px] text-faint">Applies to this and any upcoming sessions of this booking. Past sessions are unaffected.</Text>

      <Text className={lbl}>Title (optional)</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Evening doubles" placeholderTextColor={c.faint} className={`mb-3 ${input}`} style={{ outline: 'none' } as any} />

      <Text className={lbl}>Start time</Text>
      <View className="mb-3"><TimePicker value={time} onChange={setTime} accent={accent} c={c} /></View>

      <Text className={lbl}>Duration</Text>
      <View className="mb-3"><DurationChips value={durMin} onChange={(m) => setDuration(String(m))} accent={accent} c={c} /></View>

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

      <Pressable onPress={() => setReset((v) => !v)} className="mb-1 flex-row items-center gap-2.5 rounded-2xl border border-line bg-inset px-3.5 py-3">
        <Ionicons name={reset ? 'checkbox' : 'square-outline'} size={20} color={reset ? accent : c.faint} />
        <View className="flex-1">
          <Text className="font-sans-sb text-[13px] text-ink">Ask everyone to re-confirm</Text>
          <Text className="text-[11px] text-muted">Clears current responses for upcoming sessions and notifies the group.</Text>
        </View>
      </Pressable>
    </Sheet>
  );
}
