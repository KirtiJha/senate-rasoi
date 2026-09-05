import { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useThemeColors } from '../../theme';
import { useKeyboardInset } from './KeyboardAvoider';

/**
 * The one centred dialog.
 *
 * Five screens had each hand-built the same thing — a faded Modal, a
 * scrim, a 380-wide card with the same radius and padding — and they had
 * drifted: one scrim was `#0008`, another the theme's; one remembered the
 * keyboard, the rest did not. A dialog is for a short decision or a small
 * form that must be answered before the page continues; anything longer
 * belongs in a Sheet.
 *
 * The keyboard inset is read from the JS Keyboard API because a Modal on
 * Android is its own native window that the screen's KeyboardAvoider
 * cannot reach into.
 */
export function Dialog({
  visible,
  onClose,
  title,
  children,
  maxWidth = 380,
  dismissable = true,
}: {
  visible: boolean;
  onClose: () => void;
  /** Rendered as the heading; omit when the body carries its own. */
  title?: string;
  children: ReactNode;
  maxWidth?: number;
  /** Whether tapping the scrim closes it. Off for a decision that must be made. */
  dismissable?: boolean;
}) {
  const c = useThemeColors();
  const kb = useKeyboardInset();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: c.scrim, paddingBottom: kb }}
        onPress={dismissable ? onClose : undefined}
        accessibilityRole="none"
      >
        <Pressable
          onPress={() => {}}
          accessibilityViewIsModal
          style={{ width: '100%', maxWidth, borderRadius: 22, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, padding: 22 }}
        >
          {title ? <Text className="font-display-x text-[19px] text-ink" accessibilityRole="header">{title}</Text> : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** The dialog's action row: buttons right-aligned, in order of commitment. */
export function DialogActions({ children }: { children: ReactNode }) {
  return <View className="mt-5 flex-row justify-end gap-2.5">{children}</View>;
}
