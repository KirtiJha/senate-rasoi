import { Ionicons } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/auth';
import { useThemePreference } from '../context/theme';
import { useThemeColors } from '../theme';
import { Wordmark } from './Brand';

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
  { href: '/you', label: 'You', icon: 'person-outline', activeIcon: 'person' },
];

const COMMUNITY_ITEMS: NavItem[] = [
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
}: {
  item: NavItem;
  path: string;
  colors: ReturnType<typeof useThemeColors>;
  av: AnimVals;
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
          <Ionicons
            name={active ? item.activeIcon : item.icon}
            size={21}
            color={iconColor}
          />
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
  const { isAdmin } = useAuth();
  const { resolved, toggle: toggleTheme } = useThemePreference();
  const isDark = resolved === 'dark';

  const [collapsed, setCollapsed] = useState(false);
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
  // Shifts icon right so it stays visually centered in the 64px collapsed rail
  // collapsed: paddingLeft=12 + marginLeft=9 => icon starts at 21px ≈ (64-21)/2
  const iconMarginL = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 9],
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
            <Wordmark size={20} />
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
            <NavItemRow key={item.href} item={item} path={path} colors={colors} av={av} />
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

        {/* ── About ── */}
        <View style={{ paddingHorizontal: 10 }}>
          <NavItemRow
            item={{
              href: '/about',
              label: 'About',
              icon: 'information-circle-outline',
              activeIcon: 'information-circle',
            }}
            path={path}
            colors={colors}
            av={av}
          />
        </View>

        {/* ── Theme toggle ── */}
        <Pressable
          onPress={toggleTheme}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: 10,
            borderRadius: 14,
            marginBottom: 4,
          }}
          accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Animated.View style={{ marginLeft: iconMarginL, paddingVertical: 10, paddingLeft: 12 }}>
            <Ionicons
              name={isDark ? 'sunny-outline' : 'moon-outline'}
              size={19}
              color={colors.faint}
            />
          </Animated.View>
          <Animated.View
            style={{
              overflow: 'hidden',
              maxWidth: labelMaxW,
              opacity: labelOpacity,
              marginLeft: 10,
              paddingRight: 12,
            }}
          >
            <Text
              style={{
                fontFamily: 'HankenGrotesk_500Medium',
                fontSize: 13,
                color: colors.faint,
              }}
            >
              {isDark ? 'Light mode' : 'Dark mode'}
            </Text>
          </Animated.View>
        </Pressable>

        {/* ── Tagline ── */}
        <Animated.View style={{ opacity: sectionOpacity, paddingHorizontal: 22 }}>
          <Text style={{ fontSize: 11, color: colors.faint }}>Aangan · community hub</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
