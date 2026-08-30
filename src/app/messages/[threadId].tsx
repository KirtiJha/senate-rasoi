import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, ErrorState, KeyboardAvoider } from '../../components/ui';
import { ModerationMenu } from '../../components/ModerationMenu';
import { useAuth } from '../../context/auth';
import { useBlocks } from '../../context/blocks';
import { useToast } from '../../context/toast';
import { useDraft } from '../../lib/draft';
import { haptics } from '../../lib/haptics';
import {
  DmMessageRow, InboxThread, fetchMessages, fetchThread,
  markThreadRead, sendMessage, subscribeToThread,
} from '../../lib/dm';
import { useThemeColors } from '../../theme';

export default function DmThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const { isBlocked } = useBlocks();

  const [thread, setThread] = useState<InboxThread | null>(null);
  const [messages, setMessages] = useState<DmMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [body, setBody] = useDraft('dm:' + (threadId ?? ''), '');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const blocked = isBlocked(thread?.other.id);

  const load = useCallback(async () => {
    if (!threadId || !userId) return;
    try {
      const [t, msgs] = await Promise.all([fetchThread(threadId, userId), fetchMessages(threadId)]);
      setThread(t);
      setMessages(msgs);
      markThreadRead(threadId, userId).catch(() => {});
      setLoadFailed(false);
    } catch (e) {
      // Without this, a failed fetch rendered "No messages yet. Say hello" —
      // so a resident could believe their neighbour never replied.
      console.error('dm: load failed', e);
      setLoadFailed(true);
    } finally { setLoading(false); }
  }, [threadId, userId]);

  const retry = useCallback(async () => {
    setRetrying(true);
    await load();
    setRetrying(false);
  }, [load]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!threadId) return;
    const unsub = subscribeToThread(threadId, () => {
      fetchMessages(threadId).then((m) => {
        setMessages(m);
        if (userId) markThreadRead(threadId, userId).catch(() => {});
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      }).catch(() => {});
    });
    return unsub;
  }, [threadId, userId]);

  const send = async () => {
    const text = body.trim();
    if (!text || !userId || !threadId || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(threadId, userId, text);
      setMessages((prev) => [...prev, msg]);
      setBody('');
      haptics.tap();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch { toast.show('Could not send'); }
    finally { setSending(false); }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator size="small" color={c.muted} />
      </View>
    );
  }

  return (
    <KeyboardAvoider>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
        <View className="flex-row items-center gap-2">
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/messages' as any))} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
          <Pressable
            onPress={() => thread?.other.id ? router.push(`/profile/${thread.other.id}` as any) : undefined}
            className="flex-1 flex-row items-center gap-2.5 active:opacity-70"
          >
            <Avatar name={thread?.other.name ?? '?'} size={34} />
            <View>
              <Text className="font-sans-bold text-[15px] text-ink" numberOfLines={1}>{thread?.other.name ?? 'Neighbour'}</Text>
              {thread?.other.flat ? <Text className="font-sans text-[11px] text-faint">Flat {thread.other.flat}</Text> : null}
            </View>
          </Pressable>
          {thread?.other.id ? (
            <ModerationMenu
              targetType="message"
              targetId={threadId!}
              targetOwnerId={thread.other.id}
              targetOwnerName={thread.other.name}
            />
          ) : null}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        // Fills the space between header and composer. Without this the
        // scroller sizes to its content, so a short thread pulls the composer
        // up into the middle of the screen.
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {loadFailed ? (
          <ErrorState
            title="Couldn't load this conversation"
            message="Your messages are safe — we just couldn't reach them. Try again."
            onRetry={retry}
            retrying={retrying}
          />
        ) : messages.length === 0 ? (
          <Text className="font-sans py-10 text-center text-[13px] text-muted">
            No messages yet. Say hello to {thread?.other.name ?? 'your neighbour'} 👋
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {messages.map((m) => (
              <DmBubble key={m.id} message={m} isMine={m.sender_id === userId} accent={c.accent} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Composer — replaced by a notice when either side has blocked */}
      {blocked ? (
        <View style={{ paddingBottom: insets.bottom + 8 }} className="border-t border-line bg-bg px-4 pt-3">
          <View className="items-center rounded-2xl bg-inset px-4 py-3">
            <Ionicons name="ban-outline" size={20} color={c.faint} />
            <Text className="mt-1 font-sans-sb text-[13px] text-muted">This conversation is unavailable</Text>
            <Text className="font-sans mt-0.5 text-center text-[12px] text-faint">
              You can manage this in Profile → Blocked members.
            </Text>
          </View>
        </View>
      ) : (
      <View style={{ paddingBottom: insets.bottom + 8 }} className="border-t border-line bg-bg px-4 pt-3">
        <View className="flex-row items-end gap-2">
          <View className="flex-1 rounded-2xl border border-line bg-inset px-3 py-2">
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Message…"
              placeholderTextColor={c.faint}
              multiline
              maxLength={1000}
              className="max-h-24 text-[14px] text-ink"
              style={{ outline: 'none' } as any}
              onSubmitEditing={send}
            />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Send message"
            onPress={send}
            disabled={sending || !body.trim()}
            className={`h-10 w-10 items-center justify-center rounded-full ${body.trim() ? '' : 'bg-inset'}`}
            style={body.trim() ? { backgroundColor: c.accent } : undefined}
          >
            {sending
              ? <ActivityIndicator size="small" color={body.trim() ? '#fff' : c.faint} />
              : <Ionicons name="send" size={17} color={body.trim() ? '#fff' : c.faint} />}
          </Pressable>
        </View>
      </View>
      )}
    </KeyboardAvoider>
  );
}

function DmBubble({ message, isMine, accent }: { message: DmMessageRow; isMine: boolean; accent: string }) {
  return (
    <View className={`flex-row ${isMine ? 'justify-end' : 'justify-start'}`}>
      <View
        className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMine ? 'rounded-br-md' : 'rounded-tl-md bg-inset'}`}
        style={isMine ? { backgroundColor: accent } : undefined}
      >
        <Text className={`text-[14px] leading-5 ${isMine ? 'text-white' : 'text-ink'}`}>{message.body}</Text>
        <Text className={`mt-0.5 text-[10px] ${isMine ? 'text-right text-white/70' : 'text-faint'}`}>
          {time(message.created_at)}
        </Text>
      </View>
    </View>
  );
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}
