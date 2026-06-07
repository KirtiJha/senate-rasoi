import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import { gradients, useThemeColors } from '../theme';

// A steaming pot — warm, home-cooked, and veg-neutral (no meat/egg imagery).
export function Wordmark({ size = 20, markOnly = false }: { size?: number; markOnly?: boolean }) {
  const c = useThemeColors();
  const box = size * 1.5;
  return (
    <View className="flex-row items-center gap-2">
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: box, height: box, borderRadius: box * 0.32, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="home" size={size * 0.82} color={c.onAccent} />
      </LinearGradient>
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
  const c = useThemeColors();
  return (
    <View className="items-center">
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="home" size={38} color={c.onAccent} />
      </LinearGradient>
      <Text style={{ fontSize: 30 }} className="mt-3 font-display-x text-ink">
        Aangan
      </Text>
    </View>
  );
}
