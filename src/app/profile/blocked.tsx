import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar, Container, ScreenHeader } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useBlocks } from '../../context/blocks';
import { useConfirm } from '../../context/confirm';
import { useToast } from '../../context/toast';
import { BlockedUser, fetchMyBlocks, unblockUser } from '../../lib/moderation';
import { useThemeColors } from '../../theme';

/**
 * Manage the people you've blocked. Apple requires that a block can be undone
 * by the user who made it, so this screen is a hard requirement, not a nicety.
 */
export default function BlockedMembersScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const confirm = useConfirm();
  const { userId } = useAuth();
  const { refresh: refreshBlocks } = useBlocks();

  const [rows, setRows] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try { setRows(await fetchMyBlocks(userId)); }
    catch { /* keep what we have */ }
    finally { setLoading(false); }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const undo = async (row: BlockedUser) => {
    if (!userId) return;
    const name = row.profile?.name ?? 'this member';
    const ok = await confirm({
      title: `Unblock ${name}?`,
      message: "You'll see their content again, and you'll both be able to message each other.",
      confirmLabel: 'Unblock',
    });
    if (!ok) return;
    try {
      await unblockUser(userId, row.blocked_id);
      setRows((prev) => prev.filter((r) => r.blocked_id !== row.blocked_id));
      refreshBlocks();
      toast.show(`Unblocked ${name}`);
    } catch { toast.show('Could not unblock — try again'); }
  };

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="ban-outline" iconColor="#EF4444" title="Blocked members" showBack hideSociety />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {loading ? (
            <View className="items-center py-16"><ActivityIndicator color={c.muted} /></View>
          ) : rows.length === 0 ? (
            <View className="items-center py-20">
              <Ionicons name="shield-checkmark-outline" size={40} color={c.faint} />
              <Text className="mt-3 font-display text-xl text-ink">No one is blocked</Text>
              <Text className="mt-1 max-w-xs text-center text-[14px] text-muted">
                If a neighbour is being abusive, you can block them from their profile or from
                the ⋯ menu on any of their posts.
              </Text>
            </View>
          ) : (
            <>
              <Text className="mb-3 text-[13px] leading-[19px] text-muted">
                You won't see content from these members, and neither of you can message the other.
              </Text>
              <View className="gap-2">
                {rows.map((row) => {
                  const name = row.profile?.name ?? 'A neighbour';
                  return (
                    <View
                      key={row.blocked_id}
                      className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3.5"
                    >
                      <Avatar name={name} size={38} />
                      <View className="min-w-0 flex-1">
                        <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{name}</Text>
                        <Text className="text-[12px] text-muted">
                          {row.profile?.flat ? `Flat ${row.profile.flat}` : 'Neighbour'}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => undo(row)}
                        className="rounded-full border border-line bg-inset px-3.5 py-2 active:opacity-70"
                      >
                        <Text className="text-[12px] font-sans-sb text-ink">Unblock</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}
