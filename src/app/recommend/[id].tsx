import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { T } from '../../components/T';
import { Avatar, Container, ScreenHeader } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { useConfirm } from '../../context/confirm';
import { waLink } from '../../lib/listings';
import {
  RecoAnswer,
  RecoQuestion,
  deleteAnswer,
  deleteQuestion,
  fetchAnswers,
  fetchQuestion,
  postAnswer,
  recoCategory,
  subscribeAnswers,
  toggleVote,
} from '../../lib/recommend';
import { useThemeColors } from '../../theme';

const ACCENT = '#CA8A04';
function openUrl(u: string) { if (Platform.OS === 'web') window.open(u, '_blank'); else Linking.openURL(u); }

export default function RecoDetailScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, isAdmin } = useAuth();

  const [q, setQ] = useState<RecoQuestion | null>(null);
  const [answers, setAnswers] = useState<RecoAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [provider, setProvider] = useState('');
  const [providerPhone, setProviderPhone] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [qq, aa] = await Promise.all([fetchQuestion(id), fetchAnswers(id, userId ?? undefined)]);
      setQ(qq); setAnswers(aa);
    } catch { /* keep */ } finally { setLoading(false); }
  }, [id, userId]);

  useFocusEffect(useCallback(() => {
    load();
    return id ? subscribeAnswers(id, () => fetchAnswers(id, userId ?? undefined).then(setAnswers).catch(() => {})) : undefined;
  }, [load, id, userId]));

  const vote = async (a: RecoAnswer) => {
    if (!userId) return;
    // optimistic
    setAnswers((prev) => prev.map((x) => x.id === a.id ? { ...x, voted: !x.voted, vote_count: x.vote_count + (x.voted ? -1 : 1) } : x));
    try { await toggleVote(a.id, userId, !!a.voted); } catch { load(); }
  };

  const submit = async () => {
    if (!userId || !body.trim() || posting) return;
    setPosting(true);
    try {
      const ans = await postAnswer({ questionId: id!, authorId: userId, body, providerName: provider || null, providerPhone: providerPhone || null });
      setAnswers((prev) => [...prev, { ...ans, voted: false }]);
      setBody(''); setProvider(''); setProviderPhone('');
    } catch { toast.show('Could not post answer'); } finally { setPosting(false); }
  };

  const removeAnswer = async (a: RecoAnswer) => {
    try { await deleteAnswer(a.id); setAnswers((prev) => prev.filter((x) => x.id !== a.id)); } catch { toast.show('Could not delete'); }
  };

  const removeQuestion = async () => {
    if (!q) return;
    const go = async () => { await deleteQuestion(q.id); if (router.canGoBack()) router.back(); else router.replace('/recommend' as any); };
    if (await confirm({ title: 'Delete question', message: 'Delete this question and its answers?', confirmLabel: 'Delete', destructive: true })) go();
  };

  if (loading) return <View className="flex-1 bg-bg"><ScreenHeader icon="sparkles-outline" iconColor={ACCENT} title="Question" showBack hideSociety /><View className="flex-1 items-center justify-center"><ActivityIndicator color={c.muted} /></View></View>;
  if (!q) return <View className="flex-1 bg-bg"><ScreenHeader icon="sparkles-outline" iconColor={ACCENT} title="Question" showBack hideSociety /><View className="flex-1 items-center justify-center px-8"><Text className="text-center text-[14px] text-muted">This question was removed.</Text></View></View>;

  const meta = recoCategory(q.category);
  const canDeleteQ = q.author_id === userId || isAdmin;

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="sparkles-outline" iconColor={ACCENT} title="Recommendation" showBack hideSociety />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* Question */}
          <View className="flex-row items-center gap-1.5">
            <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: meta.color + '18' }}>
              <Ionicons name={meta.icon as any} size={11} color={meta.color} />
              <Text className="text-[10px] font-sans-sb" style={{ color: meta.color }}>{meta.label}</Text>
            </View>
            {canDeleteQ ? (
              <Pressable onPress={removeQuestion} hitSlop={8} className="ml-auto"><Ionicons name="trash-outline" size={15} color={c.faint} /></Pressable>
            ) : null}
          </View>
          <T source="recommend" id={q.id} field="title" text={q.title} className="mt-2 font-display-x text-[21px] leading-[27px] text-ink" />
          {q.detail ? <T source="recommend" id={q.id} field="detail" text={q.detail} className="mt-1.5 text-[14px] leading-[21px] text-muted" /> : null}
          <View className="mt-2 flex-row items-center gap-2">
            <Avatar name={q.author?.name ?? '?'} size={22} />
            <Text className="text-[12px] text-faint">Asked by {q.author?.name ?? 'a neighbour'}{q.author?.flat ? ` · Flat ${q.author.flat}` : ''}</Text>
          </View>

          {/* Answer composer */}
          <View className="mt-5 rounded-2xl border border-line bg-surface p-3.5">
            <Text className="mb-2 font-sans-bold text-[14px] text-ink">Recommend something</Text>
            <TextInput value={body} onChangeText={setBody} placeholder="Share your recommendation…" placeholderTextColor={c.faint} multiline className="mb-2 rounded-xl border border-line bg-inset px-3 py-2 text-[14px] text-ink" style={{ minHeight: 54, outline: 'none' } as any} />
            <View className="flex-row gap-2">
              <TextInput value={provider} onChangeText={setProvider} placeholder="Name (optional)" placeholderTextColor={c.faint} className="flex-1 rounded-xl border border-line bg-inset px-3 py-2 text-[13px] text-ink" style={{ outline: 'none' } as any} />
              <TextInput value={providerPhone} onChangeText={setProviderPhone} placeholder="Phone (optional)" keyboardType="phone-pad" placeholderTextColor={c.faint} className="flex-1 rounded-xl border border-line bg-inset px-3 py-2 text-[13px] text-ink" style={{ outline: 'none' } as any} />
            </View>
            <Pressable onPress={submit} disabled={!body.trim() || posting} className="mt-2 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5" style={{ backgroundColor: body.trim() ? ACCENT : c.inset }}>
              {posting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={15} color={body.trim() ? '#fff' : c.faint} />}
              <Text className="text-[14px] font-sans-sb" style={{ color: body.trim() ? '#fff' : c.faint }}>Post recommendation</Text>
            </Pressable>
          </View>

          {/* Answers */}
          <Text className="mb-2 mt-5 text-[12px] font-sans-sb uppercase tracking-wider text-muted">
            {answers.length} {answers.length === 1 ? 'recommendation' : 'recommendations'}
          </Text>
          <View className="gap-3">
            {answers.map((a) => (
              <View key={a.id} className="flex-row gap-2.5 rounded-2xl border border-line bg-surface p-3.5">
                {/* Vote */}
                <Pressable onPress={() => vote(a)} className="items-center" hitSlop={6}>
                  <Ionicons name={a.voted ? 'arrow-up-circle' : 'arrow-up-circle-outline'} size={26} color={a.voted ? ACCENT : c.faint} />
                  <Text className="text-[12px] font-sans-bold" style={{ color: a.voted ? ACCENT : c.muted }}>{a.vote_count}</Text>
                </Pressable>
                <View className="flex-1">
                  <T source="reco_answer" id={a.id} field="body" text={a.body} className="text-[14px] leading-[20px] text-ink" />
                  {a.provider_name || a.provider_phone ? (
                    <View className="mt-2 flex-row flex-wrap items-center gap-2">
                      {a.provider_name ? (
                        <View className="flex-row items-center gap-1 rounded-full bg-inset px-2.5 py-1">
                          <Ionicons name="pricetag" size={11} color={c.muted} />
                          <Text className="text-[12px] font-sans-sb text-ink">{a.provider_name}</Text>
                        </View>
                      ) : null}
                      {a.provider_phone ? (
                        <Pressable onPress={() => openUrl(waLink(a.provider_phone, `Hi, a neighbour recommended you on Aangan.`))} className="flex-row items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: '#25D36618' }}>
                          <Ionicons name="logo-whatsapp" size={12} color="#25D366" />
                          <Text className="text-[12px] font-sans-sb" style={{ color: '#25D366' }}>{a.provider_phone}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                  <View className="mt-2 flex-row items-center gap-1.5">
                    <Avatar name={a.author?.name ?? '?'} size={18} />
                    <Text className="text-[11px] text-faint">{a.author?.name ?? 'A neighbour'}{a.author?.flat ? ` · ${a.author.flat}` : ''}</Text>
                    {(a.author_id === userId || isAdmin) ? (
                      <Pressable onPress={() => removeAnswer(a)} hitSlop={8} className="ml-auto"><Ionicons name="trash-outline" size={13} color={c.faint} /></Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
            {answers.length === 0 ? <Text className="py-4 text-center text-[13px] text-muted">No recommendations yet — be the first to help.</Text> : null}
          </View>
        </Container>
      </ScrollView>
    </View>
  );
}
