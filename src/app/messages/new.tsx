import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Container } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { DmParticipant, fetchCommunityMembers, getOrCreateThread } from '../../lib/dm';
import { useThemeColors } from '../../theme';

export default function NewMessageScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { userId, communityId } = useAuth();

  const [members, setMembers] = useState<DmParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId || !communityId) { setLoading(false); return; }
    try {
      setMembers(await fetchCommunityMembers(communityId, userId));
    } catch { toast.show('Could not load neighbours'); }
    finally { setLoading(false); }
  }, [userId, communityId, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.flat ?? '').toLowerCase().includes(q),
    );
  }, [members, query]);

  const startChat = async (member: DmParticipant) => {
    if (opening) return;
    setOpening(member.id);
    try {
      const threadId = await getOrCreateThread(member.id);
      router.replace(`/messages/${threadId}` as any);
    } catch { toast.show('Could not start chat'); setOpening(null); }
  };

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg px-4 pb-3">
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => router.back()} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
          <Text className="font-display-x text-[20px] text-ink">New message</Text>
        </View>
        {/* Search */}
        <View className="mt-3 flex-row items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5">
          <Ionicons name="search-outline" size={18} color={c.faint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search neighbours by name or flat…"
            placeholderTextColor={c.faint}
            className="flex-1 font-sans text-[15px] text-ink"
            style={{ outline: 'none' } as any}
            autoFocus
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={c.faint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Container narrow>
          {loading ? (
            <View className="py-10 items-center"><ActivityIndicator size="small" color={c.muted} /></View>
          ) : filtered.length === 0 ? (
            <View className="items-center px-6 py-16">
              <Ionicons name="people-outline" size={34} color={c.faint} />
              <Text className="mt-2 text-[14px] text-muted text-center">
                {members.length === 0 ? 'No other neighbours have joined yet.' : 'No neighbours match that search.'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 2 }}>
              {filtered.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => startChat(m)}
                  disabled={!!opening}
                  className="flex-row items-center gap-3 rounded-2xl p-3 active:bg-inset"
                >
                  <Avatar name={m.name} size={42} />
                  <View className="flex-1">
                    <Text className="font-sans-bold text-[15px] text-ink" numberOfLines={1}>{m.name}</Text>
                    {m.flat ? <Text className="text-[12px] text-muted">Flat {m.flat}</Text> : null}
                  </View>
                  {opening === m.id ? (
                    <ActivityIndicator size="small" color={c.muted} />
                  ) : (
                    <Ionicons name="chatbubble-outline" size={18} color={c.faint} />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}
