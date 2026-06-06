import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Container } from '../components/ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { listProfiles, setUserRoles } from '../lib/admin';
import { DbProfile, Role, ROLES } from '../lib/types';
import { useThemeColors } from '../theme';

export default function AdminScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { ready, isAdmin, userId, refreshProfile } = useAuth();
  const [members, setMembers] = useState<DbProfile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMembers(await listProfiles());
    } catch (e) {
      console.error(e);
      toast.show('Could not load members');
    }
  }, [toast]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (ready && !isAdmin) return <Redirect href="/" />;

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggle = async (m: DbProfile, role: Role) => {
    const next = m.roles.includes(role) ? m.roles.filter((r) => r !== role) : [...m.roles, role];
    if (next.length === 0) {
      toast.show('A member needs at least one role');
      return;
    }
    setBusy(m.id);
    try {
      const ok = await setUserRoles(m.id, next);
      if (!ok) {
        toast.show('Not allowed');
        return;
      }
      setMembers((cur) => cur.map((x) => (x.id === m.id ? { ...x, roles: next } : x)));
      if (m.id === userId) await refreshProfile(); // your own roles changed
    } catch (e) {
      console.error(e);
      toast.show('Could not update roles');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
        <Container narrow>
          <View className="flex-row items-center gap-2">
            <Pressable onPress={() => router.back()} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
              <Ionicons name="chevron-back" size={22} color={c.ink} />
            </Pressable>
            <Text className="font-display-x text-[22px] text-ink">Members</Text>
          </View>
        </Container>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Container narrow>
          <Text className="mb-3 text-[13px] text-muted">Tap a role to grant or remove it.</Text>
          {members.map((m) => (
            <View key={m.id} className="mb-3 rounded-3xl border border-line bg-surface p-3.5">
              <View className="flex-row items-center gap-3">
                <Avatar name={m.name} size={40} />
                <View className="flex-1">
                  <Text className="font-sans-sb text-[15px] text-ink" numberOfLines={1}>
                    {m.name}
                    {m.id === userId ? <Text className="font-sans text-faint"> (you)</Text> : null}
                  </Text>
                  <Text className="text-[12px] text-muted">
                    {m.phone}
                    {m.flat ? ` · ${m.flat}` : ''}
                  </Text>
                </View>
              </View>
              <View className="mt-3 flex-row gap-2">
                {ROLES.map((role) => {
                  const on = m.roles.includes(role);
                  return (
                    <Pressable
                      key={role}
                      disabled={busy === m.id}
                      onPress={() => toggle(m, role)}
                      className={`flex-1 items-center rounded-xl border py-2 ${
                        on ? 'border-accent bg-accent-soft' : 'border-line bg-inset'
                      } ${busy === m.id ? 'opacity-50' : ''}`}
                    >
                      <Text className={`text-[12px] ${on ? 'font-sans-sb text-accent' : 'font-sans-md text-muted'}`}>
                        {role === 'foodie' ? 'Foodie' : role === 'chef' ? 'Chef' : 'Admin'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </Container>
      </ScrollView>
    </View>
  );
}
