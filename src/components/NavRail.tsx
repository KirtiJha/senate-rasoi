import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter, usePathname } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/auth';
import { useNotifications } from '../context/notifications';
import { useThemePreference } from '../context/theme';
import { useUnreadDms } from '../context/unread';
import { useThemeColors } from '../theme';
import { Wordmark } from './Brand';
import { Avatar } from './ui';

const NAV_EXPANDED = 220;
const NAV_COLLAPSED = 64;

type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  color?: string;
};

const PRIMARY_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { href: '/feed', label: 'Feed', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
  { href: '/search', label: 'Search', icon: 'search-outline', activeIcon: 'search' },
  { href: '/listings', label: 'Listings', icon: 'pricetags-outline', activeIcon: 'pricetags' },
  { href: '/messages', label: 'Messages', icon: 'mail-outline', activeIcon: 'mail' },
  { href: '/you', label: 'You', icon: 'person-outline', activeIcon: 'person' },
];

const COMMUNITY_ITEMS: NavItem[] = [
  { href: '/directory', label: 'Residents', icon: 'people-outline', activeIcon: 'people' },
  { href: '/sports', label: 'Sports', icon: 'football-outline', activeIcon: 'football', color: '#16A34A' },
  { href: '/polls', label: 'Polls', icon: 'stats-chart-outline', activeIcon: 'stats-chart' },
  { href: '/emergency', label: 'Emergency', icon: 'call-outline', activeIcon: 'call', color: '#EF4444' },
];

const ADMIN_ITEM: NavItem = {
  href: '/admin',
  label: 'Admin',
  icon: 'shield-checkmark-outline',
  activeIcon: 'shield-checkmark',
};

type AnimVals = {
  labelOpacity: Animated.AnimatedInterpolation<number>;
  labelMaxW: Animated.AnimatedInterpolation<number>;
  iconMarginL: Animated.AnimatedInterpolation<number>;
};

function NavItemRow({
  item,
  path,
  colors,
  av,
  badge = 0,
}: {
  item: NavItem;
  path: string;
  colors: ReturnType<typeof useThemeColors>;
  av: AnimVals;
  badge?: number;
}) {
  const active = item.href === '/' ? path === '/' : path.startsWith(item.href);
  const iconColor = item.color
    ? active ? item.color : colors.muted
    : active ? colors.accent : colors.muted;

  return (
    <Link href={item.href as any} asChild>
      <Pressable
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 14,
          backgroundColor: active ? colors.inset : 'transparent',
          marginBottom: 2,
          overflow: 'hidden',
        }}
        accessibilityLabel={item.label}
      >
        {/* Left accent bar */}
        {active ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 9,
              bottom: 9,
              width: 3,
              borderRadius: 2,
              backgroundColor: item.color ?? colors.accent,
            }}
          />
        ) : null}
        {/* Icon — animated margin keeps it centered when collapsed */}
        <Animated.View
          style={{ marginLeft: av.iconMarginL, paddingVertical: 10, paddingLeft: 12 }}
        >
          <View>
            <Ionicons
              name={active ? item.activeIcon : item.icon}
              size={21}
              color={iconColor}
            />
            {badge > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: -5,
                  right: -9,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  paddingHorizontal: 3,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 9, fontFamily: 'HankenGrotesk_700Bold' }}>
                  {badge > 9 ? '9+' : badge}
                </Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
        {/* Label fades out as rail collapses */}
        <Animated.View
          style={{
            overflow: 'hidden',
            maxWidth: av.labelMaxW,
            opacity: av.labelOpacity,
            marginLeft: 10,
            paddingRight: 12,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontFamily: active ? 'HankenGrotesk_700Bold' : 'HankenGrotesk_500Medium',
              fontSize: 15,
              color: active ? colors.ink : colors.muted,
            }}
          >
            {item.label}
          </Text>
        </Animated.View>
      </Pressable>
    </Link>
  );
}

function SectionLabel({
  label,
  opacity,
}: {
  label: string;
  opacity: Animated.AnimatedInterpolation<number>;
}) {
  return (
    <Animated.View style={{ opacity, paddingLeft: 22, marginBottom: 4, marginTop: 12 }}>
      <Text
        style={{
          fontSize: 10,
          fontFamily: 'HankenGrotesk_600SemiBold',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: '#9CA3AF',
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

export function NavRail() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const router = useRouter();
  const { isAdmin, profile, signOut } = useAuth();
  const { resolved, toggle: toggleTheme } = useThemePreference();
  const isDark = resolved === 'dark';
  const unread = useUnreadDms();
  const { unreadCount: notifCount, open: openNotifs } = useNotifications();

  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current; // 0 = expanded, 1 = collapsed

  const handleToggle = () => {
    const toValue = collapsed ? 0 : 1;
    Animated.spring(anim, {
      toValue,
      useNativeDriver: false,
      tension: 280,
      friction: 28,
    }).start();
    setCollapsed((v) => !v);
  };

  // Derived animated values
  const railWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [NAV_EXPANDED, NAV_COLLAPSED],
  });
  const labelOpacity = anim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [1, 0, 0],
  });
  const labelMaxW = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [140, 0],
  });
  // Icons sit at container paddingHorizontal(10) + paddingLeft(12) = 22px from the
  // rail edge, which already centers a ~21px icon in the 64px collapsed rail
  // ((64-21)/2 ≈ 21.5). So no extra shift is needed — an earlier +9 over-pushed
  // the bell / New Post / avatar to the right when collapsed.
  const iconMarginL = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0],
  });
  const sectionOpacity = anim.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [1, 0, 0],
  });
  const chevronRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const av: AnimVals = { labelOpacity, labelMaxW, iconMarginL };

  return (
    <Animated.View
      style={{
        width: railWidth,
        borderRightWidth: 1,
        borderRightColor: colors.line,
        backgroundColor: colors.bg,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'column',
          paddingTop: insets.top + 16,
          paddingBottom: 16,
        }}
      >
        {/* ── Header: wordmark + collapse toggle ── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            marginBottom: 16,
          }}
        >
          <Animated.View style={{ flex: 1, overflow: 'hidden', opacity: labelOpacity }}>
            <Link href="/" asChild>
              <Pressable accessibilityLabel="Go to Home" className="active:opacity-70">
                <Wordmark size={20} />
              </Pressable>
            </Link>
          </Animated.View>
          <Pressable
            onPress={handleToggle}
            style={{
              width: 28,
              height: 28,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
            }}
            accessibilityLabel={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
              <Ionicons name="chevron-back" size={16} color={colors.faint} />
            </Animated.View>
          </Pressable>
        </View>

        {/* ── Primary nav ── */}
        <View style={{ paddingHorizontal: 10 }}>
          {PRIMARY_ITEMS.map((item) => (
            <NavItemRow
              key={item.href}
              item={item}
              path={path}
              colors={colors}
              av={av}
              badge={item.href === '/messages' ? unread : 0}
            />
          ))}
        </View>

        {/* ── Community section ── */}
        <View style={{ paddingHorizontal: 10 }}>
          <SectionLabel label="Community" opacity={sectionOpacity} />
          {COMMUNITY_ITEMS.map((item) => (
            <NavItemRow key={item.href} item={item} path={path} colors={colors} av={av} />
          ))}
        </View>

        {/* ── Admin section ── */}
        {isAdmin ? (
          <View style={{ paddingHorizontal: 10 }}>
            <SectionLabel label="Admin" opacity={sectionOpacity} />
            <NavItemRow item={ADMIN_ITEM} path={path} colors={colors} av={av} />
          </View>
        ) : null}

        {/* ── Flex spacer ── */}
        <View style={{ flex: 1, minHeight: 16 }} />

        {/* ── Notifications (always accessible, above New Post) ── */}
        <View style={{ paddingHorizontal: 10, marginBottom: 2 }}>
          <Pressable
            onPress={openNotifs}
            style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingVertical: 10, overflow: 'hidden' }}
            accessibilityLabel="Notifications"
          >
            <Animated.View style={{ marginLeft: iconMarginL, paddingLeft: 12 }}>
              <View>
                <Ionicons name="notifications-outline" size={21} color={notifCount > 0 ? colors.accent : colors.muted} />
                {notifCount > 0 ? (
                  <View
                    style={{
                      position: 'absolute', top: -5, right: -8, minWidth: 16, height: 16, paddingHorizontal: 3,
                      borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 9, fontFamily: 'HankenGrotesk_700Bold' }}>
                      {notifCount > 9 ? '9+' : notifCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Animated.View>
            <Animated.View style={{ flex: 1, overflow: 'hidden', maxWidth: labelMaxW, opacity: labelOpacity, marginLeft: 10, paddingRight: 12 }}>
              <Text numberOfLines={1} style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: 15, color: colors.muted }}>
                Notifications
              </Text>
            </Animated.View>
          </Pressable>
        </View>

        {/* ── New Post CTA ── */}
        <View style={{ paddingHorizontal: 10, marginBottom: 6 }}>
          <Link href="/post" asChild>
            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 14,
                backgroundColor: colors.accent,
                paddingVertical: 11,
                overflow: 'hidden',
              }}
              accessibilityLabel="New Post"
            >
              <Animated.View style={{ marginLeft: iconMarginL, paddingLeft: 12 }}>
                <Ionicons name="add" size={20} color={colors.onAccent} />
              </Animated.View>
              <Animated.View
                style={{
                  overflow: 'hidden',
                  maxWidth: labelMaxW,
                  opacity: labelOpacity,
                  marginLeft: 8,
                  paddingRight: 12,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: 'HankenGrotesk_600SemiBold',
                    fontSize: 15,
                    color: colors.onAccent,
                  }}
                >
                  New Post
                </Text>
              </Animated.View>
            </Pressable>
          </Link>
        </View>

        {/* ── Account (avatar opens a menu: Profile · About · theme · sign out) ── */}
        <View style={{ paddingHorizontal: 10 }}>
          <Pressable
            onPress={() => setMenuOpen(true)}
            style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingVertical: 6, overflow: 'hidden' }}
            accessibilityLabel="Account menu"
          >
            <Animated.View style={{ marginLeft: iconMarginL, paddingLeft: 7 }}>
              <Avatar name={profile?.name ?? 'You'} size={32} />
            </Animated.View>
            <Animated.View style={{ flex: 1, overflow: 'hidden', maxWidth: labelMaxW, opacity: labelOpacity, marginLeft: 10 }}>
              <Text numberOfLines={1} style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink }}>
                {profile?.name ?? 'You'}
              </Text>
              {profile?.flat ? (
                <Text numberOfLines={1} style={{ fontSize: 11, color: colors.faint }}>Flat {profile.flat}</Text>
              ) : null}
            </Animated.View>
            <Animated.View style={{ opacity: labelOpacity, paddingRight: 12 }}>
              <Ionicons name="chevron-up" size={16} color={colors.faint} />
            </Animated.View>
          </Pressable>
        </View>
      </View>

      <AccountMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        profile={profile}
        colors={colors}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onSignOut={signOut}
        onNavigate={(href) => router.push(href as any)}
        insetsBottom={insets.bottom}
      />
    </Animated.View>
  );
}

function AccountMenu({
  visible, onClose, profile, colors, isDark, onToggleTheme, onSignOut, onNavigate, insetsBottom,
}: {
  visible: boolean;
  onClose: () => void;
  profile: { name: string; flat: string | null } | null;
  colors: ReturnType<typeof useThemeColors>;
  isDark: boolean;
  onToggleTheme: () => void;
  onSignOut: () => void;
  onNavigate: (href: string) => void;
  insetsBottom: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <View
          style={{
            position: 'absolute',
            left: 12,
            bottom: insetsBottom + 56,
            width: 232,
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.line,
            paddingVertical: 6,
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Avatar name={profile?.name ?? 'You'} size={36} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: colors.ink }}>
                {profile?.name ?? 'You'}
              </Text>
              {profile?.flat ? <Text style={{ fontSize: 11, color: colors.faint }}>Flat {profile.flat}</Text> : null}
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 4 }} />
          <AccountMenuRow icon="person-outline" label="Profile" colors={colors} onPress={() => { onClose(); onNavigate('/profile/me'); }} />
          <AccountMenuRow icon="information-circle-outline" label="About" colors={colors} onPress={() => { onClose(); onNavigate('/about'); }} />
          <AccountMenuRow icon={isDark ? 'sunny-outline' : 'moon-outline'} label={isDark ? 'Light mode' : 'Dark mode'} colors={colors} onPress={onToggleTheme} />
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 4 }} />
          <AccountMenuRow icon="log-out-outline" label="Sign out" colors={colors} danger onPress={() => { onClose(); onSignOut(); }} />
        </View>
      </Pressable>
    </Modal>
  );
}

function AccountMenuRow({
  icon, label, colors, onPress, danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  colors: ReturnType<typeof useThemeColors>;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} className="active:bg-inset" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 }}>
      <Ionicons name={icon} size={18} color={danger ? '#DC2626' : colors.muted} />
      <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: danger ? '#DC2626' : colors.ink }}>{label}</Text>
    </Pressable>
  );
}
