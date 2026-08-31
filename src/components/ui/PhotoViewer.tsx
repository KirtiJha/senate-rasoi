import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Tap a photo, see the photo.
 *
 * Thumbnails throughout the app were dead ends: a receipt, a screenshot
 * attached to a bug report, a poster on a celebration note — all rendered at
 * 78 or 140 points, which is large enough to know a picture is there and far
 * too small to read anything in it. The whole reason to attach a bill is that
 * somebody can check the figure on it.
 *
 * Full-screen over a near-opaque ground rather than a lightbox card: on a
 * phone the picture wants every pixel, and a photo floating on a dimmed
 * version of the screen behind it wastes a third of them on furniture.
 *
 * Swipes between photos when given several, because a set of them is how they
 * arrive — three angles of the same damaged pipe, two pages of one bill.
 */
export function PhotoViewer({
  photos,
  index = 0,
  onClose,
}: {
  /** Empty or null closes it; the viewer is driven entirely by this prop. */
  photos: string[] | null;
  index?: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');
  const [current, setCurrent] = useState(index);

  useEffect(() => { setCurrent(index); }, [index, photos]);

  const open = !!photos && photos.length > 0;
  if (!open) return null;

  const list = photos as string[];

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCurrent(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: index * width, y: 0 }}
          onMomentumScrollEnd={onScrollEnd}
        >
          {list.map((uri) => (
            <View key={uri} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <Image
                source={{ uri }}
                style={{ width, height: height * 0.8 }}
                contentFit="contain"
                transition={120}
              />
            </View>
          ))}
        </ScrollView>

        {/* Close sits clear of the notch, and is generous: a viewer you cannot
            get out of is worse than one you cannot get into. */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          style={{
            position: 'absolute',
            top: insets.top + 8,
            right: 14,
            height: 40,
            width: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.14)',
          }}
        >
          <Ionicons name="close" size={21} color="#fff" />
        </Pressable>

        {list.length > 1 ? (
          <View style={{ position: 'absolute', bottom: insets.bottom + 20, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' }}>
              <Text style={{ color: '#fff', fontSize: 12.5 }}>
                {current + 1} of {list.length}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
