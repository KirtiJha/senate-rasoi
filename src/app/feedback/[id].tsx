import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import {
  FEEDBACK_FLOW,
  FEEDBACK_KINDS,
  FEEDBACK_STATUS,
  FeedbackComment,
  FeedbackItem,
  FeedbackStatus,
  addFeedbackComment,
  fetchFeedbackComments,
  fetchFeedbackItem,
} from '../../lib/feedback';
import { haptics } from '../../lib/haptics';
import { useThemeColors } from '../../theme';
import { Avatar, Badge, Container, ErrorState, KeyboardAvoider, ScreenHeader, Touchable } from '../../components/ui';

/**
 * One report, and the conversation about it.
 *
 * Both sides write here. An admin who cannot ask "which screen were you on?"
 * has to chase the reporter in WhatsApp, which is the thing this replaces —
 * and a reporter who cannot answer is a bug that never gets fixed.
 *
 * The status picker is an admin's only way to move a report, and it always
 * travels with a comment. "Status: declined" with no words is how a suggestion
 * box teaches people to stop using it.
 */
export default function FeedbackDetailScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, isAdmin } = useAuth();

  const [item, setItem] = useState<FeedbackItem | null | 'missing'>(null);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [reply, setReply] = useState('');
  const [nextStatus, setNextStatus] = useState<FeedbackStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const it = await fetchFeedbackItem(id);
      if (!it) { setItem('missing'); return; }
      setItem(it);
      setComments(await fetchFeedbackComments(id));
    } catch {
      setItem('missing');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (busy || !userId || !id) return;
    if (!reply.trim()) { toast.show('Write something first'); return; }
    setBusy(true);
    try {
      await addFeedbackComment({ itemId: id, userId, body: reply, statusAfter: nextStatus });
      haptics.success();
      setReply('');
      setNextStatus(null);
      await load();
    } catch (e) {
      console.error(e);
      toast.show('Could not send that');
    } finally {
      setBusy(false);
    }
  };

  if (item === null) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }
  if (item === 'missing') {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader title="Report" showBack backHref="/feedback" />
        <ErrorState message="This report is not available." />
      </View>
    );
  }

  const kind = FEEDBACK_KINDS.find((k) => k.key === item.kind);

  return (
    <KeyboardAvoider>
      <ScreenHeader title={kind?.label ?? 'Report'} showBack backHref="/feedback" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          <View className="card p-4">
            <View className="flex-row items-start gap-2">
              <Text className="flex-1 font-display-sb text-[18px] text-ink">{item.title}</Text>
              <Badge label={FEEDBACK_STATUS[item.status].label} tone={FEEDBACK_STATUS[item.status].tone} />
            </View>

            {item.body ? (
              <Text className="font-sans mt-2 text-[14px] leading-[21px] text-ink">{item.body}</Text>
            ) : null}

            {item.photo_urls?.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ gap: 8 }}>
                {item.photo_urls.map((u) => (
                  <Image key={u} source={{ uri: u }}
                    style={{ width: 150, height: 150, borderRadius: 12, backgroundColor: c.inset }} />
                ))}
              </ScrollView>
            ) : null}

            {/* Shown to admins only: useful for triage, clutter for everyone else. */}
            {isAdmin && (item.app_version || item.platform) ? (
              <Text className="font-sans mt-3 text-[11.5px]" style={{ color: c.faint }}>
                {item.author?.name ?? 'A resident'}
                {item.author?.flat ? ` · ${item.author.flat}` : ''}
                {item.app_version ? ` · v${item.app_version}` : ''}
                {item.platform ? ` · ${item.platform}` : ''}
              </Text>
            ) : null}
          </View>

          {comments.length ? (
            <View className="mt-4">
              <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Updates</Text>
              {comments.map((cm) => (
                <View key={cm.id} className="mb-2 flex-row gap-2.5">
                  <Avatar name={cm.author?.name ?? '?'} size={30} />
                  <View style={{ flex: 1 }} className="card p-3">
                    <View className="flex-row items-center gap-2">
                      <Text className="font-sans-sb text-[13px] text-ink">
                        {cm.author_id === item.author_id ? (cm.author?.name ?? 'Reporter') : (cm.author?.name ?? 'Admin')}
                      </Text>
                      {cm.status_after ? (
                        <Badge
                          label={`→ ${FEEDBACK_STATUS[cm.status_after].label}`}
                          tone={FEEDBACK_STATUS[cm.status_after].tone}
                        />
                      ) : null}
                    </View>
                    <Text className="font-sans mt-1 text-[13.5px] leading-[20px] text-ink">{cm.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text className="font-sans mt-4 text-center text-[12.5px]" style={{ color: c.faint }}>
              No replies yet.
            </Text>
          )}

          {/* An admin can move the report; the status rides along with the reply. */}
          {isAdmin ? (
            <View className="mt-4">
              <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
                Move to (optional)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {FEEDBACK_FLOW.filter((s) => s !== item.status).map((s) => {
                  const on = nextStatus === s;
                  return (
                    <Touchable key={s} onPress={() => setNextStatus(on ? null : s)}
                      accessibilityRole="button" accessibilityLabel={FEEDBACK_STATUS[s].label}>
                      <View pointerEvents="none" className="rounded-full px-3 py-1.5"
                        style={{
                          backgroundColor: on ? c.accent : c.inset,
                          borderWidth: 1,
                          borderColor: on ? c.accent : c.line,
                        }}>
                        <Text className="font-sans-sb text-[12.5px]" style={{ color: on ? c.onAccent : c.muted }}>
                          {FEEDBACK_STATUS[s].label}
                        </Text>
                      </View>
                    </Touchable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </Container>
      </ScrollView>

      <View className="flex-row items-end gap-2 border-t border-line px-4 py-2.5" style={{ backgroundColor: c.surface }}>
        <TextInput
          value={reply}
          onChangeText={setReply}
          placeholder={isAdmin ? 'Reply to the reporter…' : 'Add more detail…'}
          placeholderTextColor={c.faint}
          multiline
          maxLength={2000}
          className="flex-1 rounded-2xl px-3.5 py-2.5 text-[15px] text-ink"
          style={{ backgroundColor: c.inset, maxHeight: 110, outline: 'none' } as never}
        />
        <Touchable onPress={send} disabled={busy} accessibilityRole="button" accessibilityLabel="Send">
          <View pointerEvents="none" className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: c.accent, opacity: busy || !reply.trim() ? 0.5 : 1 }}>
            <Ionicons name="arrow-up" size={19} color={c.onAccent} />
          </View>
        </Touchable>
      </View>
    </KeyboardAvoider>
  );
}
