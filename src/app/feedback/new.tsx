import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { FEEDBACK_KINDS, FeedbackKind, createFeedback } from '../../lib/feedback';
import { haptics } from '../../lib/haptics';
import { openPhotoPicker } from '../../lib/photo';
import { useThemeColors } from '../../theme';
import { Button, Container, KeyboardAvoider, ScreenHeader, Touchable } from '../../components/ui';

const MAX_PHOTOS = 3;

/**
 * One form for all three kinds, because the difference between "a bug" and
 * "feedback" is often clear only after somebody has written it down. Asking a
 * resident to classify their problem before describing it loses the reports
 * from people who are not sure which box it belongs in.
 *
 * The app version and platform are attached automatically. "Which version are
 * you on?" is the first question a bug needs and the last one a resident can
 * answer.
 */
export default function NewFeedbackScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const toast = useToast();
  const { userId, communityId } = useAuth();
  const params = useLocalSearchParams<{ kind?: string }>();

  const initial = FEEDBACK_KINDS.find((k) => k.key === params.kind)?.key ?? 'bug';
  const [kind, setKind] = useState<FeedbackKind>(initial);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    if (photos.length >= MAX_PHOTOS) { toast.show(`Up to ${MAX_PHOTOS} photos`); return; }
    const r = await openPhotoPicker({ mediaTypes: ['images'], quality: 0.8 });
    if (r.canceled || !r.assets?.[0]?.uri) return;
    setPhotos((p) => [...p, r.assets[0].uri]);
  };

  const submit = async () => {
    if (busy) return;
    if (!userId) { toast.show('Sign in first'); return; }
    if (!title.trim()) { toast.show('Give it a one-line summary'); return; }

    setBusy(true);
    try {
      const id = await createFeedback({
        kind,
        title,
        body,
        photoUris: photos,
        userId,
        communityId: communityId ?? undefined,
      });
      haptics.success();
      toast.show('Sent — you will see the reply here');
      router.replace(`/feedback/${id}` as never);
    } catch (e) {
      console.error(e);
      toast.show('Could not send that — try again');
    } finally {
      setBusy(false);
    }
  };

  const hint =
    kind === 'bug'
      ? 'What did you tap, what did you expect, and what happened instead? A screenshot helps more than anything.'
      : kind === 'feature'
        ? 'What would you like to do that you cannot today? Tell us the problem rather than the solution if it is easier.'
        : 'Anything at all — what is confusing, what is slow, what works well.';

  return (
    <KeyboardAvoider>
      <ScreenHeader title="Tell us" showBack backHref="/feedback" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Kind</Text>
          <View className="mb-4 gap-2">
            {FEEDBACK_KINDS.map((k) => {
              const on = k.key === kind;
              return (
                <Touchable key={k.key} onPress={() => setKind(k.key)} accessibilityRole="button" accessibilityLabel={k.label}>
                  <View
                    pointerEvents="none"
                    className="flex-row items-center gap-2.5 rounded-2xl px-3.5 py-3"
                    style={{
                      backgroundColor: on ? c.accentSoft : c.inset,
                      borderWidth: 1,
                      borderColor: on ? c.accentLine : 'transparent',
                    }}
                  >
                    <Ionicons name={k.icon as never} size={16} color={on ? c.accent : c.muted} />
                    <Text className="flex-1 font-sans-sb text-[14px]" style={{ color: on ? c.accent : c.ink }}>
                      {k.label}
                    </Text>
                    {on ? <Ionicons name="checkmark-circle" size={17} color={c.accent} /> : null}
                  </View>
                </Touchable>
              );
            })}
          </View>

          <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">In one line</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={kind === 'bug' ? 'Sign in button does nothing' : 'Let me pay maintenance in the app'}
            placeholderTextColor={c.faint}
            maxLength={120}
            className="mb-4 rounded-2xl border border-line px-3.5 py-3 text-[15px] text-ink"
            style={{ backgroundColor: c.inset, outline: 'none' } as never}
          />

          <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Details</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={hint}
            placeholderTextColor={c.faint}
            multiline
            maxLength={4000}
            className="rounded-2xl border border-line px-3.5 py-3 text-[15px] text-ink"
            style={{ backgroundColor: c.inset, minHeight: 130, textAlignVertical: 'top', outline: 'none' } as never}
          />

          <View className="mb-5 mt-3 flex-row flex-wrap gap-2">
            {photos.map((p, i) => (
              <View key={`${p}-${i}`}>
                <Image source={{ uri: p }} style={{ width: 78, height: 78, borderRadius: 10, backgroundColor: c.inset }} />
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
              <Touchable onPress={pick} accessibilityRole="button" accessibilityLabel="Add a screenshot">
                <View
                  pointerEvents="none"
                  className="items-center justify-center rounded-[10px]"
                  style={{ width: 78, height: 78, backgroundColor: c.inset, borderWidth: 1, borderColor: c.line }}
                >
                  <Ionicons name="image-outline" size={19} color={c.muted} />
                  <Text className="font-sans mt-1 text-[10px]" style={{ color: c.faint }}>Screenshot</Text>
                </View>
              </Touchable>
            ) : null}
          </View>

          <Button label={busy ? 'Sending…' : 'Send'} onPress={submit} disabled={busy} />

          <Text className="font-sans mt-3 text-center text-[12px] leading-[18px]" style={{ color: c.faint }}>
            Your app version and phone type are attached so we can reproduce it.
            Only you and your society admins can see this.
          </Text>
        </Container>
      </ScrollView>
    </KeyboardAvoider>
  );
}
