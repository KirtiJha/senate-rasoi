import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { openPhotoPicker } from '../lib/photo';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Container, ErrorState, ScreenHeader, Sheet, Skeleton, useResponsive } from '../components/ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { useConfirm } from '../context/confirm';
import { PollRow, closePoll, createPoll, deletePoll, fetchPolls, subscribeToPolls, updatePoll, votePoll } from '../lib/polls';
import { isSupabaseConfigured } from '../lib/supabase';
import { useThemeColors } from '../theme';

export default function PollsScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { communityId, userId, isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [polls, setPolls] = useState<PollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try {
      setPolls(await fetchPolls(communityId));
      setLoadFailed(false);
    } catch (e) {
      console.error('polls: load failed', e);
      setLoadFailed(true);
    } finally { setLoading(false); setRefreshing(false); }
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
    if (!(await confirm({ title: 'Delete poll', message: `Delete "${poll.question}" and its votes?`, confirmLabel: 'Delete', destructive: true }))) return;
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
              {[1, 2].map((i) => <Skeleton key={i} style={{ height: 160 }} radius={24} />)}
            </View>
          ) : loadFailed ? (
            <ErrorState
              title="Couldn't load polls"
              message="No polls have been deleted — we just couldn't reach them. Try again."
              onRetry={load}
            />
          ) : polls.length === 0 ? (
            <View className="items-center py-20">
              <Ionicons name="bar-chart-outline" size={44} color={c.faint} />
              <Text className="mt-3 font-display text-xl text-ink">No polls yet</Text>
              <Text className="font-sans mt-1 text-center text-[14px] text-muted max-w-xs">
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
                  onChanged={load}
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
  poll, userId, isAdmin, onVote, onDelete, onClose, onChanged, c,
}: {
  poll: PollRow;
  userId: string | null;
  isAdmin: boolean;
  onVote: (optionId: string) => void;
  onDelete: () => void;
  onClose: () => void;
  onChanged: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const toast = useToast();
  const hasVoted = !!poll.my_vote;
  const showResults = hasVoted || poll.is_closed;
  const isAuthor = poll.author_id === userId;
  const [showEdit, setShowEdit] = useState(false);
  const [editQ, setEditQ] = useState(poll.question);
  const [editImg, setEditImg] = useState<{ uri: string; isNew: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const openEdit = () => { setEditQ(poll.question); setEditImg(poll.image_url ? { uri: poll.image_url, isNew: false } : null); setShowEdit(true); };
  const pickImg = async () => {
    const res = await openPhotoPicker({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true });
    if (!res.canceled) setEditImg({ uri: res.assets[0].uri, isNew: true });
  };

  const saveEdit = async () => {
    if (!editQ.trim()) return toast.show('Question can’t be empty');
    setSaving(true);
    try { await updatePoll(poll.id, { question: editQ, imageUri: editImg === null ? null : editImg.uri }); setShowEdit(false); onChanged(); toast.show('Poll updated ✓'); }
    catch { toast.show('Could not save'); } finally { setSaving(false); }
  };

  return (
    <View className="rounded-3xl border border-line bg-surface overflow-hidden">
      <View style={{ height: 3, backgroundColor: '#8B5CF6' }} />
      <View className="p-4">
        {/* Meta row */}
        <View className="flex-row items-center gap-2 mb-3">
          <Avatar name={poll.author?.name ?? '?'} size={22} />
          <Text className="font-sans flex-1 text-[12px] text-faint">
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
              <Pressable onPress={openEdit} hitSlop={8} className="h-7 w-7 items-center justify-center rounded-full active:bg-inset">
                <Ionicons name="create-outline" size={14} color={c.faint} />
              </Pressable>
              {!poll.is_closed ? (
                <Pressable onPress={onClose} hitSlop={8} className="h-7 w-7 items-center justify-center rounded-full active:bg-inset">
                  <Ionicons name="lock-closed-outline" size={14} color={c.faint} />
                </Pressable>
              ) : null}
              <Pressable onPress={onDelete} hitSlop={8} className="h-7 w-7 items-center justify-center rounded-full active:bg-inset">
                <Ionicons name="trash-outline" size={14} color={c.faint} />
              </Pressable>
            </View>
          ) : null}

          <Sheet visible={showEdit} onClose={() => setShowEdit(false)} title="Edit poll question">
            <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Question</Text>
            <TextInput value={editQ} onChangeText={setEditQ} multiline className="mb-3 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink" style={{ minHeight: 60, outline: 'none' } as any} />
            <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Image (optional)</Text>
            <View className="mb-3 flex-row items-center gap-3">
              <Pressable onPress={pickImg} className="h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface active:opacity-70">
                {editImg ? <Image source={{ uri: editImg.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Ionicons name="image-outline" size={22} color={c.faint} />}
              </Pressable>
              {editImg ? <Pressable onPress={() => setEditImg(null)} hitSlop={6}><Text className="text-[13px] font-sans-sb text-nonveg">Remove</Text></Pressable> : null}
            </View>
            <Text className="font-sans mb-4 text-[12px] text-faint">Options stay the same so existing votes are preserved.</Text>
            <Pressable onPress={saveEdit} disabled={saving} className="items-center rounded-2xl bg-accent py-3 active:opacity-80" style={{ opacity: saving ? 0.6 : 1 }}>
              <Text className="font-sans-sb text-[15px]" style={{ color: c.onAccent }}>{saving ? 'Saving…' : 'Save changes'}</Text>
            </Pressable>
          </Sheet>
        </View>

        <Text className="font-sans-sb text-[15px] text-ink mb-3">{poll.question}</Text>

        {poll.image_url ? (
          <View className="mb-3 w-full overflow-hidden rounded-2xl bg-inset" style={{ height: 200 }}>
            <Image source={{ uri: poll.image_url }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          </View>
        ) : null}

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
                  <Text className={`flex-1 text-[13px] ${isMyVote ? 'font-sans-sb text-accent' : 'font-sans-md text-ink'}`}>
                    {opt.text}
                  </Text>
                  {showResults ? (
                    <Text className={`text-[12px] ml-2 ${isMyVote ? 'font-sans-sb text-accent' : 'text-muted'}`}>
                      {pct}%
                    </Text>
                  ) : null}
                  {isMyVote ? <Ionicons name="checkmark-circle" size={16} color="#8B5CF6" style={{ marginLeft: 4 }} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text className="font-sans mt-2.5 text-[11px] text-faint">
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
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const res = await openPhotoPicker({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true });
    if (!res.canceled) setImage(res.assets[0].uri);
  };

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
      await createPoll({ communityId, authorId: userId, question, options: options.filter((o) => o.trim()), imageUri: image });
      setQuestion(''); setOptions(['', '']); setImage(null);
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

      <View className="mb-4">
        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Image (optional)</Text>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={pickImage} className="h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface active:opacity-70">
            {image ? <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Ionicons name="image-outline" size={22} color={c.faint} />}
          </Pressable>
          {image ? <Pressable onPress={() => setImage(null)} hitSlop={6}><Text className="text-[13px] font-sans-sb text-nonveg">Remove</Text></Pressable> : null}
        </View>
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
