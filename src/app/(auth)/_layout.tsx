import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../context/auth';
import { useThemeColors } from '../../theme';

export default function AuthLayout() {
  const { ready, session } = useAuth();
  const c = useThemeColors();

  // A bare View here is indistinguishable from a crash. If the session
  // check is slow, the app should look busy, not broken.
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }
  if (session) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
