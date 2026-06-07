import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Container } from '../components/ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { listProfiles, setUserRoles } from '../lib/admin';
import { DbProfile, Role, ROLES } from '../lib/types';
import { useThemeColors } from '../theme';

const ROLE_LABEL: Record<Role, string> = { foodie: 'Foodie', chef: 'Chef', admin: 'Admin' };
const ROLE_ICON: Record<Role, keyof typeof Ionicons.glyphMap> = {
  foodie: 'person-outline',
  chef: 'restaurant-outline',
  admin: 'shield-checkmark-outline',
};

export default function AdminScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { ready, isAdmin, userId, refreshProfile } = useAuth();
  const [members, setMembers] = useState<DbProfile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');

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
      if (!ok) { toast.show('Not allowed'); return; }
      setMembers((cur) => cur.map((x) => (x.id === m.id ? { ...x, roles: next } : x)));
      if (m.id === userId) await refreshProfile();
    } catch (e) {
      console.error(e);
      toast.show('Could not update roles');
    } finally {
      setBusy(null);
    }
  };

  const stats = useMemo(() => ({
    total: members.length,
    chefs: members.filter((m) => m.roles.includes('chef')).length,
    foodies: members.filter((m) => m.roles.includes('foodie')).length,
    admins: members.filter((m) => m.roles.includes('admin')).length,
  }), [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.phone?.includes(q) ||
        m.flat?.toLowerCase().includes(q),
    );
  }, [members, query]);

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
        <Container narrow>
          <View className="flex-row items-center gap-2 mb-3">
            <Pressable onPress={() => router.back()} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
              <Ionicons name="chevron-back" size={22} color={c.ink} />
            </Pressable>
            <Text className="font-display-x text-[22px] text-ink">Members</Text>
          </View>

          {/* Stats row */}
          <View className="flex-row gap-2">
            {[
              { label: 'Total', value: stats.total, icon: 'people-outline' as const },
              { label: 'Chefs', value: stats.chefs, icon: 'restaurant-outline' as const },
              { label: 'Foodies', value: stats.foodies, icon: 'person-outline' as const },
              { label: 'Admins', value: stats.admins, icon: 'shield-checkmark-outline' as const },
            ].map((s) => (
              <View key={s.label} className="flex-1 items-center rounded-2xl bg-inset py-2.5 px-1">
                <Ionicons name={s.icon} size={15} color={c.muted} />
                <Text className="font-sans-bold text-[16px] text-ink mt-0.5">{s.value}</Text>
                <Text className="text-[10px] text-faint">{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Search */}
          <View className="mt-3 flex-row items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5">
            <Ionicons name="search-outline" size={16} color={c.faint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, phone or flat…"
              placeholderTextColor={c.faint}
              className="flex-1 font-sans text-[14px] text-ink"
              style={{ outline: 'none' } as any}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={c.faint} />
              </Pressable>
            ) : null}
          </View>
        </Container>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Container narrow>
          {filtered.length === 0 && query.length > 0 ? (
            <View className="items-center py-10">
              <Text className="text-[14px] text-muted">No members match "{query}"</Text>
            </View>
          ) : null}

          {filtered.map((m) => (
            <View key={m.id} className="mb-3 rounded-3xl border border-line bg-surface p-4">
              <View className="flex-row items-center gap-3">
                <Avatar name={m.name} size={44} />
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="font-sans-sb text-[15px] text-ink" numberOfLines={1}>
                      {m.name || 'Unnamed'}
                    </Text>
                    {m.id === userId ? (
                      <View className="rounded-full bg-accent-soft px-1.5 py-0.5">
                        <Text className="text-[10px] font-sans-sb text-accent">you</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-[12px] text-muted">
                    {m.phone ?? '—'}
                    {m.flat ? ` · Flat ${m.flat}` : ''}
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
                      className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border py-2 ${
                        on ? 'border-accent bg-accent-soft' : 'border-line bg-inset'
                      } ${busy === m.id ? 'opacity-50' : ''}`}
                    >
                      <Ionicons
                        name={ROLE_ICON[role]}
                        size={13}
                        color={on ? c.accent : c.faint}
                      />
                      <Text className={`text-[12px] ${on ? 'font-sans-sb text-accent' : 'font-sans-md text-muted'}`}>
                        {ROLE_LABEL[role]}
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
