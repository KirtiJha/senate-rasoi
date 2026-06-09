import { Text, View } from 'react-native';
import { BrandMark } from './BrandMark';

/** Inline wordmark: the Aangan courtyard mark + name. */
export function Wordmark({ size = 20, markOnly = false }: { size?: number; markOnly?: boolean }) {
  const box = size * 1.5;
  return (
    <View className="flex-row items-center gap-2">
      <BrandMark size={box} id="wm-mark" />
      {markOnly ? null : (
        <Text style={{ fontSize: size }} className="font-display text-ink">
          Aangan
        </Text>
      )}
    </View>
  );
}

/** Large centered lockup for the auth / splash screens. */
export function Brandfull() {
  return (
    <View className="items-center">
      <BrandMark size={72} id="bf-mark" />
      <Text style={{ fontSize: 30 }} className="mt-3 font-display-x text-ink">
        Aangan
      </Text>
    </View>
  );
}
