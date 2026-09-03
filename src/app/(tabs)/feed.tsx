import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { openPhotoPicker } from '../../lib/photo';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Modal, Platform, Pressable,
  RefreshControl, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../components/T';
import { Avatar, Button, Chip, ErrorState, ScreenHeader, useKeyboardInset, useResponsive } from '../../components/ui';
import { ModerationMenu } from '../../components/ModerationMenu';
import { useAuth } from '../../context/auth';
import { useConfirm } from '../../context/confirm';
import { useBlocks } from '../../context/blocks';
import { useToast } from '../../context/toast';
import {
  ALL_POST_CATEGORIES, POST_CATEGORY_COLORS, POST_CATEGORY_ICONS,
  POST_CATEGORY_LABELS, PostCategory, PostRow,
  createPost, fetchPosts, subscribeToFeed,
} from '../../lib/posts';
import { useDraft } from '../../lib/draft';
import { IMAGE_CACHE_PROPS } from '../../lib/image';
import { isSupabaseConfigured } from '../../lib/supabase';
import { layout, useThemeColors } from '../../theme';

const FEED_MAX = layout.maxContent; // same content width as every other tab

const FILTER_TABS: { key: PostCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'general', label: 'General' },
  { key: 'announcement', label: 'Announcements' },
  { key: 'issue', label: 'Issues' },
  { key: 'event', label: 'Events' },
  { key: 'lost_found', label: 'Lost & Found' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'suggestion', label: 'Suggestions' },
];

export default function FeedScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { userId, communityId, profile, isAdmin } = useAuth();
  const { filterBlocked } = useBlocks();

  const PAGE = 20;

  const [posts, setPosts] = useState<PostRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<PostCategory | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [showCompose, setShowCompose] = useState(false);

  // Posts by blocked members never reach the list.
  const visiblePosts = useMemo(
    () => filterBlocked(posts, (p) => p.author_id),
    [posts, filterBlocked],
  );

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try {
      const cat = activeFilter === 'all' ? undefined : activeFilter;
      const rows = await fetchPosts(communityId, cat, 0, PAGE);
      setPosts(rows);
      setPage(0);
      setHasMore(rows.length === PAGE);
      setLoadFailed(false);
    } catch (e) {
      console.error('feed: load failed', e);
      setLoadFailed(true);
    } finally { setLoading(false); }
  }, [communityId, activeFilter, toast]);

  const loadMore = useCallback(async () => {
    if (!communityId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const cat = activeFilter === 'all' ? undefined : activeFilter;
      const nextPage = page + 1;
      const rows = await fetchPosts(communityId, cat, nextPage * PAGE, PAGE);
      setPosts((prev) => [...prev, ...rows]);
      setPage(nextPage);
      setHasMore(rows.length === PAGE);
    } catch { toast.show('Could not load more posts'); }
    finally { setLoadingMore(false); }
  }, [communityId, activeFilter, loadingMore, hasMore, page]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!communityId) return;
    const unsub = subscribeToFeed(communityId, load);
    return unsub;
  }, [communityId, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="chatbubbles-outline"
        title="Feed"
        hideSociety
        onAdd={() => setShowCompose(true)}
        addLabel="New post"
        subBar={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4" contentContainerStyle={{ gap: 6 }}>
            {FILTER_TABS.map((tab) => (
              <Chip
                key={tab.key}
                label={tab.label}
                selected={activeFilter === tab.key}
                onPress={() => setActiveFilter(tab.key)}
              />
            ))}
          </ScrollView>
        }
      />

      <View style={{ flex: 1, width: '100%', maxWidth: FEED_MAX, alignSelf: 'center' }}>
      <FlashList
        data={loading ? [] : visiblePosts}
        keyExtractor={(item: PostRow) => item.id}
        renderItem={({ item }: { item: PostRow }) => <PostCard post={item} userId={userId} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 12 }}>
              {[1, 2, 3].map((i) => <PostCardSkeleton key={i} />)}
            </View>
          ) : loadFailed ? (
            <ErrorState
              title="Couldn't load the feed"
              message="Your society's posts are still there. Check your connection and try again."
              onRetry={onRefresh}
              retrying={refreshing}
            />
          ) : (
            <View className="items-center py-20">
              <Text style={{ fontSize: 44 }} className="mb-3">💬</Text>
              <Text className="font-display text-xl text-ink mb-1">
                {activeFilter === 'all' ? 'No posts yet' : `No ${POST_CATEGORY_LABELS[activeFilter as PostCategory]} posts`}
              </Text>
              <Text className="font-sans text-[14px] text-muted text-center max-w-xs">
                Be the first to start a conversation in your society.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          hasMore ? (
            <Pressable
              onPress={loadMore}
              disabled={loadingMore}
              className="mt-3 items-center card py-3.5 active:opacity-70"
            >
              {loadingMore
                ? <ActivityIndicator size="small" color={c.muted} />
                : <Text className="font-sans-sb text-[14px] text-muted">Load more</Text>}
            </Pressable>
          ) : posts.length > 0 ? (
            <Text className="font-sans py-4 text-center text-[12px] text-faint">You're all caught up</Text>
          ) : null
        }
      />
      </View>

      {/* Compose modal */}
      <ComposeModal
        visible={showCompose}
        onClose={() => setShowCompose(false)}
        onPosted={() => { setShowCompose(false); load(); }}
        communityId={communityId}
        authorId={userId}
        authorName={profile?.name}
        isAdmin={isAdmin}
      />
    </View>
  );
}

function PostCardSkeleton() {
  const c = useThemeColors();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  const S = ({ w, h, r = 6 }: { w: string | number; h: number; r?: number }) => (
    <View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: c.inset }} />
  );

  return (
    <Animated.View style={[{ opacity, borderWidth: 1, borderColor: c.line, borderRadius: 24, overflow: 'hidden' }]}>
      {/* colour strip */}
      <View style={{ height: 3, backgroundColor: c.inset }} />
      <View style={{ padding: 16 }}>
        {/* category chip + timestamp */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <S w={80} h={18} r={20} />
          <S w={40} h={12} r={6} />
        </View>
        {/* body lines */}
        <S w="90%" h={13} r={6} />
        <View style={{ height: 5 }} />
        <S w="70%" h={13} r={6} />
        <View style={{ height: 5 }} />
        <S w="55%" h={13} r={6} />
        {/* author row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <S w={22} h={22} r={11} />
          <S w={100} h={11} r={6} />
        </View>
      </View>
    </Animated.View>
  );
}

const PostCard = memo(function PostCard({ post, userId }: { post: PostRow; userId: string | null }) {
  const router = useRouter();
  const c = useThemeColors();
  const color = POST_CATEGORY_COLORS[post.category] ?? c.accent;
  const icon = POST_CATEGORY_ICONS[post.category];
  const isOwn = post.author_id === userId;
  const timeAgo = formatTimeAgo(post.created_at);

  return (
    <Pressable
      onPress={() => router.push(`/feed/${post.id}` as any)}
      className="overflow-hidden rounded-2xl bg-surface active:opacity-85"
      style={{ borderWidth: 1, borderColor: c.line }}
    >
      {/* Accent rule — clipped by the card, so it follows the corner instead
          of guessing at it. */}
      <View style={{ height: 3, backgroundColor: c.accent }} />

      <View className="p-4">
        {/* Header row */}
        <View className="mb-2 flex-row items-center gap-2">
          <View className="flex-row items-center gap-1.5 rounded-full px-2 py-0.5" style={{ backgroundColor: color + '20' }}>
            <Ionicons name={icon as any} size={11} color={color} />
            <Text className="text-[11px] font-sans-sb" style={{ color }}>{POST_CATEGORY_LABELS[post.category]}</Text>
          </View>
          {post.pinned ? (
            <View className="flex-row items-center gap-1 rounded-full bg-highlight-soft px-2 py-0.5">
              <Ionicons name="pin" size={10} color={c.highlightInk} />
              <Text className="text-[10px] font-sans-sb text-highlight-ink">Pinned</Text>
            </View>
          ) : null}
          {post.resolved ? (
            <View className="flex-row items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5">
              <Ionicons name="checkmark-circle" size={10} color={c.accent} />
              <Text className="text-[10px] font-sans-sb text-accent">Resolved</Text>
            </View>
          ) : null}
          <Text className="font-sans ml-auto text-[11px] text-faint">{timeAgo}</Text>
        </View>

        {/* Content */}
        {post.title ? (
          <T source="post" id={post.id} field="title" text={post.title} showToggle={false} className="mb-1 font-sans-sb text-[15px] text-ink" numberOfLines={2} />
        ) : null}
        <T source="post" id={post.id} field="body" text={post.body} showToggle={false} className="text-[13px] leading-5 text-muted" numberOfLines={post.title ? 2 : 3} />

        {/* Photo (first one, full-width; badge shows the total count) */}
        {post.photos?.length ? (
          <View className="mt-2.5 w-full overflow-hidden rounded-xl bg-inset" style={{ height: 200 }}>
            <Image source={{ uri: post.photos[0] }} style={{ width: '100%', height: '100%' }} contentFit="contain" {...IMAGE_CACHE_PROPS} />
            {post.photos.length > 1 ? (
              <View className="absolute bottom-2 right-2 flex-row items-center gap-1 rounded-full bg-black/55 px-2 py-0.5">
                <Ionicons name="images-outline" size={12} color="#fff" />
                <Text className="text-[11px] font-sans-sb text-white">{post.photos.length}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Author row */}
        <View className="mt-3 flex-row items-center gap-2">
          <Avatar name={post.author?.name ?? '?'} size={22} />
          <Text className="font-sans flex-1 text-[12px] text-faint">
            {isOwn ? 'You' : post.author?.name ?? 'Someone'}
            {post.author?.flat ? ` · Flat ${post.author.flat}` : ''}
          </Text>
          <ModerationMenu
            targetType="post"
            targetId={post.id}
            targetOwnerId={post.author_id}
            targetOwnerName={post.author?.name}
            size={16}
          />
          <Ionicons name="chevron-forward" size={14} color={c.faint} />
        </View>
      </View>
    </Pressable>
  );
});

function ComposeModal({ visible, onClose, onPosted, communityId, authorId, authorName, isAdmin }: {
  visible: boolean; onClose: () => void; onPosted: () => void;
  communityId: string; authorId: string | null; authorName?: string; isAdmin: boolean;
}) {
  const toast = useToast();
  const c = useThemeColors();
  const availableCategories = ALL_POST_CATEGORIES.filter(
    (cat) => cat !== 'announcement' || isAdmin,
  );
  // useDraft, not useState: (tabs)/_layout renders a bare Slot, so switching
  // tabs unmounts this modal and a half-written post vanished with it. The
  // comment box has used the draft store since it was written, for exactly
  // this reason; the composer — much the longer thing to retype — never did.
  const [category, setCategory] = useDraft<PostCategory>('post:category', 'general');
  const [title, setTitle] = useDraft('post:title', '');
  const [body, setBody] = useDraft('post:body', '');
  const [photos, setPhotos] = useDraft<string[]>('post:photos', []);
  const [bodyHeight, setBodyHeight] = useState(160);
  const [posting, setPosting] = useState(false);
  const bodyRef = useRef<TextInput>(null);
  const modalInsets = useSafeAreaInsets();
  // Inside an RN Modal, so the JS Keyboard API rather than Reanimated.
  const composeKb = useKeyboardInset();
  const confirm = useConfirm();

  const clearDraft = () => {
    setCategory('general');
    setTitle('');
    setBody('');
    setPhotos([]);
  };

  const closeWithGuard = async () => {
    const hasWork = title.trim() || body.trim() || photos.length > 0;
    if (!hasWork) return onClose();
    const discard = await confirm({
      title: 'Discard this post?',
      message: "What you've written will be lost.",
      confirmLabel: 'Discard',
      destructive: true,
    });
    // Actually discard it. This used to hide the modal and keep the text, so
    // reopening showed what the user had just been told was gone.
    if (discard) { clearDraft(); onClose(); }
  };
  const MAX_PHOTOS = 4;

  const pickPhotos = async () => {
    if (photos.length >= MAX_PHOTOS) return toast.show(`Up to ${MAX_PHOTOS} photos`);
    const res = await openPhotoPicker({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - photos.length, quality: 0.9 });
    if (!res.canceled) setPhotos([...photos, ...res.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS));
  };

  const handlePost = async () => {
    if (!body.trim()) return toast.show('Please write something');
    if (!authorId || !communityId) return toast.show('Not signed in');
    setPosting(true);
    try {
      await createPost({ communityId, authorId, category, title: title.trim() || undefined, body, photoUris: photos });
      setTitle(''); setBody(''); setCategory('general'); setBodyHeight(160); setPhotos([]);
      onPosted();
    } catch { toast.show('Could not post — try again'); }
    finally { setPosting(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeWithGuard}>
      <View className="flex-1 bg-bg" style={{ paddingTop: modalInsets.top, paddingBottom: composeKb }}>
        {/* Header — close + title only, no post button here */}
        <View className="flex-row items-center justify-between border-b border-line px-4 py-4">
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={closeWithGuard} hitSlop={10}>
            <Ionicons name="close" size={24} color={c.muted} />
          </Pressable>
          <Text className="font-sans-sb text-[16px] text-ink">New Post</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {/* Category picker */}
          <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              {availableCategories.map((cat) => {
                const color = POST_CATEGORY_COLORS[cat] ?? c.accent;
                const on = category === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    className="rounded-full px-3 py-1.5"
                    style={{ backgroundColor: on ? color : color + '20' }}
                  >
                    <Text className="text-[12px] font-sans-sb" style={{ color: on ? '#fff' : color }}>
                      {POST_CATEGORY_LABELS[cat]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Author */}
          <View className="mb-4 flex-row items-center gap-2">
            <Avatar name={authorName ?? '?'} size={32} />
            <Text className="font-sans-sb text-[14px] text-ink">{authorName ?? 'You'}</Text>
          </View>

          {/* Title (optional) */}
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title (optional)"
            placeholderTextColor={c.faint}
            className="mb-3 font-sans-sb text-[18px] text-ink"
            style={{ outline: 'none' } as any}
            returnKeyType="next"
            onSubmitEditing={() => bodyRef.current?.focus()}
          />

          {/* Body — grows with content */}
          <TextInput
            ref={bodyRef}
            value={body}
            onChangeText={setBody}
            placeholder="What's on your mind? Share with your society…"
            placeholderTextColor={c.faint}
            multiline
            scrollEnabled={false}
            onContentSizeChange={(e) => {
              // Grow-only + no padding: with scrollEnabled=false the reported
              // size tracks the element height, so adding padding here would make
              // it inflate forever (React #185 update loop). Only grow toward the
              // measured content height and stop once they match.
              const next = Math.max(160, Math.ceil(e.nativeEvent.contentSize.height));
              setBodyHeight((prev) => (next > prev ? next : prev));
            }}
            className="text-[15px] leading-6 text-ink"
            style={{ minHeight: bodyHeight, outline: 'none', textAlignVertical: 'top' } as any}
            autoFocus
          />

          {/* Photos */}
          {photos.length > 0 ? (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {photos.map((uri, i) => (
                <View key={`${uri}-${i}`} className="overflow-hidden rounded-xl" style={{ width: 88, height: 88 }}>
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setPhotos(photos.filter((_, idx) => idx !== i))} className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60">
                    <Ionicons name="close" size={13} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>

        {/* Sticky footer — add-photo + Post button, just above the keyboard */}
        <View className="flex-row items-center gap-2 border-t border-line px-4 py-3">
          <Pressable
            onPress={pickPhotos}
            disabled={photos.length >= MAX_PHOTOS}
            className="h-12 w-12 items-center justify-center rounded-2xl border border-line active:bg-inset"
            style={{ opacity: photos.length >= MAX_PHOTOS ? 0.4 : 1 }}
            accessibilityLabel="Add photos"
          >
            <Ionicons name="image-outline" size={22} color={c.muted} />
          </Pressable>
          <View className="flex-1">
            <Button
              label={posting ? 'Posting…' : 'Post to feed'}
              icon="send"
              size="lg"
              fullWidth
              loading={posting}
              disabled={!body.trim()}
              onPress={handlePost}
            />
          </View>
        </View>
      </View>
    </Modal>
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
