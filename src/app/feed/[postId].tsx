import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { openPhotoPicker } from '../../lib/photo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../components/T';
import { Avatar, Container, ErrorState } from '../../components/ui';
import { ModerationMenu } from '../../components/ModerationMenu';
import { useAuth } from '../../context/auth';
import { useBlocks } from '../../context/blocks';
import { useDraft } from '../../lib/draft';
import { IMAGE_CACHE_PROPS } from '../../lib/image';
import { useToast } from '../../context/toast';
import { useConfirm } from '../../context/confirm';
import {
  ALL_POST_CATEGORIES, CommentRow, POST_CATEGORY_COLORS, POST_CATEGORY_ICONS, POST_CATEGORY_LABELS,
  PostCategory, PostRow, createComment, deleteComment, deletePost,
  fetchComments, fetchPostById, setPinned, setResolved, subscribeToComments, updateComment, updatePost, uploadPostPhoto,
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
  const [loadFailed, setLoadFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const { filterBlocked } = useBlocks();
  const visibleComments = useMemo(
    () => filterBlocked(comments, (cm) => cm.author_id),
    [comments, filterBlocked],
  );
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
      setLoadFailed(false);
    } catch (e) {
      // A failed request is not a deleted post. Saying "removed by the author
      // or an admin" when the network dropped accuses someone of something
      // they did not do.
      console.error('post: load failed', e);
      setLoadFailed(true);
    } finally { setLoading(false); }
  }, [postId]);

  const retry = useCallback(async () => {
    setRetrying(true);
    setLoading(true);
    await loadPost();
    setRetrying(false);
  }, [loadPost]);

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

  if (loadFailed) {
    return (
      <View className="flex-1 bg-bg">
        <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
          <Pressable onPress={goBack} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset" accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
        </View>
        <View className="flex-1 justify-center">
          <ErrorState
            title="Couldn't load this post"
            message="Nothing has been removed — we just couldn't reach it. Check your connection and try again."
            onRetry={retry}
            retrying={retrying}
          />
        </View>
      </View>
    );
  }

  if (!post) {
    return (
      <View className="flex-1 bg-bg">
        <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color={c.faint} />
          <Text className="mt-3 text-center font-sans-bold text-[16px] text-ink">Post removed</Text>
          <Text className="font-sans mt-1.5 text-center text-[13px] text-muted">This post is no longer available — it may have been removed by the author or an admin.</Text>
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
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
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
                <Ionicons name="pin" size={13} color={c.highlightInk} />
                <Text className="text-[12px] font-sans-sb text-highlight-ink">Pinned by admin</Text>
              </View>
            ) : null}
            {post.resolved ? (
              <View className="mb-2 flex-row items-center gap-1.5">
                <Ionicons name="checkmark-circle" size={13} color={c.accent} />
                <Text className="text-[12px] font-sans-sb text-accent">Marked as resolved</Text>
              </View>
            ) : null}

            {post.title ? (
              <T source="post" id={post.id} field="title" text={post.title} className="mb-2 font-display-x text-[22px] text-ink" />
            ) : null}
            <T source="post" id={post.id} field="body" text={post.body} className="text-[15px] leading-6 text-ink" />

            {/* Photos — sized to each photo's aspect ratio so it shows in full */}
            {post.photos?.length ? (
              <View className="mt-3 gap-2">
                {post.photos.map((url, i) => <PostImage key={i} uri={url} />)}
              </View>
            ) : null}

            {/* Author */}
            <View className="mt-4 flex-row items-center gap-2.5">
              <Avatar name={post.author?.name ?? '?'} size={32} />
              <View className="flex-1">
                <Text className="font-sans-sb text-[13px] text-ink">
                  {post.author_id === userId ? 'You' : post.author?.name ?? 'Someone'}
                </Text>
                <Text className="font-sans text-[11px] text-faint">
                  {post.author?.flat ? `Flat ${post.author.flat} · ` : ''}{formatTimeAgo(post.created_at)}
                </Text>
              </View>
              <ModerationMenu
                targetType="post"
                targetId={post.id}
                targetOwnerId={post.author_id}
                targetOwnerName={post.author?.name}
                size={16}
              />
            </View>
          </View>

          {/* Comments */}
          <View className="mb-4">
            <Text className="mb-3 text-[13px] font-sans-sb text-muted">
              {visibleComments.length === 0 ? 'No comments yet' : `${visibleComments.length} comment${visibleComments.length === 1 ? '' : 's'}`}
            </Text>
            <View className="gap-3">
              {visibleComments.map((comment) => (
                <CommentBubble key={comment.id} comment={comment} userId={userId} isAdmin={!!isAdmin} onDelete={() => handleDeleteComment(comment.id)} onChanged={loadPost} c={c} />
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
          <Pressable accessibilityRole="button" accessibilityLabel="Send comment"
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

function CommentBubble({ comment, userId, isAdmin, onDelete, onChanged, c }: {
  comment: CommentRow; userId: string | null; isAdmin: boolean; onDelete: () => void; onChanged: () => void; c: ReturnType<typeof useThemeColors>;
}) {
  const toast = useToast();
  const isOwn = comment.author_id === userId;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft.trim()) return toast.show('Comment can’t be empty');
    setSaving(true);
    try { await updateComment(comment.id, draft); setEditing(false); onChanged(); }
    catch { toast.show('Could not save'); } finally { setSaving(false); }
  };

  return (
    <View className="flex-row gap-2.5">
      <Avatar name={comment.author?.name ?? '?'} size={28} />
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-0.5">
          <Text className="font-sans-sb text-[12px] text-ink">{isOwn ? 'You' : comment.author?.name ?? 'Someone'}</Text>
          {comment.author?.flat ? <Text className="font-sans text-[11px] text-faint">Flat {comment.author.flat}</Text> : null}
          <Text className="font-sans ml-auto text-[11px] text-faint">{formatTimeAgo(comment.created_at)}</Text>
        </View>
        {editing ? (
          <View>
            <TextInput
              value={draft} onChangeText={setDraft} multiline autoFocus
              className="rounded-xl border border-line bg-inset px-3 py-2 text-[13px] text-ink"
              style={{ outline: 'none' } as any}
            />
            <View className="mt-1.5 flex-row gap-2">
              <Pressable onPress={save} disabled={saving} className="rounded-full bg-accent px-3 py-1"><Text className="text-[12px] font-sans-sb" style={{ color: c.onAccent }}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
              <Pressable onPress={() => { setDraft(comment.body); setEditing(false); }} className="rounded-full px-3 py-1" style={{ backgroundColor: c.inset }}><Text className="text-[12px] font-sans-sb text-muted">Cancel</Text></Pressable>
            </View>
          </View>
        ) : (
          <T source="comment" id={comment.id} field="body" text={comment.body} className="text-[13px] leading-5 text-ink" />
        )}
      </View>
      {!editing ? (
        <View className="mt-0.5 flex-row items-center gap-2.5">
          <ModerationMenu
            targetType="comment"
            targetId={comment.id}
            targetOwnerId={comment.author_id}
            targetOwnerName={comment.author?.name}
            size={14}
          />
          {isOwn || isAdmin ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Edit" onPress={() => { setDraft(comment.body); setEditing(true); }} hitSlop={8}>
              <Ionicons name="create-outline" size={14} color={c.faint} />
            </Pressable>
          ) : null}
          {(isOwn || isAdmin) ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Delete" onPress={onDelete} hitSlop={8}>
              <Ionicons name="trash-outline" size={14} color={c.faint} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Shows a post photo in full — frame adopts the image's own aspect ratio once
 *  known (capped so very tall portraits don't dominate), no cropping. */
function PostImage({ uri }: { uri: string }) {
  const [ar, setAr] = useState<number | null>(null);
  return (
    <View className="w-full overflow-hidden rounded-2xl bg-inset" style={ar ? { aspectRatio: Math.max(ar, 0.6) } : { height: 240 }}>
      <Image
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        onLoad={(e) => { const w = e.source?.width, h = e.source?.height; if (w && h) setAr(w / h); }}
        {...IMAGE_CACHE_PROPS}
      />
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
  const [photos, setPhotos] = useState<{ uri: string; isNew: boolean }[]>([]);
  const [saving, setSaving] = useState(false);
  const MAX_PHOTOS = 4;

  // Re-sync the fields whenever a different post opens.
  useEffect(() => {
    if (visible) {
      setCategory(post.category); setTitle(post.title ?? ''); setBody(post.body);
      setPhotos((post.photos ?? []).map((u) => ({ uri: u, isNew: false })));
    }
  }, [visible, post.id]);

  // Announcements stay admin-only; everyone else keeps the post's other options.
  const cats = ALL_POST_CATEGORIES.filter((k) => k !== 'announcement' || isAdmin || post.category === 'announcement');

  const pickPhotos = async () => {
    if (photos.length >= MAX_PHOTOS) return toast.show(`Up to ${MAX_PHOTOS} photos`);
    const res = await openPhotoPicker({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - photos.length, quality: 0.9 });
    if (!res.canceled) setPhotos((prev) => [...prev, ...res.assets.map((a) => ({ uri: a.uri, isNew: true }))].slice(0, MAX_PHOTOS));
  };

  const save = async () => {
    if (!body.trim()) return toast.show('Write something first');
    setSaving(true);
    try {
      // Keep existing URLs; upload freshly-picked photos (unique key avoids path clashes).
      const finalUrls: string[] = [];
      let key = Date.now();
      for (const p of photos) {
        if (!p.isNew) { finalUrls.push(p.uri); continue; }
        try { finalUrls.push(await uploadPostPhoto(p.uri, post.id, key++)); } catch { /* skip */ }
      }
      await updatePost(post.id, { category, title: title.trim() || null, body, photos: finalUrls });
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
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-full active:bg-inset">
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
            <TextInput value={body} onChangeText={setBody} placeholder="What's on your mind?" placeholderTextColor={c.faint} multiline className="mb-3 rounded-2xl border border-line bg-inset px-3.5 py-3 text-[15px] text-ink" style={{ minHeight: 120, outline: 'none' } as any} />

            {/* Photos */}
            <View className="mb-4 flex-row flex-wrap gap-2">
              {photos.map((p, i) => (
                <View key={`${p.uri}-${i}`} className="overflow-hidden rounded-xl" style={{ width: 76, height: 76 }}>
                  <Image source={{ uri: p.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} className="absolute right-1 top-1 h-5 w-5 items-center justify-center rounded-full bg-black/60">
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_PHOTOS ? (
                <Pressable onPress={pickPhotos} className="items-center justify-center rounded-xl border border-dashed border-line bg-inset active:opacity-70" style={{ width: 76, height: 76 }}>
                  <Ionicons name="image-outline" size={20} color={c.muted} />
                  <Text className="font-sans mt-0.5 text-[10px] text-muted">Add</Text>
                </Pressable>
              ) : null}
            </View>

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
      <Pressable accessibilityRole="button" accessibilityLabel="More options" onPress={() => setOpen(true)} hitSlop={8} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
        <Ionicons name="ellipsis-horizontal" size={20} color={c.muted} />
      </Pressable>
      {/* Rendered in a Modal so it always sits on top (not under later content). */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1" style={{ backgroundColor: '#00000055' }} onPress={() => setOpen(false)}>
          <View
            className="absolute overflow-hidden rounded-2xl border border-line bg-surface"
            style={{ top: insets.top + 52, right: 14, minWidth: 200, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 12 }}
          >
            {isOwner || isAdmin ? (
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
      <Text className={`text-[14px] font-sans-md ${danger ? 'text-danger' : 'text-ink'}`}>{label}</Text>
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
