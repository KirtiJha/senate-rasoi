import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../context/auth';
import { useConfirm } from '../../context/confirm';
import { useToast } from '../../context/toast';
import {
  EventTask,
  EventTeamMember,
  TaskStatus,
  TaskUpdate,
  addTask,
  addTaskUpdate,
  deleteTask,
  fetchTaskUpdates,
  fetchTasks,
  updateTask,
} from '../../lib/events';
import { haptics } from '../../lib/haptics';
import { openPhotoPicker } from '../../lib/photo';
import { uploadContentPhoto } from '../../lib/photoUpload';
import { useThemeColors } from '../../theme';
import { Avatar, Button, Sheet, Touchable } from '../ui';

/**
 * Who is doing what, and how far along it is.
 *
 * PROGRESS IS A THREAD, NOT A DROPDOWN. "Sound system — done" tells you nothing
 * when the speakers turn out to be half the size promised. Each update carries
 * what changed, optionally a photo of it, and the status it moved to — so the
 * history survives the task being ticked off, and the person who booked the
 * pandal can prove what they booked.
 *
 * The assignee posts updates too, not only the committee. Someone handed a job
 * who cannot report on it will report in WhatsApp instead, which is the thing
 * this exists to replace.
 */

const STATUS_META: Record<TaskStatus, { label: string; icon: string; tone: 'muted' | 'accent' | 'warn' | 'done' }> = {
  todo:    { label: 'To do',   icon: 'ellipse-outline',       tone: 'muted' },
  doing:   { label: 'Doing',   icon: 'time-outline',          tone: 'accent' },
  blocked: { label: 'Stuck',   icon: 'alert-circle-outline',  tone: 'warn' },
  done:    { label: 'Done',    icon: 'checkmark-circle',      tone: 'done' },
};

export function TasksTab({
  eventId,
  communityId,
  team,
  canManage,
}: {
  eventId: string;
  communityId: string;
  team: EventTeamMember[];
  canManage: boolean;
}) {
  const c = useThemeColors();
  const toast = useToast();
  const confirm = useConfirm();
  const { userId } = useAuth();

  const [tasks, setTasks] = useState<EventTask[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingTask, setEditingTask] = useState<EventTask | null>(null);
  const [open, setOpen] = useState<EventTask | null>(null);

  const load = useCallback(async () => {
    try { setTasks(await fetchTasks(eventId)); } catch { setTasks([]); }
  }, [eventId]);
  useEffect(() => { load(); }, [load]);

  const tone = (t: TaskStatus) =>
    t === 'done' ? c.accent : t === 'blocked' ? c.danger : t === 'doing' ? c.highlightInk : c.muted;

  const remove = async (t: EventTask) => {
    const ok = await confirm({
      title: 'Delete this task?',
      message: `"${t.title}" and every update posted on it go with it. To fix a name or hand it to somebody else, use Edit instead.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setTasks((prev) => (prev ?? []).filter((x) => x.id !== t.id));
    try { await deleteTask(t.id); } catch { toast.show('Could not delete'); load(); }
  };

  if (tasks === null) return <View className="items-center py-10"><ActivityIndicator color={c.accent} /></View>;

  const done = tasks.filter((t) => t.status === 'done').length;

  return (
    <View>
      {tasks.length > 0 ? (
        <View className="mb-3 flex-row items-center gap-2">
          <View className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: c.inset }}>
            <View style={{ width: `${Math.round((done / tasks.length) * 100)}%`, height: '100%', backgroundColor: c.accent }} />
          </View>
          <Text className="text-[12px] font-sans-sb" style={{ color: c.muted }}>{done}/{tasks.length}</Text>
        </View>
      ) : null}

      {tasks.length === 0 ? (
        <View className="card items-center px-5 py-7">
          <Ionicons name="checkbox-outline" size={28} color={c.subtle} />
          <Text className="mt-2 font-sans-sb text-[14.5px] text-ink">Nothing assigned yet</Text>
          <Text className="font-sans mt-1 text-center text-[13px] leading-[19px]" style={{ color: c.subtle }}>
            Break the celebration into jobs — pandal, prasad, sound, prizes — and give each one an owner
            and a date.
          </Text>
        </View>
      ) : (
        <View className="overflow-hidden card">
          {tasks.map((t, i) => {
            const overdue = t.status !== 'done' && t.due_date && t.due_date < new Date().toISOString().slice(0, 10);
            return (
              <View key={t.id}>
                {i > 0 ? <View className="ml-4 h-px bg-line" /> : null}
                <Touchable haptic={null} onPress={() => setOpen(t)} accessibilityRole="button" accessibilityLabel={t.title}>
                  <View pointerEvents="none" className="flex-row items-center gap-3 px-4 py-3">
                    <Ionicons name={STATUS_META[t.status].icon as never} size={19} color={tone(t.status)} />
                    <View className="min-w-0 flex-1">
                      <Text
                        className="font-sans-md text-[14.5px] text-ink"
                        numberOfLines={1}
                        style={t.status === 'done' ? { textDecorationLine: 'line-through', color: c.subtle } : undefined}
                      >
                        {t.title}
                      </Text>
                      <Text className="mt-0.5 text-[11.5px] font-sans" numberOfLines={1}
                        style={{ color: overdue ? c.danger : c.subtle }}>
                        {t.assignee?.name ?? 'Unassigned'}
                        {t.due_date ? ` · ${overdue ? 'overdue — ' : ''}${formatDay(t.due_date)}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={c.faint} />
                  </View>
                </Touchable>
              </View>
            );
          })}
        </View>
      )}

      {canManage ? (
        <View className="mt-3">
          <Button label="Add a task" icon="add" variant="outline" fullWidth onPress={() => setAdding(true)} />
        </View>
      ) : null}

      <AddTask
        visible={adding}
        onClose={() => setAdding(false)}
        eventId={eventId}
        communityId={communityId}
        team={team}
        onAdded={() => { setAdding(false); load(); }}
      />

      <AddTask
        visible={editingTask !== null}
        existing={editingTask}
        onClose={() => setEditingTask(null)}
        eventId={eventId}
        communityId={communityId}
        team={team}
        onAdded={() => { setEditingTask(null); load(); }}
      />

      <TaskDetail
        task={open}
        onClose={() => { setOpen(null); load(); }}
        canManage={canManage}
        isAssignee={!!open && open.assignee_id === userId}
        onEdit={open ? () => { const t = open; setOpen(null); setEditingTask(t); } : undefined}
        onDelete={open ? () => { const t = open; setOpen(null); remove(t); } : undefined}
      />
    </View>
  );
}

/**
 * Add a task, or correct one.
 *
 * `updateTask` has existed unused since the tab was built, so the only way to
 * fix a typo'd title or hand a job to somebody else was Delete — and
 * event_task_updates cascades, so correcting the name of a task threw away
 * every photo and note of progress on it.
 */
function AddTask({
  visible, onClose, eventId, communityId, team, onAdded, existing,
}: {
  visible: boolean; onClose: () => void; eventId: string; communityId: string;
  team: EventTeamMember[]; onAdded: () => void; existing?: EventTask | null;
}) {
  const c = useThemeColors();
  const toast = useToast();
  const { userId } = useAuth();
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  // undefined = leave the date as it is (edit only); null = no date.
  const [days, setDays] = useState<number | null | undefined>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(existing?.title ?? '');
    setAssignee(existing?.assignee_id ?? null);
    setDays(existing ? undefined : null);
  }, [visible, existing]);

  const save = async () => {
    if (!title.trim() || busy || !userId) return;
    setBusy(true);
    try {
      const due = days === undefined ? undefined
        : days === null ? null
        : new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      if (existing) {
        await updateTask(existing.id, {
          title: title.trim(),
          assignee_id: assignee,
          ...(due === undefined ? {} : { due_date: due }),
        });
      } else {
        await addTask({ eventId, communityId, createdBy: userId, title, assigneeId: assignee, dueDate: due ?? null });
      }
      haptics.success();
      setTitle(''); setAssignee(null); setDays(null);
      onAdded();
    } catch {
      toast.show(existing ? 'Could not save that change' : 'Could not add that task');
    } finally { setBusy(false); }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={existing ? 'Edit task' : 'Add a task'}>
      <View className="px-4 pb-2">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Book the pandal"
          placeholderTextColor={c.faint}
          className="rounded-xl px-3.5 py-3 text-[15px] text-ink"
          style={{ backgroundColor: c.inset, outline: 'none' } as never}
        />

        <Text className="mb-2 mt-4 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Who</Text>
        <View className="flex-row flex-wrap gap-2">
          {team.map((m) => {
            const on = assignee === m.user_id;
            return (
              <Touchable key={m.user_id} haptic={null}
                onPress={() => { haptics.select(); setAssignee(on ? null : m.user_id); }}
                accessibilityRole="button" accessibilityState={{ selected: on }}
                accessibilityLabel={m.profile?.name ?? 'Member'}>
                <View pointerEvents="none" className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1.5"
                  style={{ backgroundColor: on ? c.accentSoft : c.inset, borderWidth: 1, borderColor: on ? c.accentLine : 'transparent' }}>
                  <Avatar name={m.profile?.name ?? '?'} size={18} />
                  <Text className="text-[12.5px] font-sans-md" style={{ color: on ? c.accent : c.muted }}>
                    {m.profile?.name ?? 'Member'}
                  </Text>
                </View>
              </Touchable>
            );
          })}
        </View>

        {/* Relative, not a date picker. "In a week" is how a committee actually
            talks about a deadline three weeks before the festival. */}
        <Text className="mb-2 mt-4 text-[11px] font-sans-sb uppercase tracking-wider text-muted">By when</Text>
        <View className="flex-row gap-2">
          {([
            ...(existing?.due_date ? [['Keep', undefined] as [string, undefined]] : []),
            ['Today', 0], ['3 days', 3], ['A week', 7], ['2 weeks', 14],
          ] as [string, number | undefined][]).map(([label, d]) => {
            const on = days === (d ?? null) || (d === undefined && days === undefined);
            return (
              <View key={label as string} style={{ flex: 1 }}>
                <Touchable haptic={null} onPress={() => { haptics.select(); setDays(on ? null : d); }}
                  accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label}>
                  <View pointerEvents="none" className="items-center rounded-xl py-2"
                    style={{ backgroundColor: on ? c.accent : c.inset }}>
                    <Text className="text-[12.5px] font-sans-sb" style={{ color: on ? c.onAccent : c.muted }}>{label}</Text>
                  </View>
                </Touchable>
              </View>
            );
          })}
        </View>

        <View className="mt-5">
          <Button
            label={busy ? 'Saving…' : existing ? 'Save changes' : 'Add task'}
            fullWidth
            loading={busy}
            onPress={save}
          />
        </View>
      </View>
    </Sheet>
  );
}

function TaskDetail({
  task, onClose, canManage, isAssignee, onEdit, onDelete,
}: {
  task: EventTask | null; onClose: () => void;
  canManage: boolean; isAssignee: boolean; onEdit?: () => void; onDelete?: () => void;
}) {
  const c = useThemeColors();
  const toast = useToast();
  const { userId } = useAuth();
  const [updates, setUpdates] = useState<TaskUpdate[] | null>(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!task) return;
    try { setUpdates(await fetchTaskUpdates(task.id)); } catch { setUpdates([]); }
  }, [task]);
  useEffect(() => { load(); }, [load]);

  if (!task) return null;
  const mayPost = canManage || isAssignee;

  const pick = async () => {
    const res = await openPhotoPicker({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) setPhoto(res.assets[0].uri);
  };

  const post = async (statusAfter?: TaskStatus) => {
    if (!userId || busy) return;
    if (!note.trim() && !photo && !statusAfter) return;
    setBusy(true);
    try {
      let photoUrl: string | null = null;
      if (photo) {
        // A failed photo must not lose the words. Upload first, and carry on
        // without it if the upload fails.
        try { photoUrl = await uploadContentPhoto(photo, `event-tasks/${task.id}/${Date.now()}`); }
        catch { toast.show('Photo did not upload — posting the note'); }
      }
      await addTaskUpdate({ taskId: task.id, authorId: userId, note, photoUrl, statusAfter });
      haptics.success();
      setNote(''); setPhoto(null);
      load();
    } catch {
      toast.show('Could not post that update');
    } finally { setBusy(false); }
  };

  return (
    <Sheet visible={!!task} onClose={onClose} title={task.title}>
      <View className="px-4 pb-2">
        <Text className="text-[12.5px] font-sans" style={{ color: c.subtle }}>
          {task.assignee?.name ?? 'Unassigned'}
          {task.due_date ? ` · due ${formatDay(task.due_date)}` : ''} · {STATUS_META[task.status].label}
        </Text>
        {task.detail ? (
          <Text className="font-sans mt-2 text-[14px] leading-5 text-ink">{task.detail}</Text>
        ) : null}

        {/* The thread */}
        <View className="mt-4 gap-3">
          {updates === null ? <ActivityIndicator color={c.accent} /> : updates.length === 0 ? (
            <Text className="font-sans text-[13px]" style={{ color: c.subtle }}>No updates yet.</Text>
          ) : updates.map((u) => (
            <View key={u.id} className="rounded-xl p-3" style={{ backgroundColor: c.inset }}>
              <Text className="text-[12px] font-sans-sb text-ink">
                {u.author?.name ?? 'Someone'}
                {u.status_after ? (
                  <Text style={{ color: c.accent }}> · moved to {STATUS_META[u.status_after].label.toLowerCase()}</Text>
                ) : null}
              </Text>
              {u.note ? <Text className="font-sans mt-1 text-[13.5px] leading-5 text-ink">{u.note}</Text> : null}
              {u.photo_url ? (
                <Image source={{ uri: u.photo_url }} style={{ width: '100%', height: 160, borderRadius: 10, marginTop: 8 }} resizeMode="cover" />
              ) : null}
            </View>
          ))}
        </View>

        {mayPost ? (
          <View className="mt-4">
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="What changed?"
              placeholderTextColor={c.faint}
              multiline
              className="rounded-xl px-3.5 py-3 text-[14px] text-ink"
              style={{ backgroundColor: c.inset, minHeight: 60, outline: 'none' } as never}
            />

            {photo ? (
              <Image source={{ uri: photo }} style={{ width: '100%', height: 120, borderRadius: 10, marginTop: 8 }} resizeMode="cover" />
            ) : null}

            <View className="mt-2 flex-row gap-2">
              <Touchable haptic={null} onPress={pick} accessibilityRole="button" accessibilityLabel="Add a photo">
                <View pointerEvents="none" className="flex-row items-center gap-1.5 rounded-xl px-3 py-2" style={{ backgroundColor: c.inset }}>
                  <Ionicons name="camera-outline" size={15} color={c.muted} />
                  <Text className="text-[12.5px] font-sans-sb" style={{ color: c.muted }}>{photo ? 'Change' : 'Photo'}</Text>
                </View>
              </Touchable>
              <View style={{ flex: 1 }}>
                <Button label={busy ? 'Posting…' : 'Post update'} size="sm" fullWidth loading={busy} onPress={() => post()} />
              </View>
            </View>

            <View className="mt-3 flex-row gap-2">
              {(['doing', 'blocked', 'done'] as TaskStatus[]).map((st) => (
                <View key={st} style={{ flex: 1 }}>
                  <Touchable haptic={null} onPress={() => post(st)} disabled={busy}
                    accessibilityRole="button" accessibilityLabel={`Mark ${STATUS_META[st].label}`}>
                    <View pointerEvents="none" className="items-center rounded-xl py-2"
                      style={{ backgroundColor: task.status === st ? c.accentSoft : c.inset }}>
                      <Text className="text-[12.5px] font-sans-sb"
                        style={{ color: task.status === st ? c.accent : c.muted }}>
                        {STATUS_META[st].label}
                      </Text>
                    </View>
                  </Touchable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {canManage ? (
          <View className="mt-4 flex-row gap-2">
            {onEdit ? (
              <View style={{ flex: 1 }}>
                <Button label="Edit" variant="outline" icon="create-outline" fullWidth onPress={onEdit} />
              </View>
            ) : null}
            {onDelete ? (
              <View style={{ flex: 1 }}>
                {/* Deleting takes the whole update thread with it — which is
                    why "Edit" sits beside it rather than behind it. */}
                <Button label="Delete task" variant="ghost" fullWidth onPress={onDelete} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

function formatDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return iso; }
}
