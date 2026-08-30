import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { openPhotoPicker } from '../../lib/photo';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { T } from '../../components/T';
import { Avatar, Container, ScreenHeader, Sheet } from '../../components/ui';
import { ModerationMenu } from '../../components/ModerationMenu';
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
  updateAnswer,
  updateQuestion,
} from '../../lib/recommend';
import { useThemeColors } from '../../theme';

function openUrl(u: string) { if (Platform.OS === 'web') window.open(u, '_blank'); else Linking.openURL(u); }

export default function RecoDetailScreen() {
  const c = useThemeColors();
  const ACCENT = c.accent;
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
  const [ansPhoto, setAnsPhoto] = useState<string | null>(null); // new-answer composer photo
  // Edit state — question (sheet) + per-answer inline edit.
  const [showEditQ, setShowEditQ] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDetail, setEditDetail] = useState('');
  const [editQPhoto, setEditQPhoto] = useState<{ uri: string; isNew: boolean } | null>(null);
  const [savingQ, setSavingQ] = useState(false);
  const [editAnsId, setEditAnsId] = useState<string | null>(null);
  const [aBody, setABody] = useState('');
  const [aName, setAName] = useState('');
  const [aPhone, setAPhone] = useState('');
  const [aEditPhoto, setAEditPhoto] = useState<{ uri: string; isNew: boolean } | null>(null);
  const [savingA, setSavingA] = useState(false);

  const pickImg = async (set: (uri: string) => void) => {
    const res = await openPhotoPicker({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true });
    if (!res.canceled) set(res.assets[0].uri);
  };

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
      const ans = await postAnswer({ questionId: id!, authorId: userId, body, providerName: provider || null, providerPhone: providerPhone || null, photoUri: ansPhoto });
      setAnswers((prev) => [...prev, { ...ans, voted: false }]);
      setBody(''); setProvider(''); setProviderPhone(''); setAnsPhoto(null);
    } catch { toast.show('Could not post answer'); } finally { setPosting(false); }
  };

  const removeAnswer = async (a: RecoAnswer) => {
    if (!(await confirm({ title: 'Delete answer', message: 'Delete this answer?', confirmLabel: 'Delete', destructive: true }))) return;
    try { await deleteAnswer(a.id); setAnswers((prev) => prev.filter((x) => x.id !== a.id)); } catch { toast.show('Could not delete'); }
  };

  const removeQuestion = async () => {
    if (!q) return;
    const go = async () => { await deleteQuestion(q.id); if (router.canGoBack()) router.back(); else router.replace('/recommend' as any); };
    if (await confirm({ title: 'Delete question', message: 'Delete this question and its answers?', confirmLabel: 'Delete', destructive: true })) go();
  };

  const openEditQ = () => { if (!q) return; setEditTitle(q.title); setEditDetail(q.detail ?? ''); setEditQPhoto(q.photo_url ? { uri: q.photo_url, isNew: false } : null); setShowEditQ(true); };
  const saveEditQ = async () => {
    if (!q || !editTitle.trim()) return toast.show('Add a question');
    setSavingQ(true);
    try { await updateQuestion(q.id, { title: editTitle, detail: editDetail || null, photoUri: editQPhoto === null ? null : editQPhoto.uri }); setShowEditQ(false); await load(); toast.show('Updated ✓'); }
    catch { toast.show('Could not save'); } finally { setSavingQ(false); }
  };

  const startEditAns = (a: RecoAnswer) => { setEditAnsId(a.id); setABody(a.body); setAName(a.provider_name ?? ''); setAPhone(a.provider_phone ?? ''); setAEditPhoto(a.photo_url ? { uri: a.photo_url, isNew: false } : null); };
  const saveEditAns = async () => {
    if (!editAnsId || !aBody.trim()) return toast.show('Write something');
    setSavingA(true);
    try { await updateAnswer(editAnsId, { body: aBody, providerName: aName || null, providerPhone: aPhone || null, photoUri: aEditPhoto === null ? null : aEditPhoto.uri }); setEditAnsId(null); await load(); toast.show('Updated ✓'); }
    catch { toast.show('Could not save'); } finally { setSavingA(false); }
  };

  if (loading) return <View className="flex-1 bg-bg"><ScreenHeader icon="sparkles-outline" iconColor={ACCENT} title="Question" showBack hideSociety /><View className="flex-1 items-center justify-center"><ActivityIndicator color={c.muted} /></View></View>;
  if (!q) return <View className="flex-1 bg-bg"><ScreenHeader icon="sparkles-outline" iconColor={ACCENT} title="Question" showBack hideSociety /><View className="flex-1 items-center justify-center px-8"><Text className="font-sans text-center text-[14px] text-muted">This question was removed.</Text></View></View>;

  const meta = recoCategory(q.category);
  const canDeleteQ = q.author_id === userId || isAdmin;

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="sparkles-outline" iconColor={ACCENT} title="Recommendation" showBack hideSociety right={<ModerationMenu targetType="recommend" targetId={q.id} targetOwnerId={q.author_id} targetOwnerName={q.author?.name} />} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* Question */}
          <View className="flex-row items-center gap-1.5">
            <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: c.accentSoft }}>
              <Ionicons name={meta.icon as any} size={11} color={c.accent} />
              <Text className="text-[10px] font-sans-sb" style={{ color: c.accent }}>{meta.label}</Text>
            </View>
            {canDeleteQ ? (
              <View className="ml-auto flex-row items-center gap-2.5">
                <Pressable accessibilityRole="button" accessibilityLabel="Edit" onPress={openEditQ} hitSlop={8}><Ionicons name="create-outline" size={15} color={c.faint} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Delete" onPress={removeQuestion} hitSlop={8}><Ionicons name="trash-outline" size={15} color={c.faint} /></Pressable>
              </View>
            ) : null}
          </View>
          <T source="recommend" id={q.id} field="title" text={q.title} className="mt-2 font-display-x text-[21px] leading-[27px] text-ink" />
          {q.detail ? <T source="recommend" id={q.id} field="detail" text={q.detail} className="mt-1.5 text-[14px] leading-[21px] text-muted" /> : null}
          {q.photo_url ? (
            <View className="mt-2.5 w-full overflow-hidden rounded-2xl bg-inset" style={{ height: 200 }}>
              <Image source={{ uri: q.photo_url }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
            </View>
          ) : null}
          <View className="mt-2 flex-row items-center gap-2">
            <Avatar name={q.author?.name ?? '?'} size={22} />
            <Text className="font-sans text-[12px] text-faint">Asked by {q.author?.name ?? 'a neighbour'}{q.author?.flat ? ` · Flat ${q.author.flat}` : ''}</Text>
          </View>

          {/* Answer composer */}
          <View className="mt-5 card p-3.5">
            <Text className="mb-2 font-sans-bold text-[14px] text-ink">Recommend something</Text>
            <TextInput value={body} onChangeText={setBody} placeholder="Share your recommendation…" placeholderTextColor={c.faint} multiline className="mb-2 rounded-xl border border-line bg-inset px-3 py-2 text-[14px] text-ink" style={{ minHeight: 54, outline: 'none' } as any} />
            <View className="flex-row gap-2">
              <TextInput value={provider} onChangeText={setProvider} placeholder="Name (optional)" placeholderTextColor={c.faint} className="flex-1 rounded-xl border border-line bg-inset px-3 py-2 text-[13px] text-ink" style={{ outline: 'none' } as any} />
              <TextInput value={providerPhone} onChangeText={setProviderPhone} placeholder="Phone (optional)" keyboardType="phone-pad" placeholderTextColor={c.faint} className="flex-1 rounded-xl border border-line bg-inset px-3 py-2 text-[13px] text-ink" style={{ outline: 'none' } as any} />
            </View>
            <View className="mt-2 flex-row items-center gap-2">
              <Pressable onPress={() => pickImg(setAnsPhoto)} className="h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-inset active:opacity-70">
                {ansPhoto ? <Image source={{ uri: ansPhoto }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Ionicons name="image-outline" size={18} color={c.faint} />}
              </Pressable>
              {ansPhoto ? <Pressable onPress={() => setAnsPhoto(null)} hitSlop={6}><Text className="text-[12px] font-sans-sb text-nonveg">Remove photo</Text></Pressable> : <Text className="font-sans text-[12px] text-faint">Add a photo (optional)</Text>}
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
              <View key={a.id} className="flex-row gap-2.5 card p-3.5">
                {/* Vote */}
                <Pressable onPress={() => vote(a)} className="items-center" hitSlop={6}>
                  <Ionicons name={a.voted ? 'arrow-up-circle' : 'arrow-up-circle-outline'} size={26} color={a.voted ? ACCENT : c.faint} />
                  <Text className="text-[12px] font-sans-bold" style={{ color: a.voted ? ACCENT : c.muted }}>{a.vote_count}</Text>
                </Pressable>
                <View className="flex-1">
                  {editAnsId === a.id ? (
                    <View>
                      <TextInput value={aBody} onChangeText={setABody} multiline autoFocus className="rounded-xl border border-line bg-inset px-3 py-2 text-[14px] text-ink" style={{ minHeight: 54, outline: 'none' } as any} />
                      <View className="mt-2 flex-row gap-2">
                        <TextInput value={aName} onChangeText={setAName} placeholder="Name (optional)" placeholderTextColor={c.faint} className="flex-1 rounded-xl border border-line bg-inset px-3 py-2 text-[13px] text-ink" style={{ outline: 'none' } as any} />
                        <TextInput value={aPhone} onChangeText={setAPhone} placeholder="Phone (optional)" keyboardType="phone-pad" placeholderTextColor={c.faint} className="flex-1 rounded-xl border border-line bg-inset px-3 py-2 text-[13px] text-ink" style={{ outline: 'none' } as any} />
                      </View>
                      <View className="mt-2 flex-row items-center gap-2">
                        <Pressable onPress={() => pickImg((uri) => setAEditPhoto({ uri, isNew: true }))} className="h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-inset active:opacity-70">
                          {aEditPhoto ? <Image source={{ uri: aEditPhoto.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Ionicons name="image-outline" size={16} color={c.faint} />}
                        </Pressable>
                        {aEditPhoto ? <Pressable onPress={() => setAEditPhoto(null)} hitSlop={6}><Text className="text-[12px] font-sans-sb text-nonveg">Remove</Text></Pressable> : <Text className="font-sans text-[12px] text-faint">Photo</Text>}
                      </View>
                      <View className="mt-2 flex-row gap-2">
                        <Pressable onPress={saveEditAns} disabled={savingA} className="rounded-full px-3 py-1.5" style={{ backgroundColor: ACCENT }}><Text className="text-[12px] font-sans-sb text-white">{savingA ? 'Saving…' : 'Save'}</Text></Pressable>
                        <Pressable onPress={() => setEditAnsId(null)} className="rounded-full px-3 py-1.5" style={{ backgroundColor: c.inset }}><Text className="text-[12px] font-sans-sb text-muted">Cancel</Text></Pressable>
                      </View>
                    </View>
                  ) : (
                    <>
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
                      {a.photo_url ? (
                        <View className="mt-2 w-full overflow-hidden rounded-xl bg-inset" style={{ height: 160 }}>
                          <Image source={{ uri: a.photo_url }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                        </View>
                      ) : null}
                    </>
                  )}
                  <View className="mt-2 flex-row items-center gap-1.5">
                    <Avatar name={a.author?.name ?? '?'} size={18} />
                    <Text className="font-sans text-[11px] text-faint">{a.author?.name ?? 'A neighbour'}{a.author?.flat ? ` · ${a.author.flat}` : ''}</Text>
                    {(a.author_id === userId || isAdmin) && editAnsId !== a.id ? (
                      <View className="ml-auto flex-row items-center gap-2.5">
                        {(a.author_id === userId || isAdmin) ? (
                          <Pressable accessibilityRole="button" accessibilityLabel="Edit" onPress={() => startEditAns(a)} hitSlop={8}><Ionicons name="create-outline" size={13} color={c.faint} /></Pressable>
                        ) : null}
                        <Pressable accessibilityRole="button" accessibilityLabel="Delete" onPress={() => removeAnswer(a)} hitSlop={8}><Ionicons name="trash-outline" size={13} color={c.faint} /></Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
            {answers.length === 0 ? <Text className="font-sans py-4 text-center text-[13px] text-muted">No recommendations yet — be the first to help.</Text> : null}
          </View>
        </Container>
      </ScrollView>

      <Sheet visible={showEditQ} onClose={() => setShowEditQ(false)} title="Edit question">
        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Question</Text>
        <TextInput value={editTitle} onChangeText={setEditTitle} className="mb-3 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink" style={{ outline: 'none' } as any} />
        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Details (optional)</Text>
        <TextInput value={editDetail} onChangeText={setEditDetail} multiline className="mb-3 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink" style={{ minHeight: 70, outline: 'none' } as any} />
        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Photo (optional)</Text>
        <View className="mb-4 flex-row items-center gap-3">
          <Pressable onPress={() => pickImg((uri) => setEditQPhoto({ uri, isNew: true }))} className="h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface active:opacity-70">
            {editQPhoto ? <Image source={{ uri: editQPhoto.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Ionicons name="image-outline" size={22} color={c.faint} />}
          </Pressable>
          {editQPhoto ? <Pressable onPress={() => setEditQPhoto(null)} hitSlop={6}><Text className="text-[13px] font-sans-sb text-nonveg">Remove</Text></Pressable> : null}
        </View>
        <Pressable onPress={saveEditQ} disabled={savingQ} className="items-center rounded-2xl py-3 active:opacity-80" style={{ backgroundColor: ACCENT, opacity: savingQ ? 0.6 : 1 }}>
          <Text className="font-sans-sb text-[15px] text-white">{savingQ ? 'Saving…' : 'Save changes'}</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}
