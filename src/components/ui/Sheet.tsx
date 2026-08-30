import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn, FadeOut, SlideInDown, SlideOutDown,
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '../../lib/haptics';
import { dur, ease, spring } from '../../lib/motion';
import { useThemeColors } from '../../theme';
import { useResponsive } from './Container';

/** Drag distance that commits to a close. */
const DISMISS_PX = 110;
/** …or a flick this fast, regardless of distance. */
const DISMISS_VELOCITY = 900;

/**
 * A responsive modal: a centred dialog on desktop (so it never covers the
 * NavRail) and a real bottom sheet on mobile.
 *
 * The mobile branch used `presentationStyle="pageSheet"`, which Android
 * ignores — so what shipped there was a full-screen takeover that slid up from
 * nowhere, with no way out but the close button. It is now a genuine sheet:
 * scrim behind, rounded top, and drag-to-dismiss.
 *
 * This is also the only place `react-native-gesture-handler` earns its keep —
 * it has been a dependency since the first commit, doing nothing but wrapping
 * the app in a GestureHandlerRootView.
 */
export function Sheet({
  visible, onClose, title, children, footer, maxWidth = 480,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
}) {
  const { isDesktop } = useResponsive();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);

  const header = (
    <View className="flex-row items-center justify-between px-4 pb-3.5 pt-1">
      <Text className="font-display text-[19px] text-ink">{title}</Text>
      <Pressable
        onPress={onClose}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Close"
        className="h-9 w-9 items-center justify-center rounded-full active:bg-inset"
      >
        <Ionicons name="close" size={20} color={c.muted} />
      </Pressable>
    </View>
  );

  // Above the isDesktop branch: hooks must not be skipped on one path.
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));

  if (isDesktop) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(16,21,18,0.55)', padding: 24 }} onPress={onClose}>
          <Pressable
            onPress={() => {}}
            style={{ width: '100%', maxWidth, maxHeight: '86%', borderRadius: 28, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, overflow: 'hidden', paddingTop: 8 }}
          >
            <JaaliRule c={c} />
            {header}
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
            {footer ? <View className="border-t border-line px-5 py-3">{footer}</View> : null}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  const close = () => {
    haptics.tap();
    translateY.set(0);
    onClose();
  };

  const pan = Gesture.Pan()
    .onChange((e) => {
      // Rubber-band upward drags to a quarter so the sheet feels anchored at
      // the top rather than loose in both directions.
      const next = translateY.get() + e.changeY;
      translateY.set(next < 0 ? next * 0.25 : next);
    })
    .onEnd((e) => {
      if (translateY.get() > DISMISS_PX || e.velocityY > DISMISS_VELOCITY) {
        translateY.set(withTiming(700, { duration: dur.standard, easing: ease.exit }));
        runOnJS(close)();
      } else {
        translateY.set(withSpring(0, spring.sheet));
      }
    });

  return (
    // animationType="none": Reanimated owns the motion now, not the Modal.
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(dur.quick)}
        exiting={FadeOut.duration(dur.quick)}
        style={{ flex: 1, backgroundColor: 'rgba(16,21,18,0.55)', justifyContent: 'flex-end' }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />

        <GestureDetector gesture={pan}>
          <Animated.View
            entering={SlideInDown.duration(dur.expressive).easing(ease.emphasized)}
            exiting={SlideOutDown.duration(dur.standard).easing(ease.exit)}
            style={[
              panel,
              {
                maxHeight: '90%',
                backgroundColor: c.bg,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                borderTopWidth: 1,
                borderColor: c.line,
              },
            ]}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              {/* The jaali rule stands in for a grab handle: the app's
                  signature appears at the exact moment of interaction, and it
                  is also the affordance that says this sheet can be dragged. */}
              <JaaliRule c={c} />
              {header}
              <ScrollView
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
              {footer ? (
                <View className="border-t border-line px-4 pt-3" style={{ paddingBottom: insets.bottom + 8 }}>
                  {footer}
                </View>
              ) : null}
            </KeyboardAvoidingView>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </Modal>
  );
}

/** A perforated rule, borrowed from a jaali screen wall. */
function JaaliRule({ c }: { c: ReturnType<typeof useThemeColors> }) {
  return (
    <View className="flex-row items-center justify-center gap-1.5 py-2.5">
      {Array.from({ length: 7 }).map((_, i) => (
        <View key={i} style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: c.lineStrong }} />
      ))}
    </View>
  );
}
