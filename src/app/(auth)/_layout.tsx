import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '../../context/auth';
import { useThemeColors } from '../../theme';

export default function AuthLayout() {
  const { ready, session } = useAuth();
  const c = useThemeColors();

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  if (session) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
