import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BrandMark } from '../components/BrandMark';
import { ScreenHeader } from '../components/ui';
import { useToast } from '../context/toast';
import { AIError, askAangan, askResultRoute, askSourceMeta, type ChatTurn } from '../lib/ai';
import { AskMessage, clearAskConversation, getAskConversation, setAskConversation } from '../lib/askStore';
import { haptics } from '../lib/haptics';
import { useThemeColors } from '../theme';

const ACCENT = '#0F6E56';

const EXAMPLES = [
  'Veg tiffin for lunch',
  'Any 2 BHK for rent?',
  'Where can I borrow a drill?',
  'How many members are in the society?',
  'Is there a doctor in the society?',
];

export default function AskScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  // Seed from the in-memory store so the thread survives navigation.
  const [messages, setMessages] = useState<AskMessage[]>(() => getAskConversation());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const persist = (next: AskMessage[]) => { setMessages(next); setAskConversation(next); };

  const scrollDown = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

  const send = async (raw: string) => {
    const q = raw.trim();
    if (!q || loading) return;
    haptics.tap();
    const history: ChatTurn[] = messages.map((m) => ({ role: m.role, text: m.text }));
    const withUser: AskMessage[] = [...messages, { role: 'user', text: q }];
    persist(withUser);
    setInput('');
    setLoading(true);
    scrollDown();
    try {
      const r = await askAangan(q, history);
      persist([...withUser, { role: 'assistant', text: r.answer || "I couldn't find anything on that.", results: r.results }]);
      haptics.success();
    } catch (e) {
      persist([...withUser, { role: 'assistant', text: e instanceof AIError ? e.message : 'Ask Aangan is unavailable right now.' }]);
    } finally {
      setLoading(false);
      scrollDown();
    }
  };

  const newChat = () => { clearAskConversation(); setMessages([]); setInput(''); };

  const empty = messages.length === 0;

  return (
    <KeyboardAvoidingView className="flex-1 overflow-hidden bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        iconNode={<BrandMark size={26} />}
        title="Ask Aangan"
        showBack
        right={!empty ? (
          <Pressable onPress={newChat} hitSlop={8} className="flex-row items-center gap-1 rounded-full bg-inset px-3 py-1.5">
            <Ionicons name="add" size={15} color={c.muted} />
            <Text className="font-sans-sb text-[12px] text-muted">New</Text>
          </Pressable>
        ) : undefined}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollDown}
      >
        {empty ? (
          <View className="mt-2">
            <Text className="mb-3 text-[14px] leading-5 text-muted">
              Ask anything about your society in plain words — food, flats, things to borrow, recommendations, or your neighbours (members, professions, announcements). Follow-up questions work too.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <Pressable key={ex} onPress={() => send(ex)} className="rounded-full border border-line bg-surface px-3 py-1.5 active:opacity-70">
                  <Text className="text-[12px] font-sans-md text-muted">{ex}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((m, i) => (m.role === 'user' ? (
            <View key={i} className="mb-3 max-w-[85%] self-end rounded-2xl rounded-br-md px-3.5 py-2.5" style={{ backgroundColor: ACCENT }}>
              <Text className="text-[14px] leading-5 text-white">{m.text}</Text>
            </View>
          ) : (
            <View key={i} className="mb-4 max-w-[92%] self-start">
              <View className="flex-row items-end gap-2">
                <BrandMark size={24} />
                <View className="flex-1 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5">
                  <Text className="text-[14px] leading-5 text-ink">{m.text}</Text>
                </View>
              </View>
              {m.results && m.results.length > 0 ? (
                <View className="ml-8 mt-2 gap-2">
                  {m.results.map((item) => {
                    const meta = askSourceMeta(item.source);
                    return (
                      <Pressable
                        key={`${item.source}-${item.id}`}
                        onPress={() => router.push(askResultRoute(item) as any)}
                        className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3 active:opacity-75"
                      >
                        <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: meta.color + '20' }}>
                          <Ionicons name={meta.icon as any} size={17} color={meta.color} />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="font-sans-sb text-[13px] text-ink" numberOfLines={1}>{item.title}</Text>
                          <Text className="text-[11px] text-muted" numberOfLines={1}>
                            <Text style={{ color: meta.color }}>{meta.label}</Text>{item.reason ? ` · ${item.reason}` : ''}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={15} color={c.faint} />
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          )))
        )}

        {loading ? (
          <View className="mb-4 flex-row items-center gap-2 self-start">
            <BrandMark size={24} />
            <View className="rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3">
              <ActivityIndicator size="small" color={ACCENT} />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Composer */}
      <View style={{ paddingBottom: Platform.OS === 'ios' ? 8 : 12 }} className="border-t border-line bg-bg px-3 pt-2.5">
        <View className="flex-row items-end gap-2">
          <View className="min-w-0 flex-1 flex-row items-center gap-2 rounded-2xl border border-line bg-inset px-3.5">
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask Aangan anything…"
              placeholderTextColor={c.faint}
              returnKeyType="send"
              onSubmitEditing={() => send(input)}
              multiline
              className="min-w-0 flex-1 max-h-28 text-[15px] text-ink"
              style={{ paddingVertical: 11, outline: 'none', minWidth: 0 } as any}
            />
          </View>
          <Pressable
            onPress={() => send(input)}
            disabled={loading || !input.trim()}
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: input.trim() && !loading ? ACCENT : c.inset }}
          >
            <Ionicons name="arrow-up" size={20} color={input.trim() && !loading ? '#fff' : c.faint} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
