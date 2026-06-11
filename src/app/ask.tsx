import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Container, ScreenHeader } from '../components/ui';
import { useToast } from '../context/toast';
import { AIError, askAangan, askResultRoute, askSourceMeta, type AskResponse } from '../lib/ai';
import { haptics } from '../lib/haptics';
import { useThemeColors } from '../theme';

const ACCENT = '#0F6E56';

const EXAMPLES = [
  'Veg tiffin for lunch',
  'Any 2 BHK for rent?',
  'Where can I borrow a drill?',
  'Recommend a good maid',
  'Snacks under ₹100',
];

export default function AskScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const router = useRouter();

  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<AskResponse | null>(null);
  const [asked, setAsked] = useState('');

  const run = async (question: string) => {
    const query = question.trim();
    if (!query || loading) return;
    setQ(query);
    haptics.tap();
    setLoading(true);
    setRes(null);
    setAsked(query);
    try {
      const r = await askAangan(query);
      setRes(r);
      haptics.success();
    } catch (e) {
      toast.show(e instanceof AIError ? e.message : 'Ask Aangan is unavailable right now');
      setAsked('');
    } finally {
      setLoading(false);
    }
  };

  const input = 'flex-1 text-[15px] text-ink';

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader icon="sparkles" iconColor={ACCENT} title="Ask Aangan" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Container narrow>
          <Text className="mb-3 text-[14px] leading-5 text-muted">
            Ask anything about your society in plain words — food, flats, things to borrow, recommendations. Aangan looks across all your neighbours' listings and answers.
          </Text>

          {/* Search box */}
          <View className="mb-3 flex-row items-center gap-2 rounded-2xl border border-line bg-inset px-3.5 py-1">
            <Ionicons name="sparkles" size={18} color={ACCENT} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="e.g. who makes veg tiffin?"
              placeholderTextColor={c.faint}
              returnKeyType="search"
              onSubmitEditing={() => run(q)}
              className={input}
              style={{ paddingVertical: 12, outline: 'none' } as any}
            />
            {q.length > 0 ? (
              <Pressable onPress={() => run(q)} disabled={loading} className="rounded-full px-3 py-1.5" style={{ backgroundColor: ACCENT }}>
                <Text className="font-sans-sb text-[13px] text-white">Ask</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Examples (only before the first ask) */}
          {!asked && !loading ? (
            <View className="mb-2 flex-row flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <Pressable key={ex} onPress={() => run(ex)} className="rounded-full border border-line bg-surface px-3 py-1.5 active:opacity-70">
                  <Text className="text-[12px] font-sans-md text-muted">{ex}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Loading */}
          {loading ? (
            <View className="mt-6 items-center">
              <ActivityIndicator color={ACCENT} />
              <Text className="mt-2 text-[13px] text-faint">Looking across your society…</Text>
            </View>
          ) : null}

          {/* Answer + results */}
          {res && !loading ? (
            <View className="mt-2">
              {res.answer ? (
                <View className="mb-4 rounded-2xl border border-accent/30 bg-accent-soft p-4">
                  <View className="mb-1 flex-row items-center gap-1.5">
                    <Ionicons name="sparkles" size={14} color={ACCENT} />
                    <Text className="font-sans-sb text-[12px]" style={{ color: ACCENT }}>Aangan</Text>
                  </View>
                  <Text className="text-[14px] leading-5 text-ink">{res.answer}</Text>
                </View>
              ) : null}

              {res.results.map((item) => {
                const m = askSourceMeta(item.source);
                return (
                  <Pressable
                    key={`${item.source}-${item.id}`}
                    onPress={() => router.push(askResultRoute(item) as any)}
                    className="mb-2.5 flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 active:opacity-75"
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: m.color + '20' }}>
                      <Ionicons name={m.icon as any} size={18} color={m.color} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-sans-sb text-[14px] text-ink" numberOfLines={1}>{item.title}</Text>
                      <Text className="text-[12px] text-muted" numberOfLines={1}>
                        <Text style={{ color: m.color }}>{m.label}</Text>
                        {item.reason ? ` · ${item.reason}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={c.faint} />
                  </Pressable>
                );
              })}

              {res.results.length === 0 && res.answer === '' ? (
                <Text className="mt-4 text-center text-[13px] text-faint">No matches in the society right now.</Text>
              ) : null}
            </View>
          ) : null}
        </Container>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
