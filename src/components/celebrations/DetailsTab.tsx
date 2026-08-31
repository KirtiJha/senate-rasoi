import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../context/auth';
import { useConfirm } from '../../context/confirm';
import { useToast } from '../../context/toast';
import {
  EventNote,
  addEventNote,
  deleteEventNote,
  fetchEventNotes,
  updateEventNote,
  uploadNotePhoto,
} from '../../lib/events';
import { haptics } from '../../lib/haptics';
import { openPhotoPicker } from '../../lib/photo';
import { useThemeColors } from '../../theme';
import { Button, Sheet, Touchable } from '../ui';

/**
 * The written half of a celebration: the schedule, what is still needed, who
 * sponsored what, the thank-you note.
 *
 * WHY THIS EXISTS. All of it currently lives in a WhatsApp forward that scrolls
 * away by evening, cannot be corrected once sent, and is invisible to anyone
 * who joined the group late. A resident who wants to know when the aarti is
 * should not have to scroll through two hundred messages to find out.
 *
 * Anyone in the society can read these. Only the committee can write them —
 * the same rule as the budget, because a schedule any resident could edit is a
 * schedule nobody can rely on.
 *
 * Photos sit with their note rather than in a gallery of their own: a poster, a
 * sponsor's card and a route map each mean something next to their words and
 * very little apart from them.
 */

const MAX_PHOTOS = 4;

export function DetailsTab({
  eventId,
  communityId,
  canManage,
}: {
  eventId: string;
  communityId: string;
  canManage: boolean;
}) {
  const c = useThemeColors();
  const toast = useToast();
  const confirm = useConfirm();
  const { userId } = useAuth();

  const [notes, setNotes] = useState<EventNote[] | null>(null);
  const [editing, setEditing] = useState<EventNote | 'new' | null>(null);

  const load = useCallback(async () => {
    try {
      setNotes(await fetchEventNotes(eventId));
    } catch {
      setNotes([]);
    }
  }, [eventId]);
  useEffect(() => { load(); }, [load]);

  const remove = async (n: EventNote) => {
    const ok = await confirm({
      title: 'Delete this section?',
      message: n.title ?? 'This section will be removed for everyone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteEventNote(n.id);
      haptics.success();
      load();
    } catch {
      toast.show('Could not delete that');
    }
  };

  if (notes === null) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <View>
      {notes.length === 0 ? (
        <View className="items-center px-6 py-10">
          <Ionicons name="document-text-outline" size={30} color={c.faint} />
          <Text className="font-sans-sb mt-3 text-[15px] text-ink">Nothing written yet</Text>
          <Text className="font-sans mt-1 text-center text-[13px] leading-[19px]" style={{ color: c.subtle }}>
            {canManage
              ? 'Add the schedule, what is still needed, or a thank-you to the sponsors — with photos if you have them.'
              : 'The committee will put the schedule and details here.'}
          </Text>
        </View>
      ) : (
        notes.map((n) => (
          <NoteCard
            key={n.id}
            note={n}
            canManage={canManage}
            onEdit={() => setEditing(n)}
            onDelete={() => remove(n)}
          />
        ))
      )}

      {canManage ? (
        <View className="mt-2">
          <Button label="Add a section" icon="add" variant="outline" onPress={() => setEditing('new')} />
        </View>
      ) : null}

      <NoteEditor
        open={editing !== null}
        note={editing === 'new' ? null : editing}
        eventId={eventId}
        communityId={communityId}
        userId={userId}
        nextOrder={notes.length}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    </View>
  );
}

function NoteCard({
  note,
  canManage,
  onEdit,
  onDelete,
}: {
  note: EventNote;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const c = useThemeColors();

  return (
    <View className="mb-3 card p-4">
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          {note.title ? (
            <Text className="font-display-sb text-[16px] text-ink">{note.title}</Text>
          ) : null}
          {note.body ? (
            <Text className="font-sans mt-1 text-[14px] leading-[21px] text-ink">{note.body}</Text>
          ) : null}
        </View>

        {canManage ? (
          <View className="flex-row gap-1">
            <Touchable onPress={onEdit} accessibilityRole="button" accessibilityLabel="Edit section">
              <View
                pointerEvents="none"
                className="h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: c.inset }}
              >
                <Ionicons name="pencil" size={14} color={c.muted} />
              </View>
            </Touchable>
            <Touchable onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete section">
              <View
                pointerEvents="none"
                className="h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: c.inset }}
              >
                <Ionicons name="trash-outline" size={14} color={c.muted} />
              </View>
            </Touchable>
          </View>
        ) : null}
      </View>

      {note.photo_urls.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3"
          contentContainerStyle={{ gap: 8 }}
        >
          {note.photo_urls.map((url) => (
            <Image
              key={url}
              source={{ uri: url }}
              style={{ width: 140, height: 140, borderRadius: 12, backgroundColor: c.inset }}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function NoteEditor({
  open,
  note,
  eventId,
  communityId,
  userId,
  nextOrder,
  onClose,
  onSaved,
}: {
  open: boolean;
  note: EventNote | null;
  eventId: string;
  communityId: string;
  userId: string | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = useThemeColors();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  // Existing public URLs and freshly picked local URIs live in one list; the
  // save step tells them apart, so removal and ordering work identically for
  // both and nobody has to think about which is which.
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? '');
    setBody(note?.body ?? '');
    setPhotos(note?.photo_urls ?? []);
  }, [open, note]);

  const pick = async () => {
    if (photos.length >= MAX_PHOTOS) {
      toast.show(`Up to ${MAX_PHOTOS} photos`);
      return;
    }
    const r = await openPhotoPicker({ mediaTypes: ['images'], quality: 0.8 });
    if (r.canceled || !r.assets?.[0]?.uri) return;
    setPhotos((p) => [...p, r.assets[0].uri]);
  };

  const save = async () => {
    if (busy) return;
    if (!userId) {
      toast.show('Sign in first');
      return;
    }
    if (!title.trim() && !body.trim() && photos.length === 0) {
      toast.show('Add a heading, some words, or a photo');
      return;
    }
    setBusy(true);
    try {
      // The note must exist before its photos can be filed under its id, so a
      // new one is created first and then updated with the uploaded URLs.
      const id =
        note?.id ??
        (await addEventNote({
          eventId,
          communityId,
          userId,
          title: title || null,
          body: body || null,
          sortOrder: note?.sort_order ?? nextOrder,
        }));

      const urls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        urls.push(/^https?:/.test(p) ? p : await uploadNotePhoto(p, id, i));
      }

      await updateEventNote(id, {
        title: title.trim() || null,
        body: body.trim() || null,
        photo_urls: urls,
      });

      haptics.success();
      onSaved();
    } catch (e) {
      console.error(e);
      toast.show('Could not save that — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={open} onClose={onClose} title={note ? 'Edit section' : 'Add a section'}>
      <View className="gap-3">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Heading — e.g. Celebration schedule"
          placeholderTextColor={c.faint}
          maxLength={80}
          className="rounded-xl px-3 py-2.5 text-[15px] text-ink"
          style={{ backgroundColor: c.inset, outline: 'none' } as never}
        />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Details — timings, what is needed, who is sponsoring…"
          placeholderTextColor={c.faint}
          multiline
          maxLength={4000}
          className="rounded-xl px-3 py-2.5 text-[15px] text-ink"
          style={{ backgroundColor: c.inset, minHeight: 140, textAlignVertical: 'top', outline: 'none' } as never}
        />

        <View className="flex-row flex-wrap gap-2">
          {photos.map((p, i) => (
            <View key={`${p}-${i}`}>
              <Image
                source={{ uri: p }}
                style={{ width: 78, height: 78, borderRadius: 10, backgroundColor: c.inset }}
              />
              <Touchable
                onPress={() => setPhotos((cur) => cur.filter((_, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
              >
                <View
                  pointerEvents="none"
                  className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full"
                  style={{ backgroundColor: c.ink }}
                >
                  <Ionicons name="close" size={13} color={c.surface} />
                </View>
              </Touchable>
            </View>
          ))}

          {photos.length < MAX_PHOTOS ? (
            <Touchable onPress={pick} accessibilityRole="button" accessibilityLabel="Add a photo">
              <View
                pointerEvents="none"
                className="items-center justify-center rounded-[10px]"
                style={{ width: 78, height: 78, backgroundColor: c.inset, borderWidth: 1, borderColor: c.line }}
              >
                <Ionicons name="image-outline" size={20} color={c.muted} />
              </View>
            </Touchable>
          ) : null}
        </View>

        <Button label={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy} />
      </View>
    </Sheet>
  );
}
