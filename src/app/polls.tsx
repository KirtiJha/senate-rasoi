import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Container, ScreenHeader, Sheet, useResponsive } from '../components/ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { PollRow, closePoll, createPoll, deletePoll, fetchPolls, subscribeToPolls, votePoll } from '../lib/polls';
import { isSupabaseConfigured } from '../lib/supabase';
import { useThemeColors } from '../theme';

export default function PollsScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { communityId, userId, isAdmin } = useAuth();
  const toast = useToast();

  const [polls, setPolls] = useState<PollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try {
      setPolls(await fetchPolls(communityId));
    } catch { toast.show('Could not load polls'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [communityId, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!communityId) return;
    const unsub = subscribeToPolls(communityId, load);
    return unsub;
  }, [communityId, load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const handleVote = async (poll: PollRow, optionId: string) => {
    if (!userId) { toast.show('Sign in to vote'); return; }
    if (poll.my_vote || poll.is_closed) return;
    try {
      await votePoll(poll.id, optionId, userId);
      setPolls((prev: PollRow[]) =>
        prev.map((p: PollRow) =>
          p.id !== poll.id ? p : {
            ...p,
            my_vote: optionId,
            total_votes: p.total_votes + 1,
            options: p.options.map((o) =>
              o.id === optionId ? { ...o, vote_count: o.vote_count + 1 } : o
            ),
          }
        )
      );
    } catch { toast.show('Could not record vote'); }
  };

  const handleDelete = async (poll: PollRow) => {
    try {
      await deletePoll(poll.id);
      setPolls((prev: PollRow[]) => prev.filter((p: PollRow) => p.id !== poll.id));
      toast.show('Poll deleted');
    } catch { toast.show('Could not delete poll'); }
  };

  const handleClose = async (poll: PollRow) => {
    try {
      await closePoll(poll.id);
      setPolls((prev: PollRow[]) =>
        prev.map((p: PollRow) => p.id === poll.id ? { ...p, is_closed: true } : p)
      );
      toast.show('Poll closed');
    } catch { toast.show('Could not close poll'); }
  };

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="bar-chart-outline" iconColor="#8B5CF6" title="Community Polls" showBack onAdd={() => setShowCreate(true)} addLabel="Create poll" />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Container>
          {loading ? (
            <View className="gap-4">
              {[1, 2].map((i) => <View key={i} className="h-40 rounded-3xl bg-surface" />)}
            </View>
          ) : polls.length === 0 ? (
            <View className="items-center py-20">
              <Ionicons name="bar-chart-outline" size={44} color={c.faint} />
              <Text className="mt-3 font-display text-xl text-ink">No polls yet</Text>
              <Text className="mt-1 text-center text-[14px] text-muted max-w-xs">
                Create a poll to gather opinions from your society members.
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {polls.map((poll: PollRow) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  userId={userId}
                  isAdmin={!!isAdmin}
                  onVote={(optionId: string) => handleVote(poll, optionId)}
                  onDelete={() => handleDelete(poll)}
                  onClose={() => handleClose(poll)}
                  c={c}
                />
              ))}
            </View>
          )}
        </Container>
      </ScrollView>

      <CreatePollModal
        visible={showCreate}
        communityId={communityId ?? ''}
        userId={userId ?? ''}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); load(); toast.show('Poll created!'); }}
        c={c}
      />
    </View>
  );
}

function PollCard({
  poll, userId, isAdmin, onVote, onDelete, onClose, c,
}: {
  poll: PollRow;
  userId: string | null;
  isAdmin: boolean;
  onVote: (optionId: string) => void;
  onDelete: () => void;
  onClose: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const hasVoted = !!poll.my_vote;
  const showResults = hasVoted || poll.is_closed;
  const isAuthor = poll.author_id === userId;

  return (
    <View className="rounded-3xl border border-line bg-surface overflow-hidden">
      <View style={{ height: 3, backgroundColor: '#8B5CF6' }} />
      <View className="p-4">
        {/* Meta row */}
        <View className="flex-row items-center gap-2 mb-3">
          <Avatar name={poll.author?.name ?? '?'} size={22} />
          <Text className="flex-1 text-[12px] text-faint">
            {poll.author?.name ?? 'Someone'}
            {poll.author?.flat ? ` · Flat ${poll.author.flat}` : ''}
          </Text>
          {poll.is_closed ? (
            <View className="rounded-full bg-inset px-2 py-0.5">
              <Text className="text-[10px] font-sans-sb text-muted">Closed</Text>
            </View>
          ) : null}
          {(isAuthor || isAdmin) ? (
            <View className="flex-row gap-1">
              {!poll.is_closed && (isAuthor || isAdmin) ? (
                <Pressable onPress={onClose} hitSlop={8} className="h-7 w-7 items-center justify-center rounded-full active:bg-inset">
                  <Ionicons name="lock-closed-outline" size={14} color={c.faint} />
                </Pressable>
              ) : null}
              <Pressable onPress={onDelete} hitSlop={8} className="h-7 w-7 items-center justify-center rounded-full active:bg-inset">
                <Ionicons name="trash-outline" size={14} color={c.faint} />
              </Pressable>
            </View>
          ) : null}
        </View>

        <Text className="font-sans-sb text-[15px] text-ink mb-3">{poll.question}</Text>

        {/* Options */}
        <View className="gap-2">
          {poll.options.map((opt) => {
            const isMyVote = opt.id === poll.my_vote;
            const pct = poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;

            return (
              <Pressable
                key={opt.id}
                onPress={() => { if (!hasVoted && !poll.is_closed) onVote(opt.id); }}
                disabled={hasVoted || poll.is_closed}
                className="rounded-xl overflow-hidden"
                style={{ borderWidth: 1, borderColor: isMyVote ? '#8B5CF6' : c.line }}
              >
                {showResults ? (
                  <View
                    className="absolute inset-0 rounded-xl"
                    style={{ backgroundColor: isMyVote ? '#8B5CF630' : c.inset, width: `${pct}%` }}
                  />
                ) : null}
                <View className="flex-row items-center justify-between px-3.5 py-2.5">
                  <Text className={`flex-1 text-[13px] ${isMyVote ? 'font-sans-sb text-violet-600' : 'font-sans-md text-ink'}`}>
                    {opt.text}
                  </Text>
                  {showResults ? (
                    <Text className={`text-[12px] ml-2 ${isMyVote ? 'font-sans-sb text-violet-600' : 'text-muted'}`}>
                      {pct}%
                    </Text>
                  ) : null}
                  {isMyVote ? <Ionicons name="checkmark-circle" size={16} color="#8B5CF6" style={{ marginLeft: 4 }} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text className="mt-2.5 text-[11px] text-faint">
          {poll.total_votes} vote{poll.total_votes !== 1 ? 's' : ''}
          {!hasVoted && !poll.is_closed ? ' · Tap to vote' : ''}
        </Text>
      </View>
    </View>
  );
}

function CreatePollModal({
  visible, communityId, userId, onClose, onCreated, c,
}: {
  visible: boolean;
  communityId: string;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [saving, setSaving] = useState(false);

  const addOption = () => {
    if (options.length < 6) setOptions((prev) => [...prev, '']);
  };

  const setOption = (i: number, val: string) => {
    setOptions((prev) => prev.map((o, idx) => idx === i ? val : o));
  };

  const removeOption = (i: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  };

  const canSubmit = question.trim() && options.filter((o) => o.trim()).length >= 2;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await createPoll({ communityId, authorId: userId, question, options: options.filter((o) => o.trim()) });
      setQuestion(''); setOptions(['', '']);
      onCreated();
    } catch {
      // parent handles toast
    } finally { setSaving(false); }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Create poll"
      footer={
        <Pressable
          onPress={submit}
          disabled={saving || !canSubmit}
          className={`items-center rounded-2xl py-3.5 ${saving || !canSubmit ? 'bg-inset' : 'bg-accent active:bg-accent-press'}`}
        >
          <Text className={`font-sans-sb text-[15px] ${saving || !canSubmit ? 'text-faint' : 'text-on-accent'}`}>
            {saving ? 'Creating…' : 'Create Poll'}
          </Text>
        </Pressable>
      }
    >
      <View className="mb-4">
        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Question</Text>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="Ask your community something…"
          placeholderTextColor={c.faint}
          multiline
          className="rounded-2xl border border-line bg-inset px-3.5 py-3 text-[15px] text-ink"
          style={{ minHeight: 72, outline: 'none' } as any}
        />
      </View>

      <View className="mb-1">
        <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Options (2–6)</Text>
        <View className="gap-2">
          {options.map((opt, i) => (
            <View key={i} className="flex-row items-center gap-2">
              <TextInput
                value={opt}
                onChangeText={(v) => setOption(i, v)}
                placeholder={`Option ${i + 1}`}
                placeholderTextColor={c.faint}
                className="flex-1 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[14px] text-ink"
                style={{ outline: 'none' } as any}
              />
              {options.length > 2 ? (
                <Pressable onPress={() => removeOption(i)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={c.faint} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
        {options.length < 6 ? (
          <Pressable onPress={addOption} className="mt-2 flex-row items-center gap-1.5 py-1">
            <Ionicons name="add-circle-outline" size={16} color={c.accent} />
            <Text className="text-[13px] font-sans-md text-accent">Add option</Text>
          </Pressable>
        ) : null}
      </View>
    </Sheet>
  );
}
