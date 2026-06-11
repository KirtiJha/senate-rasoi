import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { T } from '../components/T';
import { Avatar, Button, Container, ScreenHeader, Sheet } from '../components/ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { RECO_CATEGORIES, RecoQuestion, askQuestion, fetchQuestions, recoCategory, subscribeQuestions } from '../lib/recommend';
import { useThemeColors } from '../theme';

const ACCENT = '#CA8A04';

export default function RecommendScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const toast = useToast();
  const { userId, communityId } = useAuth();

  const [rows, setRows] = useState<RecoQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<string>('all');
  const [showAsk, setShowAsk] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await fetchQuestions(cat)); } catch { /* keep */ } finally { setLoading(false); }
  }, [cat]);

  useFocusEffect(useCallback(() => {
    setLoading(true); load();
    return subscribeQuestions(communityId, load);
  }, [load, communityId]));

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="sparkles-outline"
        iconColor={ACCENT}
        title="Ask & Recommend"
        showBack
        onAdd={() => setShowAsk(true)}
        addLabel="Ask"
        subBar={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {([['all', 'All'] as const, ...RECO_CATEGORIES.map((r) => [r.key, r.label] as const)]).map(([k, label]) => (
              <Pressable key={k} onPress={() => setCat(k)} className="rounded-full px-3 py-1.5" style={{ backgroundColor: cat === k ? ACCENT : c.inset }}>
                <Text className="text-[12px] font-sans-sb" style={{ color: cat === k ? '#fff' : c.muted }}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container>
          {loading ? (
            <Text className="px-1 py-10 text-center text-[13px] text-muted">Loading…</Text>
          ) : rows.length === 0 ? (
            <View className="items-center px-6 py-16">
              <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: ACCENT + '18' }}>
                <Ionicons name="sparkles" size={26} color={ACCENT} />
              </View>
              <Text className="font-sans-bold text-[15px] text-ink">No questions yet</Text>
              <Text className="mt-1 max-w-[280px] text-center text-[13px] text-muted">
                Looking for a good doctor, tutor, plumber or vendor? Ask your neighbours.
              </Text>
              <Pressable onPress={() => setShowAsk(true)} className="mt-5 flex-row items-center gap-2 rounded-2xl px-5 py-3 active:opacity-90" style={{ backgroundColor: ACCENT }}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text className="font-sans-bold text-[14px] text-white">Ask a question</Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-3">
              {rows.map((q) => {
                const meta = recoCategory(q.category);
                return (
                  <Pressable key={q.id} onPress={() => router.push(`/recommend/${q.id}` as any)} className="rounded-2xl border border-line bg-surface p-4 active:opacity-90">
                    <View className="mb-1.5 flex-row items-center gap-1.5">
                      <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: meta.color + '18' }}>
                        <Ionicons name={meta.icon as any} size={11} color={meta.color} />
                        <Text className="text-[10px] font-sans-sb" style={{ color: meta.color }}>{meta.label}</Text>
                      </View>
                      <Text className="ml-auto text-[11px] text-faint">{q.answer_count} {q.answer_count === 1 ? 'answer' : 'answers'}</Text>
                    </View>
                    <T source="recommend" id={q.id} field="title" text={q.title} showToggle={false} className="font-sans-bold text-[15px] text-ink" />
                    {q.detail ? <T source="recommend" id={q.id} field="detail" text={q.detail} showToggle={false} className="mt-0.5 text-[13px] text-muted" numberOfLines={2} /> : null}
                    <View className="mt-2 flex-row items-center gap-2">
                      <Avatar name={q.author?.name ?? '?'} size={20} />
                      <Text className="text-[11.5px] text-faint">{q.author?.name ?? 'A neighbour'}{q.author?.flat ? ` · Flat ${q.author.flat}` : ''}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Container>
      </ScrollView>

      <AskSheet
        visible={showAsk}
        onClose={() => setShowAsk(false)}
        c={c}
        onSubmit={async (vals) => {
          if (!userId) return;
          try {
            const q = await askQuestion({ communityId, authorId: userId, category: vals.category, title: vals.title, detail: vals.detail });
            setShowAsk(false);
            router.push(`/recommend/${q.id}` as any);
          } catch { toast.show('Could not post — try again'); }
        }}
      />
    </View>
  );
}

function AskSheet({ visible, onClose, onSubmit, c }: {
  visible: boolean; onClose: () => void;
  onSubmit: (v: { category: string; title: string; detail: string | null }) => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const [category, setCategory] = useState<string>('health');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const input = 'rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink';
  return (
    <Sheet visible={visible} onClose={() => { setTitle(''); setDetail(''); onClose(); }} title="Ask your neighbours">
      <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Category</Text>
      <View className="mb-3 flex-row flex-wrap gap-2">
        {RECO_CATEGORIES.map((r) => {
          const on = category === r.key;
          return (
            <Pressable key={r.key} onPress={() => setCategory(r.key)} className="flex-row items-center gap-1 rounded-full border px-3 py-1.5" style={{ borderColor: on ? r.color : c.line, backgroundColor: on ? r.color + '14' : c.surface }}>
              <Ionicons name={r.icon as any} size={12} color={on ? r.color : c.muted} />
              <Text className="text-[12px] font-sans-sb" style={{ color: on ? r.color : c.muted }}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Your question</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Reliable pediatrician near our society?" placeholderTextColor={c.faint} className={`mb-3 ${input}`} style={{ outline: 'none' } as any} />
      <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Details (optional)</Text>
      <TextInput value={detail} onChangeText={setDetail} placeholder="Any specifics — budget, area, timing…" placeholderTextColor={c.faint} multiline className={`mb-4 ${input}`} style={{ minHeight: 64, outline: 'none' } as any} />
      <Button label="Post question" icon="send" fullWidth disabled={!title.trim()} onPress={() => onSubmit({ category, title, detail: detail || null })} />
    </Sheet>
  );
}
