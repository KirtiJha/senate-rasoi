import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable,
  RefreshControl, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import {
  ALL_POST_CATEGORIES, POST_CATEGORY_COLORS, POST_CATEGORY_ICONS,
  POST_CATEGORY_LABELS, PostCategory, PostRow,
  createPost, fetchPosts, subscribeToFeed,
} from '../../lib/posts';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useThemeColors } from '../../theme';

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

  const PAGE = 20;

  const [posts, setPosts] = useState<PostRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<PostCategory | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [showCompose, setShowCompose] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try {
      const cat = activeFilter === 'all' ? undefined : activeFilter;
      const rows = await fetchPosts(communityId, cat, 0, PAGE);
      setPosts(rows);
      setPage(0);
      setHasMore(rows.length === PAGE);
    } catch { toast.show('Could not load posts'); }
    finally { setLoading(false); }
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
      {/* Filter tabs */}
      <View style={{ paddingTop: isDesktop ? insets.top + 16 : 12 }} className="border-b border-line bg-bg">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 10 }}>
          {FILTER_TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveFilter(tab.key)}
              className={`rounded-full px-3.5 py-1.5 ${activeFilter === tab.key ? 'bg-accent' : 'bg-inset'}`}
            >
              <Text className={`text-[13px] font-sans-sb ${activeFilter === tab.key ? 'text-on-accent' : 'text-muted'}`}>{tab.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlashList
        data={loading ? [] : posts}
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
          ) : (
            <View className="items-center py-20">
              <Text style={{ fontSize: 44 }} className="mb-3">💬</Text>
              <Text className="font-display text-xl text-ink mb-1">
                {activeFilter === 'all' ? 'No posts yet' : `No ${POST_CATEGORY_LABELS[activeFilter as PostCategory]} posts`}
              </Text>
              <Text className="text-[14px] text-muted text-center max-w-xs">
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
              className="mt-3 items-center rounded-2xl border border-line bg-surface py-3.5 active:opacity-70"
            >
              {loadingMore
                ? <ActivityIndicator size="small" color={c.muted} />
                : <Text className="font-sans-sb text-[14px] text-muted">Load more</Text>}
            </Pressable>
          ) : posts.length > 0 ? (
            <Text className="py-4 text-center text-[12px] text-faint">You're all caught up</Text>
          ) : null
        }
      />

      {/* FAB */}
      <View className="absolute bottom-5 right-5">
        <Pressable
          onPress={() => setShowCompose(true)}
          className="h-14 flex-row items-center gap-2 rounded-full bg-accent px-5 shadow-fab active:bg-accent-press"
        >
          <Ionicons name="add" size={22} color={c.onAccent} />
          <Text className="font-sans-sb text-[15px] text-on-accent">New Post</Text>
        </Pressable>
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
  const color = POST_CATEGORY_COLORS[post.category];
  const icon = POST_CATEGORY_ICONS[post.category];
  const isOwn = post.author_id === userId;
  const timeAgo = formatTimeAgo(post.created_at);

  return (
    <Pressable onPress={() => router.push(`/feed/${post.id}` as any)} className="rounded-3xl bg-surface active:opacity-85" style={{ borderWidth: 1, borderColor: c.line }}>
      {/* Category accent strip */}
      <View style={{ height: 3, backgroundColor: color, borderTopLeftRadius: 20, borderTopRightRadius: 20 }} />

      <View className="p-4">
        {/* Header row */}
        <View className="mb-2 flex-row items-center gap-2">
          <View className="flex-row items-center gap-1.5 rounded-full px-2 py-0.5" style={{ backgroundColor: color + '20' }}>
            <Ionicons name={icon as any} size={11} color={color} />
            <Text className="text-[11px] font-sans-sb" style={{ color }}>{POST_CATEGORY_LABELS[post.category]}</Text>
          </View>
          {post.pinned ? (
            <View className="flex-row items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5">
              <Ionicons name="pin" size={10} color="#D97706" />
              <Text className="text-[10px] font-sans-sb text-amber-700">Pinned</Text>
            </View>
          ) : null}
          {post.resolved ? (
            <View className="flex-row items-center gap-1 rounded-full bg-green-100 px-2 py-0.5">
              <Ionicons name="checkmark-circle" size={10} color="#059669" />
              <Text className="text-[10px] font-sans-sb text-green-700">Resolved</Text>
            </View>
          ) : null}
          <Text className="ml-auto text-[11px] text-faint">{timeAgo}</Text>
        </View>

        {/* Content */}
        {post.title ? (
          <Text className="mb-1 font-sans-sb text-[15px] text-ink" numberOfLines={2}>{post.title}</Text>
        ) : null}
        <Text className="text-[13px] leading-5 text-muted" numberOfLines={post.title ? 2 : 3}>{post.body}</Text>

        {/* Author row */}
        <View className="mt-3 flex-row items-center gap-2">
          <Avatar name={post.author?.name ?? '?'} size={22} />
          <Text className="flex-1 text-[12px] text-faint">
            {isOwn ? 'You' : post.author?.name ?? 'Someone'}
            {post.author?.flat ? ` · Flat ${post.author.flat}` : ''}
          </Text>
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
  const [category, setCategory] = useState<PostCategory>('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const bodyRef = useRef<TextInput>(null);

  const handlePost = async () => {
    if (!body.trim()) return toast.show('Please write something');
    if (!authorId || !communityId) return toast.show('Not signed in');
    setPosting(true);
    try {
      await createPost({ communityId, authorId, category, title: title.trim() || undefined, body });
      setTitle(''); setBody(''); setCategory('general');
      onPosted();
    } catch { toast.show('Could not post — try again'); }
    finally { setPosting(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header — close + title only, no post button here */}
        <View className="flex-row items-center justify-between border-b border-line px-4 py-4">
          <Pressable onPress={onClose} hitSlop={10}>
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
                const color = POST_CATEGORY_COLORS[cat];
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

          {/* Body */}
          <TextInput
            ref={bodyRef}
            value={body}
            onChangeText={setBody}
            placeholder="What's on your mind? Share with your society…"
            placeholderTextColor={c.faint}
            multiline
            className="min-h-[120px] text-[15px] leading-6 text-ink"
            style={{ outline: 'none', textAlignVertical: 'top' } as any}
            autoFocus
          />
        </ScrollView>

        {/* Sticky footer — Post button lives here, just above the keyboard */}
        <View className="border-t border-line px-4 py-3">
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
      </KeyboardAvoidingView>
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
