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

  const onMarkAll = async (read: boolean) => {
    if (!userId) return;
    const ids = items.filter((i) => i.read !== read).map((i) => i.id);
    if (!ids.length) return;
    (read ? markRead(userId, ids) : markUnread(userId, ids)).catch(() => {});
    setItems((prev) => prev.map((i) => ({ ...i, read })));
  };

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
        onClearAll={onClearAll}
      />
    </Ctx.Provider>
  );
}

function NotificationsModal({
  visible, items, unreadCount, onClose, onItemPress, onToggleRead, onMarkAll, onClearAll,
}: {
  visible: boolean;
  items: NotificationItem[];
  unreadCount: number;
  onClose: () => void;
  onItemPress: (i: NotificationItem) => void;
  onToggleRead: (i: NotificationItem) => void;
  onMarkAll: (read: boolean) => void;
  onClearAll: () => void;
}) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();

  const panelStyle = isDesktop
    ? { position: 'absolute' as const, top: insets.top + 12, right: 16, width: 400, maxHeight: '80%' as const }
    : { position: 'absolute' as const, top: insets.top, left: 0, right: 0, maxHeight: '85%' as const };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#00000055' }} onPress={onClose}>
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
                  <Ionicons name="trash-outline" size={12} color="#EF4444" />
                  <Text className="text-[12px] font-sans-sb text-[#EF4444]">Clear all</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {items.length === 0 ? (
            <View className="items-center px-6 py-16">
              <Ionicons name="notifications-off-outline" size={34} color={c.faint} />
              <Text className="mt-2 text-[14px] text-muted">You're all caught up</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 8 }} showsVerticalScrollIndicator={false}>
              {items.map((item) => {
                const meta = TYPE_META[item.type] ?? TYPE_META.post;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => onItemPress(item)}
                    className="flex-row items-start gap-3 border-b border-line px-4 py-3 active:bg-inset"
                    style={{ backgroundColor: item.read ? undefined : c.accent + '08' }}
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: meta.color + '20' }}>
                      <Ionicons name={meta.icon} size={17} color={meta.color} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-sans-sb text-[14px] text-ink" numberOfLines={1}>{item.title}</Text>
                      {item.body ? <Text className="text-[13px] text-muted" numberOfLines={2}>{item.body}</Text> : null}
                      <Text className="mt-0.5 text-[11px] text-faint">{timeAgo(item.created_at)}</Text>
                    </View>
                    {/* Per-row read/unread toggle (doesn't navigate) */}
                    <Pressable
                      onPress={() => onToggleRead(item)}
                      hitSlop={8}
                      accessibilityLabel={item.read ? 'Mark as unread' : 'Mark as read'}
                      className="ml-1 h-7 w-7 items-center justify-center rounded-full active:bg-inset"
                    >
                      {item.read
                        ? <Ionicons name="ellipse-outline" size={14} color={c.faint} />
                        : <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent }} />}
                    </Pressable>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
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
