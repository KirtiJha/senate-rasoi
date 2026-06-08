import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Platform, Pressable, Text, TextInput, UIManager, View } from 'react-native';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { haptics } from '../../lib/haptics';
import {
  ListingMessageRow,
  deleteListingMessage,
  fetchListingMessages,
  sendListingMessage,
  subscribeToListingMessages,
} from '../../lib/listingMessages';
import { useThemeColors } from '../../theme';
import { Avatar } from '../ui';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ListingChatProps {
  listingId: string;
  ownerUserId: string;
  ownerName: string;
  accent: string;
}

/**
 * Collapsible in-app chat thread for a listing (Phase 12a). Lets neighbours ask
 * the owner questions without leaking phone numbers; the whole society can read
 * the thread so answers help everyone. Realtime-backed.
 */
export function ListingChat({ listingId, ownerUserId, ownerName, accent }: ListingChatProps) {
  const c = useThemeColors();
  const toast = useToast();
  const { userId, isAdmin } = useAuth();

  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<ListingMessageRow[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    try {
      setMessages(await fetchListingMessages(listingId));
    } catch { /* best-effort */ }
    finally { setLoaded(true); }
  }, [listingId]);

  // Load + subscribe lazily, only once the user opens the thread.
  useEffect(() => {
    if (!open || loadedOnce.current) return;
    loadedOnce.current = true;
    load();
    const unsub = subscribeToListingMessages(listingId, load);
    return unsub;
  }, [open, listingId, load]);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  const send = async () => {
    const text = body.trim();
    if (!text || !userId || sending) return;
    setSending(true);
    try {
      const msg = await sendListingMessage(listingId, userId, text);
      setMessages((prev) => [...prev, msg]);
      setBody('');
      haptics.tap();
    } catch { toast.show('Could not send message'); }
    finally { setSending(false); }
  };

  const remove = async (id: string) => {
    try {
      await deleteListingMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch { toast.show('Could not delete message'); }
  };

  const count = messages.length;

  return (
    <View className="mb-4 overflow-hidden rounded-2xl border border-line bg-surface">
      {/* Header / toggle */}
      <Pressable onPress={toggle} className="flex-row items-center gap-3 p-4 active:bg-inset">
        <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: accent + '20' }}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={accent} />
        </View>
        <View className="flex-1">
          <Text className="font-sans-bold text-[14px] text-ink">Chat with owner</Text>
          <Text className="text-[12px] text-muted">
            {count > 0
              ? `${count} message${count === 1 ? '' : 's'}`
              : 'Ask a question — visible to the society'}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.faint} />
      </Pressable>

      {open ? (
        <View className="border-t border-line px-4 pb-4 pt-3">
          {/* Messages */}
          {!loaded ? (
            <View className="items-center py-6">
              <ActivityIndicator size="small" color={c.muted} />
            </View>
          ) : count === 0 ? (
            <Text className="py-4 text-center text-[13px] text-muted">
              No messages yet. Be the first to ask {ownerName || 'the owner'} a question.
            </Text>
          ) : (
            <View className="gap-3 pb-2">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isMine={m.author_id === userId}
                  isOwner={m.author_id === ownerUserId}
                  canDelete={m.author_id === userId || !!isAdmin}
                  accent={accent}
                  onDelete={() => remove(m.id)}
                  c={c}
                />
              ))}
            </View>
          )}

          {/* Composer */}
          {userId ? (
            <View className="mt-2 flex-row items-end gap-2">
              <View className="flex-1 rounded-2xl border border-line bg-inset px-3 py-2">
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder="Write a message…"
                  placeholderTextColor={c.faint}
                  multiline
                  maxLength={500}
                  className="max-h-24 text-[14px] text-ink"
                  style={{ outline: 'none' } as any}
                  onSubmitEditing={send}
                />
              </View>
              <Pressable
                onPress={send}
                disabled={sending || !body.trim()}
                className={`h-10 w-10 items-center justify-center rounded-full ${body.trim() ? '' : 'bg-inset'}`}
                style={body.trim() ? { backgroundColor: accent } : undefined}
              >
                {sending
                  ? <ActivityIndicator size="small" color={body.trim() ? '#fff' : c.faint} />
                  : <Ionicons name="send" size={17} color={body.trim() ? '#fff' : c.faint} />}
              </Pressable>
            </View>
          ) : (
            <Text className="mt-2 text-center text-[12px] text-faint">Sign in to join the conversation.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function MessageBubble({ message, isMine, isOwner, canDelete, accent, onDelete, c }: {
  message: ListingMessageRow;
  isMine: boolean;
  isOwner: boolean;
  canDelete: boolean;
  accent: string;
  onDelete: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  if (isMine) {
    return (
      <View className="flex-row items-end justify-end gap-1.5">
        {canDelete ? (
          <Pressable onPress={onDelete} hitSlop={8} className="mb-1">
            <Ionicons name="trash-outline" size={13} color={c.faint} />
          </Pressable>
        ) : null}
        <View className="max-w-[80%] rounded-2xl rounded-br-md px-3 py-2" style={{ backgroundColor: accent }}>
          <Text className="text-[13px] leading-5 text-white">{message.body}</Text>
          <Text className="mt-0.5 text-right text-[10px] text-white/70">{timeAgo(message.created_at)}</Text>
        </View>
      </View>
    );
  }
  return (
    <View className="flex-row items-start gap-2">
      <Avatar name={message.author?.name ?? '?'} size={28} />
      <View className="flex-1">
        <View className="mb-0.5 flex-row items-center gap-1.5">
          <Text className="font-sans-sb text-[12px] text-ink">{message.author?.name ?? 'Someone'}</Text>
          {isOwner ? (
            <View className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: accent + '20' }}>
              <Text className="text-[9px] font-sans-sb uppercase tracking-wide" style={{ color: accent }}>Owner</Text>
            </View>
          ) : message.author?.flat ? (
            <Text className="text-[11px] text-faint">Flat {message.author.flat}</Text>
          ) : null}
          <Text className="ml-auto text-[10px] text-faint">{timeAgo(message.created_at)}</Text>
        </View>
        <View className="self-start max-w-[88%] rounded-2xl rounded-tl-md bg-inset px-3 py-2">
          <Text className="text-[13px] leading-5 text-ink">{message.body}</Text>
        </View>
      </View>
      {canDelete ? (
        <Pressable onPress={onDelete} hitSlop={8} className="mt-1">
          <Ionicons name="trash-outline" size={13} color={c.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
