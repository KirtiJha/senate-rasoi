import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../../context/auth';
import { useToast } from '../../../context/toast';
import { SocietyEvent, fetchEvent, updateEvent, uploadEventCover } from '../../../lib/events';
import { haptics } from '../../../lib/haptics';
import { openPhotoPicker } from '../../../lib/photo';
import { useThemeColors } from '../../../theme';
import {
  Button,
  Container,
  DateField,
  ErrorState,
  KeyboardAvoider,
  ScreenHeader,
  TimeField,
  Touchable,
} from '../../../components/ui';

/**
 * Everything about a celebration that is not money, tasks or the programme.
 *
 * WHY THIS EXISTS AT ALL. Until now a celebration could be created and then
 * never corrected: the only thing an organiser could change afterwards was its
 * status. A date typed wrong stayed wrong, the venue could not be added once
 * it was decided, and `cover_photo_url` sat in the schema with nothing able to
 * write it — so every celebration was headed by a blank space.
 *
 * The date now has a picker and the day has a start and an end, because
 * "31 August" never told anybody when to come down. That is why the timings
 * ended up typed into a free-text note, which is the WhatsApp forward this was
 * supposed to replace.
 */
export default function EditEventScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAdmin } = useAuth();

  const [event, setEvent] = useState<SocietyEvent | null | 'missing'>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [venue, setVenue] = useState('');
  const [budget, setBudget] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const e = await fetchEvent(id);
      if (!e) { setEvent('missing'); return; }
      setEvent(e);
      setTitle(e.title);
      setDescription(e.description ?? '');
      setDate(e.event_date);
      // Postgres hands back 'HH:MM:SS'; the picker speaks 'HH:MM'.
      setStart(e.start_time ? e.start_time.slice(0, 5) : null);
      setEnd(e.end_time ? e.end_time.slice(0, 5) : null);
      setVenue(e.venue ?? '');
      setBudget(e.budget_amount ? String(Math.round(Number(e.budget_amount))) : '');
      setCover(e.cover_photo_url);
    } catch {
      setEvent('missing');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const pickCover = async () => {
    const r = await openPhotoPicker({ mediaTypes: ['images'], quality: 0.85 });
    if (r.canceled || !r.assets?.[0]?.uri) return;
    setCover(r.assets[0].uri);
  };

  const save = async () => {
    if (busy || !id) return;
    if (!title.trim()) { toast.show('Give it a name'); return; }
    if (start && end && end <= start) { toast.show('It cannot finish before it starts'); return; }

    setBusy(true);
    try {
      // A freshly picked photo is a local file; an untouched one is already a
      // public URL and must not be re-uploaded.
      const coverUrl = cover && !/^https?:/.test(cover) ? await uploadEventCover(cover, id) : cover;

      await updateEvent(id, {
        title: title.trim(),
        description: description.trim() || null,
        event_date: date,
        start_time: start,
        end_time: end,
        venue: venue.trim() || null,
        budget_amount: budget.trim() ? Number(budget) : null,
        cover_photo_url: coverUrl,
      });
      haptics.success();
      toast.show('Saved');
      router.back();
    } catch (e) {
      console.error(e);
      toast.show('Could not save — try again');
    } finally {
      setBusy(false);
    }
  };

  if (event === null) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }
  if (event === 'missing') {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader title="Edit" showBack backHref="/events" />
        <ErrorState message="This celebration is not available." />
      </View>
    );
  }

  const label = 'mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted';
  const input = 'mb-4 rounded-2xl border border-line px-3.5 py-3 text-[15px] text-ink';

  return (
    <KeyboardAvoider>
      <ScreenHeader title="Edit celebration" showBack backHref={`/events/${id}`} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* The picture that heads the celebration. First thing on the form
              because it is the first thing anybody sees on the screen. */}
          <Text className={label}>Main photo</Text>
          <Touchable onPress={pickCover} accessibilityRole="button" accessibilityLabel="Choose the main photo">
            <View pointerEvents="none" className="mb-4 overflow-hidden rounded-2xl"
              style={{ height: 170, backgroundColor: c.inset, borderWidth: 1, borderColor: c.line }}>
              {cover ? (
                <Image source={{ uri: cover }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Ionicons name="image-outline" size={26} color={c.faint} />
                  <Text className="font-sans mt-1.5 text-[12.5px]" style={{ color: c.faint }}>
                    Add a photo or poster
                  </Text>
                </View>
              )}
            </View>
          </Touchable>
          {cover ? (
            <View className="mb-4 -mt-2">
              <Button label="Remove photo" variant="ghost" size="sm" onPress={() => setCover(null)} />
            </View>
          ) : null}

          <Text className={label}>Name</Text>
          <TextInput
            value={title} onChangeText={setTitle}
            placeholder="Ganesh Chaturthi 2026" placeholderTextColor={c.faint}
            className={input} style={{ backgroundColor: c.inset, outline: 'none' } as never}
          />

          <Text className={label}>About</Text>
          <TextInput
            value={description} onChangeText={setDescription}
            placeholder="A line or two about the celebration" placeholderTextColor={c.faint}
            multiline
            className={input}
            style={{ backgroundColor: c.inset, minHeight: 84, textAlignVertical: 'top', outline: 'none' } as never}
          />

          <View className="mb-4">
            <DateField label="Date" value={date} onChange={setDate} />
          </View>

          <View className="mb-4 flex-row gap-2">
            <View style={{ flex: 1 }}>
              <TimeField label="Starts" value={start} onChange={setStart} placeholder="Time" />
            </View>
            <View style={{ flex: 1 }}>
              <TimeField label="Ends" value={end} onChange={setEnd} placeholder="Time" />
            </View>
          </View>

          <Text className={label}>Venue</Text>
          <TextInput
            value={venue} onChangeText={setVenue}
            placeholder="e.g. Clubhouse lawn" placeholderTextColor={c.faint}
            className={input} style={{ backgroundColor: c.inset, outline: 'none' } as never}
          />

          <Text className={label}>Planned budget</Text>
          <TextInput
            value={budget} onChangeText={setBudget} keyboardType="numeric"
            placeholder="50000" placeholderTextColor={c.faint}
            className={input} style={{ backgroundColor: c.inset, outline: 'none' } as never}
          />

          <Button label={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy} />

          {!isAdmin ? null : (
            <Text className="font-sans mt-3 text-center text-[12px]" style={{ color: c.faint }}>
              Everyone in the society can see these details.
            </Text>
          )}
        </Container>
      </ScrollView>
    </KeyboardAvoider>
  );
}
