import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, ErrorState, KeyboardAvoider } from '../../../components/ui';
import { ModerationMenu } from '../../../components/ModerationMenu';
import { useAuth } from '../../../context/auth';
import { useConfirm } from '../../../context/confirm';
import { useToast } from '../../../context/toast';
import { useDraft } from '../../../lib/draft';
import {
  GroupMessage, deleteGroupMessage, fetchGroupMessages, markGroupRead,
  sendGroupMessage, subscribeGroupMessages,
} from '../../../lib/groupChat';
import { haptics } from '../../../lib/haptics';
import { openPhotoPicker } from '../../../lib/photo';
import { uploadContentPhoto } from '../../../lib/photoUpload';
import { GroupMember, SportGroup, fetchGroup, fetchGroupMembers } from '../../../lib/sports';
import { useThemeColors } from '../../../theme';

/**
 * The group conversation.
 *
 * Same bubbles and composer as a DM, on purpose — a resident should not have
 * to learn a second chat. What is different is that a message here has nine
 * readers, so unread is a read cursor per member (0116) rather than a flag per
 * message, and every bubble carries who said it.
 */
export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { userId, communityId, isAdmin } = useAuth();

  const [group, setGroup] = useState<SportGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [body, setBody] = useDraft('group:' + (id ?? ''), '');
  const [photo, setPhoto] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const isCaptain = !!members.find((m) => m.user_id === userId)?.is_captain;
  const isMember = !!members.find((m) => m.user_id === userId);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [g, ms, msgs] = await Promise.all([
        fetchGroup(id), fetchGroupMembers(id), fetchGroupMessages(id),
      ]);
      setGroup(g); setMembers(ms); setMessages(msgs);
      setLoadFailed(false);
      // Opening the thread IS reading it.
      if (userId) markGroupRead(id, userId).catch(() => {});
    } catch (e) {
      // Never render "no messages yet" for a failed fetch — a member would
      // believe the group had gone quiet.
      console.error('group chat: load failed', e);
      setLoadFailed(true);
    } finally { setLoading(false); }
  }, [id, userId]);

  const retry = useCallback(async () => {
    setRetrying(true); await load(); setRetrying(false);
  }, [load]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => (id ? subscribeGroupMessages(id, load) : undefined), [id, load]);

  const pick = async () => {
    const res = await openPhotoPicker({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) setPhoto(res.assets[0].uri);
  };

  const send = async () => {
    if (!id || !userId || !communityId || sending) return;
    if (!body.trim() && !photo) return;
    setSending(true);
    try {
      let photoUrl: string | null = null;
      if (photo) {
        // Words survive a failed upload; the photo is the part that retries.
        try { photoUrl = await uploadContentPhoto(photo, `group-chat/${id}/${Date.now()}`); }
        catch { toast.show('Photo did not upload — sending the message'); }
      }
      await sendGroupMessage({ groupId: id, communityId, authorId: userId, body, photoUrl });
      haptics.tap();
      setBody(''); setPhoto(null);
      await load();
    } catch {
      toast.show('Could not send that — try again');
    } finally { setSending(false); }
  };

  const remove = async (m: GroupMessage) => {
    const ok = await confirm({
      title: 'Delete this message?',
      message: m.body ? `"${m.body.slice(0, 80)}"` : 'This photo will be removed for everyone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try { await deleteGroupMessage(m.id); await load(); }
    catch { toast.show('Could not delete that'); }
  };

  return (
    <KeyboardAvoider>
      <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace(`/sports/${id}` as never))}
            hitSlop={10}
            className="h-9 w-9 items-center justify-center rounded-full active:bg-inset"
          >
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
          <Pressable
            onPress={() => router.push(`/sports/${id}` as never)}
            className="min-w-0 flex-1 flex-row items-center gap-2.5 active:opacity-70"
          >
            <Avatar name={group?.name ?? '?'} size={34} />
            <View className="min-w-0 flex-1">
              <Text className="font-sans-bold text-[15px] text-ink" numberOfLines={1}>
                {group?.name ?? 'Group'}
              </Text>
              <Text className="font-sans text-[11px] text-faint">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {loadFailed ? (
          <ErrorState
            title="Couldn't load this conversation"
            message="The messages are safe — we just couldn't reach them. Try again."
            onRetry={retry}
            retrying={retrying}
          />
        ) : loading ? (
          <View className="items-center py-10"><ActivityIndicator color={c.accent} /></View>
        ) : messages.length === 0 ? (
          <View className="items-center py-12">
            <Ionicons name="chatbubbles-outline" size={30} color={c.faint} />
            <Text className="mt-2 font-sans-sb text-[14px] text-ink">No messages yet</Text>
            <Text className="font-sans mt-1 max-w-xs text-center text-[13px] leading-[19px] text-muted">
              This is where the group sorts out who is playing, who is bringing the shuttles, and
              what time everyone is actually coming down.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {messages.map((m, i) => (
              <Bubble
                key={m.id}
                message={m}
                mine={m.author_id === userId}
                // Only label a run of messages once, the way a chat should.
                showAuthor={m.author_id !== userId && messages[i - 1]?.author_id !== m.author_id}
                canDelete={m.author_id === userId || isCaptain || !!isAdmin}
                onDelete={() => remove(m)}
                c={c}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {isMember ? (
        <View style={{ paddingBottom: insets.bottom + 8 }} className="border-t border-line bg-bg px-4 pt-3">
          {photo ? (
            <View className="mb-2 flex-row items-center gap-2">
              <Image source={{ uri: photo }} style={{ width: 44, height: 44, borderRadius: 10 }} contentFit="cover" />
              <Pressable onPress={() => setPhoto(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove photo">
                <Text className="text-[12px] font-sans-sb text-muted">Remove</Text>
              </Pressable>
            </View>
          ) : null}
          <View className="flex-row items-end gap-2">
            <Pressable
              onPress={pick}
              accessibilityRole="button"
              accessibilityLabel="Add a photo"
              className="h-10 w-10 items-center justify-center rounded-full bg-inset active:opacity-70"
            >
              <Ionicons name="image-outline" size={18} color={c.muted} />
            </Pressable>
            <View className="flex-1 rounded-2xl border border-line bg-inset px-3 py-2">
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={`Message ${group?.name ?? 'the group'}…`}
                placeholderTextColor={c.faint}
                multiline
                maxLength={1000}
                className="max-h-24 text-[14px] text-ink"
                style={{ outline: 'none' } as never}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              onPress={send}
              disabled={sending || (!body.trim() && !photo)}
              className={`h-10 w-10 items-center justify-center rounded-full ${body.trim() || photo ? '' : 'bg-inset'}`}
              style={body.trim() || photo ? { backgroundColor: c.accent } : undefined}
            >
              {sending
                ? <ActivityIndicator size="small" color={body.trim() || photo ? '#fff' : c.faint} />
                : <Ionicons name="send" size={17} color={body.trim() || photo ? '#fff' : c.faint} />}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ paddingBottom: insets.bottom + 8 }} className="border-t border-line bg-bg px-4 pt-3">
          <View className="items-center rounded-2xl bg-inset px-4 py-3">
            <Text className="font-sans-sb text-[13px] text-muted">Join the group to join the conversation</Text>
          </View>
        </View>
      )}
    </KeyboardAvoider>
  );
}

function Bubble({
  message, mine, showAuthor, canDelete, onDelete, c,
}: {
  message: GroupMessage;
  mine: boolean;
  showAuthor: boolean;
  canDelete: boolean;
  onDelete: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View className={`flex-row ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine ? (
        <View style={{ width: 28, marginRight: 8 }}>
          {showAuthor ? <Avatar name={message.author?.name ?? '?'} size={28} /> : null}
        </View>
      ) : null}

      <View className="max-w-[78%]">
        {showAuthor ? (
          <Text className="mb-0.5 text-[11px] font-sans-sb" style={{ color: c.muted }}>
            {message.author?.name ?? 'Member'}
            {message.author?.flat ? ` · ${message.author.flat}` : ''}
          </Text>
        ) : null}

        <View
          className={`rounded-2xl px-3 py-2 ${mine ? 'rounded-br-md' : 'rounded-tl-md bg-inset'}`}
          style={mine ? { backgroundColor: c.accent } : undefined}
        >
          {message.photo_url ? (
            <Image
              source={{ uri: message.photo_url }}
              style={{ width: 200, height: 150, borderRadius: 10, marginBottom: message.body ? 6 : 0 }}
              contentFit="cover"
            />
          ) : null}
          {message.body ? (
            <Text className={`text-[14px] leading-5 ${mine ? 'text-white' : 'text-ink'}`}>{message.body}</Text>
          ) : null}
          <View className="mt-0.5 flex-row items-center justify-end gap-2">
            <Text className={`text-[10px] ${mine ? 'text-white/70' : 'text-faint'}`}>{time(message.created_at)}</Text>
            {canDelete ? (
              <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete message">
                <Ionicons name="trash-outline" size={12} color={mine ? '#ffffffaa' : c.faint} />
              </Pressable>
            ) : null}
            {!mine ? (
              <ModerationMenu
                targetType="group_message"
                targetId={message.id}
                targetOwnerId={message.author_id}
                targetOwnerName={message.author?.name}
                size={13}
                tint={c.faint}
              />
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function time(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}
