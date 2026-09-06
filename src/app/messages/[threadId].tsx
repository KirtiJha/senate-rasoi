import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, ErrorState, KeyboardAvoider, PhotoViewer } from '../../components/ui';
import { ModerationMenu } from '../../components/ModerationMenu';
import { useAuth } from '../../context/auth';
import { useBlocks } from '../../context/blocks';
import { useConfirm } from '../../context/confirm';
import { useToast } from '../../context/toast';
import { usePushPrompt } from '../../components/PushPrompt';
import { useDraft } from '../../lib/draft';
import { haptics } from '../../lib/haptics';
import { IMAGE_CACHE_PROPS } from '../../lib/image';
import { openPhotoPicker } from '../../lib/photo';
import {
  DM_PHOTO_URL_TTL, DmMessageRow, InboxThread, dmPhotoUrl, fetchMessages, fetchThread,
  markThreadRead, sendMessage, subscribeToThread, unsendMessage, uploadDmPhoto,
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
  const confirm = useConfirm();
  const { offer: offerPush } = usePushPrompt();

  const [thread, setThread] = useState<InboxThread | null>(null);
  const [messages, setMessages] = useState<DmMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [body, setBody] = useDraft('dm:' + (threadId ?? ''), '');
  // A photo picked but not yet sent. It goes with the next send, words or none.
  const [photo, setPhoto] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
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
    // Inserts and updates alike: the other side reading a message is an
    // update, and that is how the ticks on this side turn.
    const unsub = subscribeToThread(threadId, () => {
      fetchMessages(threadId).then((m) => {
        setMessages(m);
        if (userId) markThreadRead(threadId, userId).catch(() => {});
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      }).catch(() => {});
    });
    return unsub;
  }, [threadId, userId]);

  const pickPhoto = async () => {
    const res = await openPhotoPicker({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: false });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  };

  const canSend = !!(body.trim() || photo) && !sending;

  const send = async () => {
    const text = body.trim();
    if ((!text && !photo) || !userId || !threadId || sending) return;
    setSending(true);
    try {
      const path = photo ? await uploadDmPhoto(photo, threadId) : null;
      const msg = await sendMessage(threadId, userId, text, path);
      setMessages((prev) => [...prev, msg]);
      setBody('');
      setPhoto(null);
      haptics.tap();
      // They will reply. This is the moment a notification makes sense.
      offerPush('message');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch { toast.show(photo ? 'Could not send the photo' : 'Could not send'); }
    finally { setSending(false); }
  };

  const onUnsend = useCallback(async (m: DmMessageRow) => {
    haptics.tap();
    if (!(await confirm({
      title: 'Withdraw this message?',
      message: `${thread?.other.name ?? 'They'} will see that a message was withdrawn, not what it said.`,
      confirmLabel: 'Withdraw',
      destructive: true,
    }))) return;
    try {
      await unsendMessage(m.id);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, body: '', photo_path: null, deleted_at: new Date().toISOString() } : x)));
    } catch { toast.show('Could not withdraw — try again'); }
  }, [confirm, thread?.other.name, toast]);

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
            accessibilityRole="button"
            accessibilityLabel={`Open ${thread?.other.name ?? 'neighbour'}'s profile`}
          >
            <Avatar name={thread?.other.name ?? '?'} userId={thread?.other.id} size={34} />
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
              <DmBubble key={m.id} message={m} isMine={m.sender_id === userId} c={c} onUnsend={onUnsend} onOpenPhoto={setViewing} />
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
        {photo ? (
          <View className="mb-2 flex-row items-end gap-2">
            <View className="overflow-hidden rounded-xl" style={{ width: 84, height: 84 }}>
              <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              <Pressable
                onPress={() => setPhoto(null)}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                hitSlop={6}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
            <Text className="font-sans text-[12px] text-muted">Photo ready to send</Text>
          </View>
        ) : null}
        <View className="flex-row items-end gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Attach a photo"
            onPress={pickPhoto}
            disabled={sending}
            hitSlop={6}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-inset"
          >
            <Ionicons name="image-outline" size={22} color={photo ? c.accent : c.muted} />
          </Pressable>
          <View className="flex-1 rounded-2xl border border-line bg-inset px-3 py-2">
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={photo ? 'Add a caption…' : 'Message…'}
              placeholderTextColor={c.faint}
              multiline
              maxLength={1000}
              className="max-h-24 text-[14px] text-ink"
              style={{ outline: 'none' } as any}
              onSubmitEditing={send}
              accessibilityLabel="Message"
            />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Send message"
            onPress={send}
            disabled={!canSend}
            className={`h-10 w-10 items-center justify-center rounded-full ${canSend ? '' : 'bg-inset'}`}
            style={canSend ? { backgroundColor: c.accent } : undefined}
          >
            {sending
              ? <ActivityIndicator size="small" color={c.onAccent} />
              : <Ionicons name="send" size={17} color={canSend ? c.onAccent : c.faint} />}
          </Pressable>
        </View>
      </View>
      )}

      <PhotoViewer photos={viewing ? [viewing] : null} onClose={() => setViewing(null)} />
    </KeyboardAvoider>
  );
}

/**
 * A photo in a bubble. The bucket is private, so each draw asks for a signed
 * URL and keeps it for most of its hour; the query cache dedupes that across
 * re-renders and the inbox → thread → inbox round trip.
 */
function DmPhoto({ path, isMine, onOpen }: { path: string; isMine: boolean; onOpen: (url: string) => void }) {
  const c = useThemeColors();
  const url = useQuery({
    queryKey: ['dm-photo', path],
    queryFn: () => dmPhotoUrl(path),
    staleTime: (DM_PHOTO_URL_TTL - 300) * 1000,
    gcTime: DM_PHOTO_URL_TTL * 1000,
  });
  return (
    <Pressable
      onPress={url.data ? () => onOpen(url.data!) : undefined}
      accessibilityRole="imagebutton"
      accessibilityLabel="Photo, open full size"
      className="overflow-hidden rounded-xl"
      style={{ width: 220, height: 165, backgroundColor: isMine ? 'rgba(255,255,255,0.18)' : c.line }}
    >
      {url.data ? (
        <Image source={{ uri: url.data }} style={{ width: '100%', height: '100%' }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
      ) : url.isError ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="image-outline" size={22} color={isMine ? '#fff' : c.faint} />
          <Text className={`font-sans mt-1 text-[11px] ${isMine ? 'text-white/80' : 'text-faint'}`}>Couldn't load</Text>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="small" color={isMine ? '#fff' : c.muted} /></View>
      )}
    </Pressable>
  );
}

function DmBubble({
  message, isMine, c, onUnsend, onOpenPhoto,
}: {
  message: DmMessageRow;
  isMine: boolean;
  c: ReturnType<typeof useThemeColors>;
  onUnsend: (m: DmMessageRow) => void;
  onOpenPhoto: (url: string) => void;
}) {
  const withdrawn = !!message.deleted_at;

  // A withdrawn message keeps its place and loses its words, so the thread
  // still reads as the conversation it was rather than quietly closing up.
  if (withdrawn) {
    return (
      <View className={`flex-row ${isMine ? 'justify-end' : 'justify-start'}`}>
        <View className="max-w-[80%] rounded-2xl border border-line px-3 py-2">
          <Text className="font-sans text-[13px] italic text-faint">
            {isMine ? 'You withdrew this' : 'This message was withdrawn'}
          </Text>
        </View>
      </View>
    );
  }

  const read = !!message.read_at;
  return (
    <View className={`flex-row ${isMine ? 'justify-end' : 'justify-start'}`}>
      <Pressable
        // Long press is the one gesture people already try on a message they
        // regret. Only on your own — nobody edits or removes anyone else's.
        onLongPress={isMine ? () => onUnsend(message) : undefined}
        delayLongPress={350}
        accessibilityRole={isMine ? 'button' : undefined}
        accessibilityLabel={isMine ? `Your message${read ? ', read' : ', sent'}. Long press to withdraw` : undefined}
        className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMine ? 'rounded-br-md' : 'rounded-tl-md bg-inset'}`}
        style={isMine ? { backgroundColor: c.accent } : undefined}
      >
        {message.photo_path ? (
          <View className={message.body ? 'mb-1.5' : 'mb-0.5'}>
            <DmPhoto path={message.photo_path} isMine={isMine} onOpen={onOpenPhoto} />
          </View>
        ) : null}
        {message.body ? (
          <Text className={`text-[14px] leading-5 ${isMine ? 'text-white' : 'text-ink'}`}>{message.body}</Text>
        ) : null}
        <View className={`mt-0.5 flex-row items-center gap-1 ${isMine ? 'justify-end' : ''}`}>
          <Text className={`text-[11px] ${isMine ? 'text-white/70' : 'text-faint'}`}>{time(message.created_at)}</Text>
          {/* One tick: it left you. Two: they have seen it. The second tick
              turns live, because their reading it is an update this screen
              subscribes to. */}
          {isMine ? (
            <Ionicons name={read ? 'checkmark-done' : 'checkmark'} size={12} color={read ? '#fff' : 'rgba(255,255,255,0.7)'} />
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}
