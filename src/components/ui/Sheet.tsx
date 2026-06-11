import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../theme';
import { useResponsive } from './Container';

/**
 * A responsive modal: a centered dialog on desktop (so it never covers the
 * NavRail) and a bottom page-sheet on mobile. Children render inside a
 * scrollable body; pass `footer` for a pinned action area.
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

  const header = (
    <View className="flex-row items-center justify-between border-b border-line px-4 py-3.5">
      <Text className="font-sans-sb text-[16px] text-ink">{title}</Text>
      <Pressable onPress={onClose} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-full active:bg-inset">
        <Ionicons name="close" size={22} color={c.muted} />
      </Pressable>
    </View>
  );

  if (isDesktop) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable className="flex-1 items-center justify-center" style={{ backgroundColor: '#00000055', padding: 24 }} onPress={onClose}>
          <Pressable
            onPress={() => {}}
            style={{ width: '100%', maxWidth, maxHeight: '86%', borderRadius: 22, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }}
          >
            {header}
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
            {footer ? <View className="border-t border-line px-5 py-3">{footer}</View> : null}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-bg">
        {header}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        {footer ? <View className="border-t border-line px-4 pt-3" style={{ paddingBottom: insets.bottom + 8 }}>{footer}</View> : null}
      </View>
    </Modal>
  );
}
