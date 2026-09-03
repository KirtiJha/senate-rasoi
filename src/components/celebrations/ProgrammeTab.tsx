import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../context/auth';
import { useConfirm } from '../../context/confirm';
import { useToast } from '../../context/toast';
import {
  AUDIENCES,
  ActivityParticipant,
  Audience,
  EventActivity,
  addActivity,
  deleteActivity,
  fetchActivities,
  fetchAllParticipants,
  joinActivity,
  leaveActivity,
  updateActivity,
} from '../../lib/events';
import { haptics } from '../../lib/haptics';
import { useThemeColors } from '../../theme';
import { Button, DateField, Sheet, TimeField, Touchable, formatTimeLabel } from '../ui';

/**
 * The programme: what is on, when, who it is for, and who has entered.
 *
 * WHY IT IS NOT JUST MORE TEXT. A celebration is a timetable — rangoli for the
 * children at four, tug of war for the men at five, housie for everyone after
 * the aarti. Written as a paragraph, none of it can be signed up for, and the
 * entry list becomes a WhatsApp thread and somebody with a notebook. Written
 * as rows, each one carries its own sign-up sheet and its own count.
 *
 * ANYONE MAY ENTER, WITHOUT ASKING. The committee sets the programme; it does
 * not approve entries. A sign-up that needs approving is a sign-up sheet
 * nobody uses.
 *
 * You enter a NAME, not yourself. The commonest entry by far is a parent
 * signing up an eight-year-old for the fancy dress, and that child has no
 * account — so the row records who is competing, separately from the account
 * that added them.
 */

const AUD_META: Record<Audience, { label: string; icon: string }> = {
  all: { label: 'Everyone', icon: 'people-outline' },
  kids: { label: 'Children', icon: 'happy-outline' },
  women: { label: 'Women', icon: 'woman-outline' },
  men: { label: 'Men', icon: 'man-outline' },
  mixed: { label: 'Mixed teams', icon: 'shuffle-outline' },
};

export function ProgrammeTab({
  eventId,
  communityId,
  eventDate,
  canManage,
}: {
  eventId: string;
  communityId: string;
  eventDate: string | null;
  canManage: boolean;
}) {
  const c = useThemeColors();
  const toast = useToast();
  const confirm = useConfirm();
  const { userId, profile } = useAuth();

  const [items, setItems] = useState<EventActivity[] | null>(null);
  const [people, setPeople] = useState<ActivityParticipant[]>([]);
  const [filter, setFilter] = useState<Audience | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<EventActivity | null>(null);
  const [joining, setJoining] = useState<EventActivity | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await fetchActivities(eventId);
      setItems(list);
      setPeople(await fetchAllParticipants(list.map((a) => a.id)));
    } catch {
      setItems([]);
    }
  }, [eventId]);
  useEffect(() => { load(); }, [load]);

  const byActivity = useMemo(() => {
    const m = new Map<string, ActivityParticipant[]>();
    for (const p of people) {
      const arr = m.get(p.activity_id) ?? [];
      arr.push(p);
      m.set(p.activity_id, arr);
    }
    return m;
  }, [people]);

  const remove = async (a: EventActivity) => {
    const entered = (byActivity.get(a.id) ?? []).length;
    const ok = await confirm({
      title: 'Remove this from the programme?',
      message: entered
        ? `"${a.title}" goes, and so do the ${entered} ${entered === 1 ? 'person' : 'people'} entered for it — they will be told it is off. To change the time or the venue, use Edit instead.`
        : `"${a.title}" comes off the programme. Nobody has entered for it.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    try { await deleteActivity(a.id); haptics.success(); load(); }
    catch { toast.show('Could not remove that'); }
  };

  const withdraw = async (p: ActivityParticipant) => {
    try { await leaveActivity(p.id); haptics.select(); load(); }
    catch { toast.show('Could not withdraw'); }
  };

  if (items === null) {
    return <View className="items-center py-10"><ActivityIndicator color={c.accent} /></View>;
  }

  const shown = filter ? items.filter((a) => a.audience === filter || a.audience === 'all') : items;
  // Only offer a filter for audiences that actually appear.
  const present = Array.from(new Set(items.map((a) => a.audience)));

  return (
    <View>
      {items.length === 0 ? (
        <View className="items-center px-6 py-10">
          <Ionicons name="calendar-outline" size={30} color={c.faint} />
          <Text className="font-sans-sb mt-3 text-[15px] text-ink">Nothing scheduled yet</Text>
          <Text className="font-sans mt-1 text-center text-[13px] leading-[19px]" style={{ color: c.subtle }}>
            {canManage
              ? 'Add the games, competitions and rituals so people know when to come down — and can put their name in.'
              : 'The committee will put the programme here.'}
          </Text>
        </View>
      ) : (
        <>
          {present.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              className="mb-3" contentContainerStyle={{ gap: 6 }}>
              {([null, ...present] as (Audience | null)[]).map((a) => {
                const on = filter === a;
                return (
                  <Touchable key={a ?? 'all-filter'} onPress={() => setFilter(a)}
                    accessibilityRole="button" accessibilityLabel={a ? AUD_META[a].label : 'Everything'}>
                    <View pointerEvents="none" className="rounded-full px-3.5 py-2"
                      style={{
                        backgroundColor: on ? c.accent : c.inset,
                        borderWidth: 1,
                        borderColor: on ? c.accent : c.line,
                      }}>
                      <Text className="font-sans-sb text-[12.5px]" style={{ color: on ? c.onAccent : c.muted }}>
                        {a ? AUD_META[a].label : 'Everything'}
                      </Text>
                    </View>
                  </Touchable>
                );
              })}
            </ScrollView>
          ) : null}

          {shown.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              participants={byActivity.get(a.id) ?? []}
              userId={userId}
              canManage={canManage}
              onJoin={() => setJoining(a)}
              onWithdraw={withdraw}
              onEdit={() => setEditingItem(a)}
              onDelete={() => remove(a)}
            />
          ))}
        </>
      )}

      {canManage ? (
        <View className="mt-2">
          <Button label="Add to the programme" icon="add" variant="outline" onPress={() => setAdding(true)} />
        </View>
      ) : null}

      <AddActivity
        visible={adding}
        eventId={eventId}
        communityId={communityId}
        eventDate={eventDate}
        userId={userId}
        nextOrder={items.length}
        onClose={() => setAdding(false)}
        onAdded={() => { setAdding(false); load(); }}
      />

      <AddActivity
        visible={editingItem !== null}
        existing={editingItem}
        eventId={eventId}
        communityId={communityId}
        eventDate={eventDate}
        userId={userId}
        nextOrder={items.length}
        onClose={() => setEditingItem(null)}
        onAdded={() => { setEditingItem(null); load(); }}
      />

      <JoinActivity
        activity={joining}
        userId={userId}
        defaultName={profile?.name ?? ''}
        defaultFlat={profile?.flat ?? ''}
        onClose={() => setJoining(null)}
        onJoined={() => { setJoining(null); load(); }}
      />
    </View>
  );
}

function ActivityCard({
  activity: a,
  participants,
  userId,
  canManage,
  onJoin,
  onWithdraw,
  onEdit,
  onDelete,
}: {
  activity: EventActivity;
  participants: ActivityParticipant[];
  userId: string | null;
  canManage: boolean;
  onJoin: () => void;
  onEdit: () => void;
  onWithdraw: (p: ActivityParticipant) => void;
  onDelete: () => void;
}) {
  const c = useThemeColors();
  const [showList, setShowList] = useState(false);

  const mine = participants.filter((p) => p.added_by === userId);
  const full = a.max_participants != null && participants.length >= a.max_participants;

  const when = [
    a.start_time ? formatTimeLabel(a.start_time.slice(0, 5)) : null,
    a.end_time ? formatTimeLabel(a.end_time.slice(0, 5)) : null,
  ].filter(Boolean).join(' – ');

  return (
    <View className="mb-3 card p-4">
      <View className="flex-row items-start gap-2">
        <View style={{ flex: 1 }}>
          <Text className="font-display-sb text-[16px] text-ink">{a.title}</Text>

          <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
            <View className="flex-row items-center gap-1">
              <Ionicons name={AUD_META[a.audience].icon as never} size={12} color={c.accent} />
              <Text className="font-sans text-[12px]" style={{ color: c.accent }}>
                {AUD_META[a.audience].label}
              </Text>
            </View>
            {when ? (
              <Text className="font-sans text-[12px]" style={{ color: c.subtle }}>· {when}</Text>
            ) : null}
            {a.venue ? (
              <Text className="font-sans text-[12px]" style={{ color: c.subtle }}>· {a.venue}</Text>
            ) : null}
          </View>

          {a.description ? (
            <Text className="font-sans mt-1.5 text-[13.5px] leading-[20px] text-ink">{a.description}</Text>
          ) : null}
        </View>

        {canManage ? (
          <View className="flex-row items-center gap-1.5">
            {/* Edit before delete: deleting drops everyone entered for it. */}
            <Touchable onPress={onEdit} accessibilityRole="button" accessibilityLabel="Edit this item">
              <View pointerEvents="none" className="h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: c.inset }}>
                <Ionicons name="create-outline" size={14} color={c.muted} />
              </View>
            </Touchable>
            <Touchable onPress={onDelete} accessibilityRole="button" accessibilityLabel="Remove from programme">
              <View pointerEvents="none" className="h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: c.inset }}>
                <Ionicons name="trash-outline" size={14} color={c.muted} />
              </View>
            </Touchable>
          </View>
        ) : null}
      </View>

      <View className="mt-3 flex-row items-center gap-2">
        <View style={{ flex: 1 }}>
          <Touchable
            onPress={() => setShowList((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="See who has entered"
          >
            <View pointerEvents="none" className="flex-row items-center gap-1.5">
              <Ionicons name="people" size={14} color={c.muted} />
              <Text className="font-sans-sb text-[12.5px]" style={{ color: c.muted }}>
                {participants.length}
                {a.max_participants != null ? ` of ${a.max_participants}` : ''} entered
              </Text>
              <Ionicons name={showList ? 'chevron-up' : 'chevron-down'} size={13} color={c.faint} />
            </View>
          </Touchable>
        </View>

        {full && mine.length === 0 ? (
          <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: c.inset }}>
            <Text className="font-sans-sb text-[12.5px]" style={{ color: c.muted }}>Full</Text>
          </View>
        ) : (
          <Touchable onPress={onJoin} accessibilityRole="button" accessibilityLabel={`Enter ${a.title}`}>
            <View pointerEvents="none" className="rounded-full px-3.5 py-1.5"
              style={{ backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accentLine }}>
              <Text className="font-sans-sb text-[12.5px]" style={{ color: c.accent }}>
                {mine.length ? 'Add another' : 'Take part'}
              </Text>
            </View>
          </Touchable>
        )}
      </View>

      {showList ? (
        participants.length === 0 ? (
          <Text className="font-sans mt-2.5 text-[12.5px]" style={{ color: c.faint }}>
            Nobody yet — be the first.
          </Text>
        ) : (
          <View className="mt-2.5 gap-1.5">
            {participants.map((p) => (
              <View key={p.id} className="flex-row items-center gap-2">
                <Text className="flex-1 font-sans text-[13px] text-ink">
                  {p.participant_name}
                  {p.flat ? <Text style={{ color: c.faint }}> · {p.flat}</Text> : null}
                </Text>
                {p.added_by === userId || canManage ? (
                  <Touchable onPress={() => onWithdraw(p)}
                    accessibilityRole="button" accessibilityLabel={`Withdraw ${p.participant_name}`}>
                    <View pointerEvents="none" className="h-7 w-7 items-center justify-center rounded-full"
                      style={{ backgroundColor: c.inset }}>
                      <Ionicons name="close" size={12} color={c.muted} />
                    </View>
                  </Touchable>
                ) : null}
              </View>
            ))}
          </View>
        )
      ) : null}
    </View>
  );
}

/**
 * Add something to the programme, or correct it.
 *
 * `updateActivity` has existed unused since the tab was built, so moving the
 * tug of war from five o'clock to six meant deleting it — and participants
 * cascade, so everyone who had entered was silently dropped.
 */
function AddActivity({
  visible,
  eventId,
  communityId,
  eventDate,
  userId,
  nextOrder,
  onClose,
  onAdded,
  existing,
}: {
  visible: boolean;
  eventId: string;
  communityId: string;
  eventDate: string | null;
  userId: string | null;
  nextOrder: number;
  onClose: () => void;
  onAdded: () => void;
  existing?: EventActivity | null;
}) {
  const c = useThemeColors();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [venue, setVenue] = useState('');
  const [cap, setCap] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(existing?.title ?? '');
    setDescription(existing?.description ?? '');
    setAudience(existing?.audience ?? 'all');
    setDate(existing ? existing.activity_date : eventDate);
    setStart(existing?.start_time ?? null);
    setEnd(existing?.end_time ?? null);
    setVenue(existing?.venue ?? '');
    setCap(existing?.max_participants != null ? String(existing.max_participants) : '');
  }, [visible, eventDate, existing]);

  const save = async () => {
    if (busy || !userId) return;
    if (!title.trim()) { toast.show('What is it called?'); return; }
    if (start && end && end <= start) { toast.show('It cannot finish before it starts'); return; }

    setBusy(true);
    try {
      if (existing) {
        await updateActivity(existing.id, {
          title: title.trim(),
          description: description.trim() || null,
          audience,
          activity_date: date,
          start_time: start,
          end_time: end,
          venue: venue.trim() || null,
          max_participants: cap.trim() ? Number(cap) : null,
        });
      } else {
        await addActivity({
          eventId, communityId, createdBy: userId,
          title, description, audience,
          activityDate: date, startTime: start, endTime: end,
          venue, maxParticipants: cap.trim() ? Number(cap) : null,
          sortOrder: nextOrder,
        });
      }
      haptics.success();
      onAdded();
    } catch (e) {
      console.error(e);
      toast.show(existing ? 'Could not save that change' : 'Could not add that');
    } finally {
      setBusy(false);
    }
  };

  const input = 'rounded-xl px-3 py-2.5 text-[15px] text-ink';

  return (
    <Sheet visible={visible} onClose={onClose} title={existing ? 'Edit this item' : 'Add to the programme'}>
      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <TextInput
            value={title} onChangeText={setTitle}
            placeholder="e.g. Fancy dress competition" placeholderTextColor={c.faint}
            className={input} style={{ backgroundColor: c.inset, outline: 'none' } as never}
          />

          <View>
            <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Who is it for</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {AUDIENCES.map((a) => {
                const on = audience === a.key;
                return (
                  <Touchable key={a.key} onPress={() => setAudience(a.key)}
                    accessibilityRole="button" accessibilityLabel={a.label}>
                    <View pointerEvents="none" className="flex-row items-center gap-1.5 rounded-full px-3 py-2"
                      style={{
                        backgroundColor: on ? c.accent : c.inset,
                        borderWidth: 1,
                        borderColor: on ? c.accent : c.line,
                      }}>
                      <Ionicons name={a.icon as never} size={13} color={on ? c.onAccent : c.muted} />
                      <Text className="font-sans-sb text-[12.5px]" style={{ color: on ? c.onAccent : c.muted }}>
                        {a.label}
                      </Text>
                    </View>
                  </Touchable>
                );
              })}
            </View>
          </View>

          <DateField label="Day" value={date} onChange={setDate} placeholder="Same as the celebration" />

          <View className="flex-row gap-2">
            <View style={{ flex: 1 }}>
              <TimeField label="Starts" value={start} onChange={setStart} placeholder="Time" />
            </View>
            <View style={{ flex: 1 }}>
              <TimeField label="Ends" value={end} onChange={setEnd} placeholder="Time" />
            </View>
          </View>

          <TextInput
            value={venue} onChangeText={setVenue}
            placeholder="Where — e.g. Clubhouse lawn" placeholderTextColor={c.faint}
            className={input} style={{ backgroundColor: c.inset, outline: 'none' } as never}
          />

          <TextInput
            value={cap} onChangeText={setCap} keyboardType="number-pad"
            placeholder="Limit on entries (optional)" placeholderTextColor={c.faint}
            className={input} style={{ backgroundColor: c.inset, outline: 'none' } as never}
          />

          <TextInput
            value={description} onChangeText={setDescription}
            placeholder="Rules, age groups, what to bring…" placeholderTextColor={c.faint}
            multiline
            className={input}
            style={{ backgroundColor: c.inset, minHeight: 84, textAlignVertical: 'top', outline: 'none' } as never}
          />

          <Button label={busy ? 'Adding…' : 'Add'} onPress={save} disabled={busy} />
        </View>
      </ScrollView>
    </Sheet>
  );
}

function JoinActivity({
  activity,
  userId,
  defaultName,
  defaultFlat,
  onClose,
  onJoined,
}: {
  activity: EventActivity | null;
  userId: string | null;
  defaultName: string;
  defaultFlat: string;
  onClose: () => void;
  onJoined: () => void;
}) {
  const c = useThemeColors();
  const toast = useToast();

  const [name, setName] = useState('');
  const [flat, setFlat] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!activity) return;
    // Prefilled with the resident's own name, because entering yourself is the
    // second commonest case and typing your own name is a silly thing to ask.
    setName(defaultName);
    setFlat(defaultFlat);
    setNote('');
  }, [activity, defaultName, defaultFlat]);

  const save = async () => {
    if (busy || !activity || !userId) return;
    if (!name.trim()) { toast.show('Whose name?'); return; }
    setBusy(true);
    try {
      await joinActivity({ activityId: activity.id, userId, participantName: name, flat, note });
      haptics.success();
      onJoined();
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? '');
      toast.show(
        msg.includes('full') ? 'That filled up just now'
          : msg.includes('duplicate') || msg.includes('unique') ? 'Already entered'
            : 'Could not enter — try again',
      );
    } finally {
      setBusy(false);
    }
  };

  const input = 'rounded-xl px-3 py-2.5 text-[15px] text-ink';

  return (
    <Sheet visible={!!activity} onClose={onClose} title={activity?.title ?? 'Take part'}>
      <View className="gap-3">
        <Text className="font-sans text-[13px] leading-[19px]" style={{ color: c.subtle }}>
          Entering somebody else — a child, or a family member? Put their name here.
        </Text>

        <TextInput
          value={name} onChangeText={setName}
          placeholder="Name of whoever is taking part" placeholderTextColor={c.faint}
          className={input} style={{ backgroundColor: c.inset, outline: 'none' } as never}
        />
        <TextInput
          value={flat} onChangeText={setFlat}
          placeholder="Flat" placeholderTextColor={c.faint}
          className={input} style={{ backgroundColor: c.inset, outline: 'none' } as never}
        />
        <TextInput
          value={note} onChangeText={setNote}
          placeholder="Anything to add — age, team, size (optional)" placeholderTextColor={c.faint}
          className={input} style={{ backgroundColor: c.inset, outline: 'none' } as never}
        />

        <Button label={busy ? 'Entering…' : 'Confirm'} onPress={save} disabled={busy} />
      </View>
    </Sheet>
  );
}
