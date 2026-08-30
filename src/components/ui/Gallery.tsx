import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, View } from 'react-native';

import { IMAGE_CACHE_PROPS } from '../../lib/image';
import { useThemeColors } from '../../theme';

/**
 * A paged photo gallery.
 *
 * WHY THIS EXISTS
 * Property and Places each rolled their own strip and neither told you there
 * was more to see. Property paged full-width photos with no indicator at all,
 * so a second photo was discoverable only by guessing you could swipe. Places
 * used fixed 260px cards that cut off mid-photo — which at least hints at more
 * content, but by accident rather than design, and it looked like a mistake.
 *
 * This pages properly, counts the photos, and marks position with dots. A
 * single photo gets neither — one dot and "1/1" are noise.
 *
 * It measures its own width rather than taking one, so it works inside both a
 * narrow Container and a full-bleed screen without either caller doing the
 * arithmetic.
 */
export function Gallery({
  photos,
  ratio = 0.62,
  fallbackIcon = 'image-outline',
}: {
  photos: string[];
  /** Height as a fraction of width. 0.62 is close to the 16:10 photos take. */
  ratio?: number;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
}) {
  const c = useThemeColors();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const height = width > 0 ? Math.round(width * ratio) : 200;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const shell = {
    overflow: 'hidden' as const,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  };

  if (!photos?.length) {
    return (
      <View
        onLayout={onLayout}
        style={{ ...shell, height, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name={fallbackIcon} size={34} color={c.subtle} />
      </View>
    );
  }

  return (
    <View onLayout={onLayout} style={{ ...shell, height }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
      >
        {photos.map((url, i) => (
          <Image
            key={url + i}
            source={{ uri: url }}
            style={{ width: width || undefined, height }}
            contentFit="cover"
            recyclingKey={url}
            accessibilityLabel={`Photo ${i + 1} of ${photos.length}`}
            {...IMAGE_CACHE_PROPS}
          />
        ))}
      </ScrollView>

      {photos.length > 1 ? (
        <>
          {/* Count, for when you want to know how many there are without
              swiping to the end. */}
          <View
            style={{
              position: 'absolute', top: 12, right: 12,
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
              backgroundColor: 'rgba(10,14,11,0.62)',
            }}
          >
            <Text className="font-sans-sb text-[11px] text-white">
              {index + 1}/{photos.length}
            </Text>
          </View>

          {/* Position. Dots rather than a bar: at three or four photos a bar
              reads as a progress meter for something loading. */}
          <View
            style={{
              position: 'absolute', bottom: 12, left: 0, right: 0,
              flexDirection: 'row', justifyContent: 'center', gap: 6,
            }}
            pointerEvents="none"
          >
            {photos.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === index ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === index ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
                }}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
