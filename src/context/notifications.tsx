import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '../components/ui';
import {
  NotificationItem, NotificationType, clearAllNotifications, fetchNotifications, markRead, markUnread, subscribeNotifications,
} from '../lib/notifications';
import { isSupabaseConfigured } from '../lib/supabase';
import { useThemeColors } from '../theme';
import { useAuth } from './auth';

interface NotifCtx {
  unreadCount: number;
  open: () => void;
}
const Ctx = createContext<NotifCtx>({ unreadCount: 0, open: () => {} });
export function useNotifications() { return useContext(Ctx); }

const TYPE_META: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  announcement: { icon: 'megaphone', color: '#F59E0B' },
  post: { icon: 'chatbubble-ellipses', color: '#3B82F6' },
  listing: { icon: 'pricetag', color: '#14B8A6' },
  poll: { icon: 'stats-chart', color: '#6366F1' },
  message: { icon: 'mail', color: '#0EA5E9' },
  dish: { icon: 'restaurant', color: '#E8650A' },
  tiffin: { icon: 'repeat', color: '#F59E0B' },
  sport: { icon: 'football', color: '#16A34A' },
  document: { icon: 'folder', color: '#0EA5E9' },
  payment: { icon: 'wallet', color: '#16A34A' },
  property: { icon: 'key', color: '#7C3AED' },
  recommend: { icon: 'sparkles', color: '#CA8A04' },
  borrow: { icon: 'swap-horizontal', color: '#0891B2' },
  court: { icon: 'tennisball', color: '#16A34A' },
  order: { icon: 'fast-food', color: '#E8650A' },
  place: { icon: 'location', color: '#0D9488' },
  lost_found: { icon: 'search', color: '#D97706' },
  report: { icon: 'flag', color: '#EF4444' },
  event: { icon: 'sparkles', color: '#7C3AED' },
  // A watch firing is Saathi speaking, so it wears Saathi's green rather
  // than the colour of whatever kind of thing it happened to find.
  saathi_watch: { icon: 'notifications', color: '#0E6B4E' },
  food_daily: { icon: 'restaurant', color: '#E8650A' },
  feedback: { icon: 'chatbox-ellipses', color: '#6366F1' },
  pin_reset: { icon: 'key', color: '#B45309' },
  carpool: { icon: 'car', color: '#0EA5E9' },
  group_chat: { icon: 'chatbubbles', color: '#16A34A' },
  member: { icon: 'person-add', color: '#0F6E56' },
};

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { userId, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [visible, setVisible] = useState(false);
  const joinedAt = profile?.created_at ?? '1970-01-01';
  const clearedAt = profile?.notifications_cleared_at ?? null;
  // Show notifications newer than whichever is later: join time or last "Clear all".
  const floor = clearedAt && clearedAt > joinedAt ? clearedAt : joinedAt;

  const refresh = useCallback(() => {
    if (!userId || !isSupabaseConfigured) { setItems([]); return; }
    fetchNotifications(userId, floor).then(setItems).catch(() => {});
  }, [userId, floor]);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) { setItems([]); return; }
    refresh();
    const unsub = subscribeNotifications(userId, refresh);
    return unsub;
  }, [userId, refresh]);

  const unreadCount = useMemo(() => items.filter((i) => !i.read).length, [items]);

  const onItemPress = async (item: NotificationItem) => {
    if (!item.read && userId) {
      markRead(userId, [item.id]).catch(() => {});
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    }
    setVisible(false);
    if (item.route) router.push(item.route as any);
  };

  // Toggle a single notification read ↔ unread without navigating.
  const onToggleRead = (item: NotificationItem) => {
    if (!userId) return;
    const next = !item.read;
    (next ? markRead(userId, [item.id]) : markUnread(userId, [item.id])).catch(() => {});
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: next } : i)));
  };

  // Mark a set of rows — a day, a stack, or everything — read or unread.
  const onMarkItems = (list: NotificationItem[], read: boolean) => {
    if (!userId) return;
    const ids = list.filter((i) => i.read !== read).map((i) => i.id);
    if (!ids.length) return;
    const set = new Set(ids);
    (read ? markRead(userId, ids) : markUnread(userId, ids)).catch(() => {});
    setItems((prev) => prev.map((i) => (set.has(i.id) ? { ...i, read } : i)));
  };
  const onMarkAll = (read: boolean) => onMarkItems(items, read);

  const onClearAll = async () => {
    if (!userId) return;
    setItems([]); // optimistic
    try {
      await clearAllNotifications(userId);
      await refreshProfile(); // bumps notifications_cleared_at so future fetches stay clear
    } catch { refresh(); }
  };

  return (
    <Ctx.Provider value={{ unreadCount, open: () => setVisible(true) }}>
      {children}
      <NotificationsModal
        visible={visible}
        items={items}
        unreadCount={unreadCount}
        onClose={() => setVisible(false)}
        onItemPress={onItemPress}
        onToggleRead={onToggleRead}
        onMarkAll={onMarkAll}
        onMarkItems={onMarkItems}
        onClearAll={onClearAll}
      />
    </Ctx.Provider>
  );
}

function NotificationsModal({
  visible, items, unreadCount, onClose, onItemPress, onToggleRead, onMarkAll, onMarkItems, onClearAll,
}: {
  visible: boolean;
  items: NotificationItem[];
  unreadCount: number;
  onClose: () => void;
  onItemPress: (i: NotificationItem) => void;
  onToggleRead: (i: NotificationItem) => void;
  onMarkAll: (read: boolean) => void;
  onMarkItems: (list: NotificationItem[], read: boolean) => void;
  onClearAll: () => void;
}) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  // Stacks the reader has opened, by key; reset when the panel closes.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => { if (!visible) setExpanded(new Set()); }, [visible]);
  const sections = useMemo(() => groupNotifications(items, expanded), [items, expanded]);

  const panelStyle = isDesktop
    ? { position: 'absolute' as const, top: insets.top + 12, right: 16, width: 400, maxHeight: '80%' as const }
    : { position: 'absolute' as const, top: insets.top, left: 0, right: 0, maxHeight: '85%' as const };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* The scrim closes the panel but is not a button: everything inside it is, and a button may not hold buttons. */}
      <Pressable accessibilityLabel="Close notifications" style={{ flex: 1, backgroundColor: c.scrim }} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[
            {
              backgroundColor: c.surface,
              borderRadius: isDesktop ? 18 : 0,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              borderWidth: isDesktop ? 1 : 0,
              borderColor: c.line,
              overflow: 'hidden',
              shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 16,
            },
            panelStyle,
          ]}
        >
          {/* Header */}
          <View className="border-b border-line px-4" style={{ paddingTop: isDesktop ? 14 : insets.top + 6, paddingBottom: 10 }}>
            <View className="flex-row items-center gap-2">
              <Ionicons name="notifications-outline" size={20} color={c.ink} />
              <Text className="flex-1 font-display-x text-[18px] text-ink">Notifications</Text>
              <Pressable onPress={onClose} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-full active:bg-inset">
                <Ionicons name="close" size={20} color={c.muted} />
              </Pressable>
            </View>
            {items.length > 0 ? (
              <View className="mt-2 flex-row items-center gap-2">
                {unreadCount > 0 ? (
                  <Pressable onPress={() => onMarkAll(true)} hitSlop={4} className="rounded-full bg-inset px-2.5 py-1 active:opacity-70">
                    <Text className="text-[12px] font-sans-sb text-accent">Mark all read</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => onMarkAll(false)} hitSlop={4} className="rounded-full bg-inset px-2.5 py-1 active:opacity-70">
                    <Text className="text-[12px] font-sans-sb text-muted">Mark all unread</Text>
                  </Pressable>
                )}
                <Pressable onPress={onClearAll} hitSlop={4} className="flex-row items-center gap-1 rounded-full bg-inset px-2.5 py-1 active:opacity-70">
                  <Ionicons name="trash-outline" size={12} color={c.danger} />
                  <Text className="text-[12px] font-sans-sb" style={{ color: c.danger }}>Clear all</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {items.length === 0 ? (
            <View className="items-center px-6 py-16">
              <Ionicons name="notifications-off-outline" size={34} color={c.faint} />
              <Text className="font-sans mt-2 text-[14px] text-muted">You're all caught up</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 8 }} showsVerticalScrollIndicator={false}>
              {sections.map((section) => (
                <View key={section.key}>
                  {/* A day at a time, with its own "mark read" — the shape
                      every phone's notification shade has settled on. */}
                  <View className="flex-row items-center justify-between bg-inset px-4 py-1.5">
                    <Text className="text-[11px] font-sans-sb uppercase tracking-wider text-muted">{section.label}</Text>
                    {section.unread > 0 ? (
                      <Pressable onPress={() => onMarkItems(section.items, true)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Mark ${section.label} read`}>
                        <Text className="text-[11px] font-sans-sb text-accent">{section.unread} new · mark read</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {section.rows.map((row) => row.kind === 'one' ? (
                    <NotificationRow key={row.item.id} item={row.item} c={c} onPress={() => onItemPress(row.item)} onToggleRead={() => onToggleRead(row.item)} />
                  ) : (
                    /* Three or more of a kind in one day fold into one row —
                       "6 new posts" — rather than six rows of the same icon. */
                    <Pressable
                      key={row.key}
                      onPress={() => setExpanded((prev) => new Set(prev).add(row.key))}
                      className="flex-row items-start gap-3 border-b border-line px-4 py-3 active:bg-inset"
                      style={{ backgroundColor: row.unread ? c.accent + '08' : undefined }}
                      accessibilityRole="button"
                      accessibilityLabel={`${row.items.length} ${row.label}, show all`}
                    >
                      <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: c.accentSoft }}>
                        <Ionicons name={row.icon} size={17} color={c.accent} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-sans-sb text-[14px] text-ink" numberOfLines={1}>{row.items.length} {row.label}</Text>
                        <Text className="font-sans text-[13px] text-muted" numberOfLines={1}>{row.items[0].title}</Text>
                        <Text className="font-sans mt-0.5 text-[11px] text-faint">{timeAgo(row.items[0].created_at)} · tap to see all</Text>
                      </View>
                      <Ionicons name="chevron-down" size={16} color={c.faint} style={{ marginTop: 8 }} />
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NotificationRow({ item, c, onPress, onToggleRead }: {
  item: NotificationItem; c: ReturnType<typeof useThemeColors>; onPress: () => void; onToggleRead: () => void;
}) {
  const meta = TYPE_META[item.type] ?? TYPE_META.post;
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-start gap-3 border-b border-line px-4 py-3 active:bg-inset"
      style={{ backgroundColor: item.read ? undefined : c.accent + '08' }}
      accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}`}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: c.accentSoft }}>
        <Ionicons name={meta.icon} size={17} color={c.accent} />
      </View>
      <View className="flex-1">
        <Text className="font-sans-sb text-[14px] text-ink" numberOfLines={1}>{item.title}</Text>
        {item.body ? <Text className="font-sans text-[13px] text-muted" numberOfLines={2}>{item.body}</Text> : null}
        <Text className="font-sans mt-0.5 text-[11px] text-faint">{timeAgo(item.created_at)}</Text>
      </View>
      {/* Per-row read/unread toggle (doesn't navigate) */}
      <Pressable
        onPress={onToggleRead}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={item.read ? 'Mark as unread' : 'Mark as read'}
        className="ml-1 h-7 w-7 items-center justify-center rounded-full active:bg-inset"
      >
        {item.read
          ? <Ionicons name="ellipse-outline" size={14} color={c.faint} />
          : <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent }} />}
      </Pressable>
    </Pressable>
  );
}

// What a stack of one kind is called: "4 new posts", "3 orders".
const TYPE_PLURAL: Partial<Record<NotificationType, string>> = {
  announcement: 'announcements', post: 'new posts', listing: 'listing updates', poll: 'polls', message: 'messages',
  dish: 'dishes', tiffin: 'tiffin updates', sport: 'sports updates', document: 'documents', payment: 'payments',
  property: 'flat listings', recommend: 'recommendations', borrow: 'borrow updates', court: 'court bookings',
  order: 'orders', place: 'places', lost_found: 'lost & found notices', report: 'reports', event: 'event updates',
  saathi_watch: 'Saathi alerts', food_daily: 'food digests', feedback: 'feedback updates', pin_reset: 'PIN resets',
  carpool: 'carpool updates', group_chat: 'group messages', member: 'new neighbours',
};

type Row =
  | { kind: 'one'; item: NotificationItem }
  | { kind: 'stack'; key: string; label: string; icon: keyof typeof Ionicons.glyphMap; items: NotificationItem[]; unread: boolean };
type Section = { key: string; label: string; items: NotificationItem[]; unread: number; rows: Row[] };

function dayOf(iso: string): { key: string; label: string } {
  const d = new Date(iso);
  const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(now) - start(d)) / 86400000);
  if (days <= 0) return { key: 'today', label: 'Today' };
  if (days === 1) return { key: 'yesterday', label: 'Yesterday' };
  if (days < 7) return { key: 'd' + days, label: d.toLocaleDateString('en-IN', { weekday: 'long' }) };
  return { key: 'earlier', label: 'Earlier' };
}

/**
 * Newest-first rows, cut into days; within a day, a run of three or more of
 * one kind folds into a stack until the reader opens it.
 */
function groupNotifications(items: NotificationItem[], expanded: Set<string>): Section[] {
  const sections: Section[] = [];
  for (const item of items) {
    const d = dayOf(item.created_at);
    let s = sections[sections.length - 1];
    if (!s || s.key !== d.key) { s = { key: d.key, label: d.label, items: [], unread: 0, rows: [] }; sections.push(s); }
    s.items.push(item);
    if (!item.read) s.unread++;
  }
  for (const s of sections) {
    let i = 0;
    while (i < s.items.length) {
      let j = i;
      while (j < s.items.length && s.items[j].type === s.items[i].type) j++;
      const run = s.items.slice(i, j);
      const key = s.key + ':' + run[0].type + ':' + run[0].id;
      if (run.length >= 3 && !expanded.has(key)) {
        s.rows.push({ kind: 'stack', key, label: TYPE_PLURAL[run[0].type] ?? 'updates', icon: (TYPE_META[run[0].type] ?? TYPE_META.post).icon, items: run, unread: run.some((r) => !r.read) });
      } else {
        for (const it of run) s.rows.push({ kind: 'one', item: it });
      }
      i = j;
    }
  }
  return sections;
}

function timeAgo(iso: string): string {
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
