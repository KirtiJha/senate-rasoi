import { useState } from 'react';
import { Pressable, Text, TextProps, View } from 'react-native';

import { useTranslated } from '../context/translations';

interface TProps extends TextProps {
  source: string;
  id: string;
  field: string;
  text: string | null | undefined;
  /** Show the "see original" toggle under the text (default true). */
  showToggle?: boolean;
}

/**
 * Auto-translating Text. Renders `text` in the reader's preferred language when
 * one is set and differs; otherwise renders the original unchanged. Keeps the
 * original one tap away. Drop-in for a <Text> that lives inside a <View>.
 */
export function T({ source, id, field, text, showToggle = true, ...textProps }: TProps) {
  const { display, translated } = useTranslated({ source, id, field, text });
  const [showOriginal, setShowOriginal] = useState(false);
  const shown = showOriginal ? (text ?? '') : display;

  if (!translated) return <Text {...textProps}>{shown}</Text>;

  return (
    <View>
      <Text {...textProps}>{shown}</Text>
      {showToggle ? (
        <Pressable onPress={() => setShowOriginal((o) => !o)} hitSlop={6} className="mt-0.5 flex-row items-center gap-1 self-start">
          <Text className="text-[11px] font-sans-md text-faint">
            {showOriginal ? 'Show translation' : 'Translated · see original'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
