import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BrandMark } from '../components/BrandMark';
import { KeyboardAvoider, ScreenHeader } from '../components/ui';
import { useToast } from '../context/toast';
import { ProposalCard, StepsTrail } from '../components/saathi/ProposalCard';
import { RichText } from '../components/saathi/RichText';
import { useAuth } from '../context/auth';
import { AIError, askResultRoute, askSourceMeta } from '../lib/ai';
import { askAgent } from '../lib/agent';
import { AskMessage, clearAskConversation, getAskConversation, setAskConversation } from '../lib/askStore';
import { appendMessage, createSession } from '../lib/askSessions';
import { haptics } from '../lib/haptics';
import { useThemeColors } from '../theme';


const EXAMPLES = [
  'Veg tiffin for lunch',
  'Any 2 BHK for rent?',
  'Where can I borrow a drill?',
  'How many members are in the society?',
  'Is there a doctor in the society?',
];

export default function AskScreen() {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const toast = useToast();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  // Seed from the in-memory store so the thread survives navigation.
  const [messages, setMessages] = useState<AskMessage[]>(() => getAskConversation());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { userId, communityId } = useAuth();

  // The conversation's row on the server. Created lazily on the first message,
  // so opening Saathi and changing your mind does not litter the history with
  // empty chats.
  const sessionId = useRef<string | null>(null);

  /**
   * Persistence is deliberately best-effort and never awaited by the reply
   * path. Saathi answering is the point; a chat that failed to save is a
   * smaller problem than an answer withheld because saving failed.
   */
  const remember = (m: AskMessage) => {
    const id = sessionId.current;
    if (!id) return;
    appendMessage(id, m).catch(() => {});
  };

  const persist = (next: AskMessage[]) => { setMessages(next); setAskConversation(next); };

  const scrollDown = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

  const send = async (raw: string) => {
    const q = raw.trim();
    if (!q || loading) return;
    haptics.tap();

    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    const userMsg: AskMessage = { role: 'user', text: q };
    const withUser: AskMessage[] = [...messages, userMsg];
    persist(withUser);
    setInput('');
    setLoading(true);
    scrollDown();

    // Open a session on the first message of a new chat.
    if (!sessionId.current && userId && communityId) {
      createSession(userId, communityId)
        .then((id) => { sessionId.current = id; remember(userMsg); })
        .catch(() => {});
    } else {
      remember(userMsg);
    }

    try {
      const r = await askAgent(q, history);
      // Trim before the fallback: a whitespace-only answer is truthy and
      // would render as an empty bubble.
      const answer = r.answer?.trim();
      const reply: AskMessage = {
        role: 'assistant',
        text: answer || "I couldn't find anything on that.",
        results: r.results,
        steps: r.steps,
        proposal: r.proposal,
      };
      persist([...withUser, reply]);
      remember(reply);
      haptics.success();
    } catch (e) {
      const why = (e instanceof AIError ? e.message : '').trim();
      persist([...withUser, { role: 'assistant', text: why || 'Saathi is unavailable right now.' }]);
    } finally {
      setLoading(false);
      scrollDown();
    }
  };

  const newChat = () => { clearAskConversation(); setMessages([]); setInput(''); sessionId.current = null; };

  const empty = messages.length === 0;

  return (
    <KeyboardAvoider style={{ overflow: 'hidden', backgroundColor: c.bg }}>
      <ScreenHeader
        iconNode={<BrandMark size={26} />}
        title="Saathi"
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
        // Fills the space between header and composer. Without this the
        // scroller sizes to its content, so a short thread pulls the composer
        // up into the middle of the screen.
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollDown}
      >
        {empty ? (
          <View className="mt-2">
            <Text className="font-sans mb-3 text-[14px] leading-5 text-muted">
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
              <Text className="font-sans text-[14px] leading-5 text-white">{m.text}</Text>
            </View>
          ) : (
            // A definite width, not `self-start`. Sized to content, Yoga
            // measures a `flex-1` child as flex-basis 0 — it contributes
            // nothing, then has nothing to grow into — so the bubble and the
            // result cards below collapsed to their padding on native. CSS
            // sizes the same tree from the text, which is why web looked fine.
            <View key={i} className="mb-4 w-[92%]">
              <View className="flex-row items-end gap-2">
                <BrandMark size={24} />
                <View className="flex-shrink rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5">
                  <RichText text={m.text} />
                </View>
              </View>
              {m.results && m.results.length > 0 ? (
                <View className="ml-8 mt-2 gap-2">
                  {m.results.map((item) => {
                    const meta = askSourceMeta(item.source);
                    return (
                      <Pressable accessibilityRole="button" accessibilityLabel="Open"
                        key={`${item.source}-${item.id}`}
                        onPress={() => router.push(askResultRoute(item) as any)}
                        className="flex-row items-center gap-3 card p-3 active:opacity-75"
                      >
                        <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: c.accentSoft }}>
                          <Ionicons name={meta.icon as any} size={17} color={c.accent} />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="font-sans-sb text-[13px] text-ink" numberOfLines={1}>{item.title}</Text>
                          <Text className="font-sans text-[11px] text-muted" numberOfLines={1}>
                            <Text style={{ color: c.accent }}>{meta.label}</Text>{item.reason ? ` · ${item.reason}` : ''}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={15} color={c.faint} />
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {m.steps?.length ? <StepsTrail steps={m.steps} /> : null}
              {m.proposal ? (
                <View className="ml-8">
                  <ProposalCard proposal={m.proposal} onDone={() => {}} />
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
              placeholder="Ask Saathi anything…"
              placeholderTextColor={c.faint}
              returnKeyType="send"
              onSubmitEditing={() => send(input)}
              onKeyPress={(e: any) => {
                // Web: multiline renders a <textarea>, so onSubmitEditing never
                // fires — submit on Enter (Shift+Enter keeps the newline).
                if (Platform.OS === 'web' && e?.nativeEvent?.key === 'Enter' && !e.nativeEvent.shiftKey) {
                  e.preventDefault?.();
                  send(input);
                }
              }}
              multiline
              className="min-w-0 flex-1 max-h-28 text-[15px] text-ink"
              style={{ paddingVertical: 11, outline: 'none', minWidth: 0 } as any}
            />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Send question"
            onPress={() => send(input)}
            disabled={loading || !input.trim()}
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: input.trim() && !loading ? ACCENT : c.inset }}
          >
            <Ionicons name="arrow-up" size={20} color={input.trim() && !loading ? '#fff' : c.faint} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoider>
  );
}
