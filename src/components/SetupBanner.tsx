import { Ionicons } from '@expo/vector-icons';
import { Linking, Text, View } from 'react-native';
import { useThemeColors } from '../theme';

// Shown when Supabase env vars aren't wired in yet.
export function SetupBanner() {
  const c = useThemeColors();
  return (
    <View className="mb-4 flex-row gap-3 rounded-3xl border border-accent-soft bg-accent-soft p-4">
      <Ionicons name="construct-outline" size={20} color={c.accent} style={{ marginTop: 1 }} />
      <View className="flex-1">
        <Text className="mb-1 font-sans-sb text-[14px] text-ink">Almost there — connect your backend</Text>
        <Text className="text-[13px] leading-5 text-muted">
          Run the SQL in <Text className="font-sans-sb text-ink">supabase/migrations</Text>, then copy{' '}
          <Text className="font-sans-sb text-ink">.env.example</Text> → <Text className="font-sans-sb text-ink">.env</Text>{' '}
          with your project URL + anon key.
        </Text>
        <Text className="mt-2 font-sans-sb text-[13px] text-accent" onPress={() => Linking.openURL('https://supabase.com/dashboard')}>
          Open Supabase dashboard →
        </Text>
      </View>
    </View>
  );
}
