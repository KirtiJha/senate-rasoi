import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../components/T';
import { Avatar, Container } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useDraft } from '../../lib/draft';
import { useToast } from '../../context/toast';
import { useConfirm } from '../../context/confirm';
import {
  ALL_POST_CATEGORIES, CommentRow, POST_CATEGORY_COLORS, POST_CATEGORY_ICONS, POST_CATEGORY_LABELS,
  PostCategory, PostRow, createComment, deleteComment, deletePost,
  fetchComments, fetchPostById, setPinned, setResolved, subscribeToComments, updatePost,
} from '../../lib/posts';
import { useThemeColors } from '../../theme';

export default function PostThreadScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { userId, isAdmin } = useAuth();

  const [post, setPost] = useState<PostRow | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // On web, opening this route directly (or after a refresh) leaves an empty
  // history stack, so router.back() is a no-op. Fall back to the feed.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/feed' as any);
  };
  const [commentBody, setCommentBody] = useDraft('comments:' + (postId ?? ''), '');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadPost = useCallback(async () => {
    if (!postId) return;
    try {
      const [p, cmts] = await Promise.all([fetchPostById(postId), fetchComments(postId)]);
      setPost(p);
      setComments(cmts);
    } catch { toast.show('Could not load post'); }
    finally { setLoading(false); }
  }, [postId, toast]);

  useEffect(() => { loadPost(); }, [loadPost]);

  useEffect(() => {
    if (!postId) return;
    const unsub = subscribeToComments(postId, () => {
      fetchComments(postId).then(setComments).catch(() => {});
    });
    return unsub;
  }, [postId]);

  const sendComment = async () => {
    if (!commentBody.trim() || !userId || !postId) return;
    setSending(true);
    try {
      const c = await createComment(postId, userId, commentBody.trim());
      setComments((prev) => [...prev, c]);
      setCommentBody('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch { toast.show('Could not send comment'); }
    finally { setSending(false); }
  };

  const handleDeletePost = async () => {
    if (!postId) return;
    if (!(await confirm({ title: 'Delete post', message: 'Delete this post and its comments?', confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deletePost(postId);
      goBack();
    } catch { toast.show('Could not delete post'); }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!(await confirm({ title: 'Delete comment', message: 'Delete this comment?', confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch { toast.show('Could not delete comment'); }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Loading…</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View className="flex-1 bg-bg">
        <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
          <Pressable onPress={goBack} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color={c.faint} />
          <Text className="mt-3 text-center font-sans-bold text-[16px] text-ink">Post removed</Text>
          <Text className="mt-1.5 text-center text-[13px] text-muted">This post is no longer available — it may have been removed by the author or an admin.</Text>
          <Pressable onPress={goBack} className="mt-5 rounded-xl border border-line bg-surface px-5 py-2.5 active:bg-inset">
            <Text className="font-sans-sb text-[14px] text-ink">Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const color = POST_CATEGORY_COLORS[post.category];
  const icon = POST_CATEGORY_ICONS[post.category];
  const isOwner = post.author_id === userId;
  const canManage = isOwner || isAdmin;

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
        <View className="flex-row items-center gap-2">
          <Pressable onPress={goBack} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
          <View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: color + '20' }}>
            <Ionicons name={icon as any} size={13} color={color} />
            <Text className="text-[12px] font-sans-sb" style={{ color }}>{POST_CATEGORY_LABELS[post.category]}</Text>
          </View>
          <View className="flex-1" />
          {canManage ? (
            <PostMenu post={post} isOwner={isOwner} isAdmin={!!isAdmin} onEdit={() => setEditing(true)} onDelete={handleDeletePost} onPinToggle={async () => { await setPinned(post.id, !post.pinned); loadPost(); }} onResolveToggle={async () => { await setResolved(post.id, !post.resolved); loadPost(); }} c={c} />
          ) : null}
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* Post body */}
          <View className="mb-6">
            {post.pinned ? (
              <View className="mb-2 flex-row items-center gap-1.5">
                <Ionicons name="pin" size={13} color="#D97706" />
                <Text className="text-[12px] font-sans-sb text-amber-600">Pinned by admin</Text>
              </View>
            ) : null}
            {post.resolved ? (
              <View className="mb-2 flex-row items-center gap-1.5">
                <Ionicons name="checkmark-circle" size={13} color="#059669" />
                <Text className="text-[12px] font-sans-sb text-green-600">Marked as resolved</Text>
              </View>
            ) : null}

            {post.title ? (
              <T source="post" id={post.id} field="title" text={post.title} className="mb-2 font-display-x text-[22px] text-ink" />
            ) : null}
            <T source="post" id={post.id} field="body" text={post.body} className="text-[15px] leading-6 text-ink" />

            {/* Author */}
            <View className="mt-4 flex-row items-center gap-2.5">
              <Avatar name={post.author?.name ?? '?'} size={32} />
              <View>
                <Text className="font-sans-sb text-[13px] text-ink">
                  {post.author_id === userId ? 'You' : post.author?.name ?? 'Someone'}
                </Text>
                <Text className="text-[11px] text-faint">
                  {post.author?.flat ? `Flat ${post.author.flat} · ` : ''}{formatTimeAgo(post.created_at)}
                </Text>
              </View>
            </View>
          </View>

          {/* Comments */}
          <View className="mb-4">
            <Text className="mb-3 text-[13px] font-sans-sb text-muted">
              {comments.length === 0 ? 'No comments yet' : `${comments.length} comment${comments.length === 1 ? '' : 's'}`}
            </Text>
            <View className="gap-3">
              {comments.map((comment) => (
                <CommentBubble key={comment.id} comment={comment} userId={userId} isAdmin={!!isAdmin} onDelete={() => handleDeleteComment(comment.id)} c={c} />
              ))}
            </View>
          </View>
        </Container>
      </ScrollView>

      {/* Reply bar */}
      <View style={{ paddingBottom: insets.bottom + 8 }} className="border-t border-line bg-bg px-4 pt-3">
        <View className="flex-row items-end gap-2">
          <Avatar name={userId ? 'Me' : '?'} size={32} />
          <View className="flex-1 rounded-2xl border border-line bg-inset px-3 py-2">
            <TextInput
              value={commentBody}
              onChangeText={setCommentBody}
              placeholder="Add a comment…"
              placeholderTextColor={c.faint}
              multiline
              maxLength={500}
              className="max-h-24 text-[14px] text-ink"
              style={{ outline: 'none' } as any}
            />
          </View>
          <Pressable
            onPress={sendComment}
            disabled={sending || !commentBody.trim()}
            className={`h-10 w-10 items-center justify-center rounded-full ${commentBody.trim() ? 'bg-accent' : 'bg-inset'}`}
          >
            <Ionicons name="send" size={18} color={commentBody.trim() ? c.onAccent : c.faint} />
          </Pressable>
        </View>
      </View>

      <EditPostModal
        visible={editing}
        post={post}
        isAdmin={!!isAdmin}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); loadPost(); }}
        c={c}
      />
    </KeyboardAvoidingView>
  );
}

function CommentBubble({ comment, userId, isAdmin, onDelete, c }: {
  comment: CommentRow; userId: string | null; isAdmin: boolean; onDelete: () => void; c: ReturnType<typeof useThemeColors>;
}) {
  const isOwn = comment.author_id === userId;
  return (
    <View className="flex-row gap-2.5">
      <Avatar name={comment.author?.name ?? '?'} size={28} />
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-0.5">
          <Text className="font-sans-sb text-[12px] text-ink">{isOwn ? 'You' : comment.author?.name ?? 'Someone'}</Text>
          {comment.author?.flat ? <Text className="text-[11px] text-faint">Flat {comment.author.flat}</Text> : null}
          <Text className="ml-auto text-[11px] text-faint">{formatTimeAgo(comment.created_at)}</Text>
        </View>
        <T source="comment" id={comment.id} field="body" text={comment.body} className="text-[13px] leading-5 text-ink" />
      </View>
      {(isOwn || isAdmin) ? (
        <Pressable onPress={onDelete} hitSlop={8} className="mt-0.5">
          <Ionicons name="trash-outline" size={14} color={c.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

function EditPostModal({ visible, post, isAdmin, onClose, onSaved, c }: {
  visible: boolean; post: PostRow; isAdmin: boolean;
  onClose: () => void; onSaved: () => void; c: ReturnType<typeof useThemeColors>;
}) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<PostCategory>(post.category);
  const [title, setTitle] = useState(post.title ?? '');
  const [body, setBody] = useState(post.body);
  const [saving, setSaving] = useState(false);

  // Re-sync the fields whenever a different post opens.
  useEffect(() => {
    if (visible) { setCategory(post.category); setTitle(post.title ?? ''); setBody(post.body); }
  }, [visible, post.id]);

  // Announcements stay admin-only; everyone else keeps the post's other options.
  const cats = ALL_POST_CATEGORIES.filter((k) => k !== 'announcement' || isAdmin || post.category === 'announcement');

  const save = async () => {
    if (!body.trim()) return toast.show('Write something first');
    setSaving(true);
    try {
      await updatePost(post.id, { category, title: title.trim() || null, body });
      toast.show('Post updated ✓');
      onSaved();
    } catch { toast.show('Could not save — try again'); } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: '#00000066' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="rounded-t-3xl bg-bg px-4 pt-3" style={{ paddingBottom: insets.bottom + 16 }}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-display-x text-[18px] text-ink">Edit post</Text>
              <Pressable onPress={onClose} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-full active:bg-inset">
                <Ionicons name="close" size={20} color={c.muted} />
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-1" contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
              {cats.map((k) => {
                const on = category === k;
                const color = POST_CATEGORY_COLORS[k];
                return (
                  <Pressable key={k} onPress={() => setCategory(k)} className="flex-row items-center gap-1 rounded-full border px-3 py-1.5" style={{ borderColor: on ? color : c.line, backgroundColor: on ? color : c.surface }}>
                    <Ionicons name={POST_CATEGORY_ICONS[k] as any} size={12} color={on ? '#fff' : c.muted} />
                    <Text className="text-[12px] font-sans-sb" style={{ color: on ? '#fff' : c.muted }}>{POST_CATEGORY_LABELS[k]}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <TextInput value={title} onChangeText={setTitle} placeholder="Title (optional)" placeholderTextColor={c.faint} className="mb-2 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink" style={{ outline: 'none' } as any} />
            <TextInput value={body} onChangeText={setBody} placeholder="What's on your mind?" placeholderTextColor={c.faint} multiline className="mb-4 rounded-2xl border border-line bg-inset px-3.5 py-3 text-[15px] text-ink" style={{ minHeight: 120, outline: 'none' } as any} />

            <Pressable onPress={save} disabled={saving} className="items-center rounded-2xl bg-accent py-3 active:opacity-80" style={{ opacity: saving ? 0.6 : 1 }}>
              <Text className="font-sans-sb text-[15px]" style={{ color: c.onAccent }}>{saving ? 'Saving…' : 'Save changes'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function PostMenu({ post, isOwner, isAdmin, onEdit, onDelete, onPinToggle, onResolveToggle, c }: {
  post: PostRow; isOwner: boolean; isAdmin: boolean;
  onEdit: () => void; onDelete: () => void; onPinToggle: () => void; onResolveToggle: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const isIssue = post.category === 'issue' || post.category === 'feedback';
  const canManage = isOwner || isAdmin;
  if (!canManage) return null; // no actions available → no menu button at all

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
        <Ionicons name="ellipsis-horizontal" size={20} color={c.muted} />
      </Pressable>
      {/* Rendered in a Modal so it always sits on top (not under later content). */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1" style={{ backgroundColor: '#00000055' }} onPress={() => setOpen(false)}>
          <View
            className="absolute overflow-hidden rounded-2xl border border-line bg-surface"
            style={{ top: insets.top + 52, right: 14, minWidth: 200, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 12 }}
          >
            {isOwner ? (
              <MenuItem icon="create-outline" label="Edit post" onPress={() => { setOpen(false); onEdit(); }} c={c} />
            ) : null}
            {isAdmin ? (
              <MenuItem icon="pin-outline" label={post.pinned ? 'Unpin' : 'Pin to top'} onPress={() => { setOpen(false); onPinToggle(); }} c={c} />
            ) : null}
            {isAdmin && isIssue ? (
              <MenuItem icon="checkmark-circle-outline" label={post.resolved ? 'Reopen' : 'Mark resolved'} onPress={() => { setOpen(false); onResolveToggle(); }} c={c} />
            ) : null}
            <MenuItem icon="trash-outline" label="Delete post" onPress={() => { setOpen(false); onDelete(); }} c={c} danger />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function MenuItem({ icon, label, onPress, c, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; c: ReturnType<typeof useThemeColors>; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-2.5 px-4 py-3 active:bg-inset">
      <Ionicons name={icon} size={16} color={danger ? '#DC2626' : c.muted} />
      <Text className={`text-[14px] font-sans-md ${danger ? 'text-red-600' : 'text-ink'}`}>{label}</Text>
    </Pressable>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
