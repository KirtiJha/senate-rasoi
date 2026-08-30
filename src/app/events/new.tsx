import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Container, ScreenHeader } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { createEvent } from '../../lib/events';
import { useThemeColors } from '../../theme';


export default function NewEventScreen() {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const toast = useToast();
  const router = useRouter();
  const { userId, communityId, isAdmin } = useAuth();

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [budget, setBudget] = useState('');
  const [perFlat, setPerFlat] = useState('');
  const [saving, setSaving] = useState(false);

  // Only society admins start a function; they then appoint a lead to run it.
  if (!isAdmin) return <Redirect href={'/events' as any} />;

  const submit = async () => {
    if (!userId) return;
    if (!title.trim()) return toast.show('Give the function a name');
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast.show('Date must look like 2026-11-08');
    setSaving(true);
    try {
      const ev = await createEvent({
        communityId,
        createdBy: userId,
        title,
        description: desc || null,
        eventDate: date || null,
        venue: venue || null,
        budgetAmount: budget ? Number(budget) : null,
        suggestedContribution: perFlat ? Number(perFlat) : null,
      });
      toast.show('Function created 🎉 — add your team next');
      router.replace(`/events/${ev.id}` as any);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Could not create');
    } finally { setSaving(false); }
  };

  const input = 'rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink';
  const label = 'mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted';

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader icon="sparkles-outline" iconColor={ACCENT} title="Plan a function" showBack hideSociety />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Container narrow>
          <Text className={label}>What is the function?</Text>
          <TextInput
            value={title} onChangeText={setTitle}
            placeholder="e.g. Diwali 2026" placeholderTextColor={c.faint}
            className={`mb-3 ${input}`} style={{ outline: 'none' } as any}
          />

          <Text className={label}>The plan (optional)</Text>
          <TextInput
            value={desc} onChangeText={setDesc}
            placeholder="What's happening, timings, what's planned…"
            placeholderTextColor={c.faint} multiline
            className={`mb-3 ${input}`} style={{ minHeight: 80, outline: 'none' } as any}
          />

          <Text className={label}>Date</Text>
          <TextInput
            value={date} onChangeText={setDate}
            placeholder="2026-11-08" placeholderTextColor={c.faint}
            className={`mb-3 ${input}`} style={{ outline: 'none' } as any}
          />

          <Text className={label}>Venue</Text>
          <TextInput
            value={venue} onChangeText={setVenue}
            placeholder="e.g. Clubhouse lawn" placeholderTextColor={c.faint}
            className={`mb-3 ${input}`} style={{ outline: 'none' } as any}
          />

          <Text className={label}>Planned budget (optional)</Text>
          <TextInput
            value={budget} onChangeText={setBudget} keyboardType="numeric"
            placeholder="60000" placeholderTextColor={c.faint}
            className={`mb-3 ${input}`} style={{ outline: 'none' } as any}
          />

          <Text className={label}>Suggested contribution per flat</Text>
          <TextInput
            value={perFlat} onChangeText={setPerFlat} keyboardType="numeric"
            placeholder="1000" placeholderTextColor={c.faint}
            className={`mb-1.5 ${input}`} style={{ outline: 'none' } as any}
          />
          <Text className="font-sans mb-5 text-[12px] leading-[17px] text-faint">
            Just a default — the treasurer can set a different amount for any flat,
            or waive it entirely.
          </Text>

          <Button label="Create function" icon="checkmark" size="lg" fullWidth loading={saving} onPress={submit} />
          <Text className="font-sans mt-3 text-center text-[12px] leading-[18px] text-faint">
            It starts as a draft, so nobody is notified yet. Add your core team,
            then open contributions when you're ready.
          </Text>
        </Container>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
