import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { SaathiMark } from '../components/SaathiMark';
import { KeyboardAvoider, ScreenHeader } from '../components/ui';
import { useToast } from '../context/toast';
import { ProposalCard, StepsTrail } from '../components/saathi/ProposalCard';
import { RichText } from '../components/saathi/RichText';
import { useAuth } from '../context/auth';
import { AIError, askResultRoute, askSourceMeta } from '../lib/ai';
import { askAgent } from '../lib/agent';
import { streamAgent } from '../lib/agentStream';
import { AskMessage, clearAskConversation, getAskConversation, setAskConversation } from '../lib/askStore';
import { appendMessage, createSession, fetchMessages } from '../lib/askSessions';
import { HistorySheet } from '../components/saathi/HistorySheet';
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
  const [historyOpen, setHistoryOpen] = useState(false);
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

    // An empty assistant turn goes in immediately and fills as the stream
    // arrives. Waiting until the first token means the screen sits unchanged
    // after you press send, which reads as the tap not registering.
    persist([...withUser, { role: 'assistant', text: '', steps: [] }]);
    setInput('');
    setLoading(true);
    scrollDown();

    if (!sessionId.current && userId && communityId) {
      createSession(userId, communityId)
        .then((id) => { sessionId.current = id; remember(userMsg); })
        .catch(() => {});
    } else {
      remember(userMsg);
    }

    // Mutated in place by the stream handlers and copied into state on each
    // event — cheaper than rebuilding the whole thread per token.
    let text = '';
    const steps: { tool: string; summary: string }[] = [];
    const paint = () => setMessages([...withUser, { role: 'assistant', text, steps: [...steps] }]);

    try {
      const r = await streamAgent(q, history, {
        onDelta: (chunk) => { text += chunk; paint(); },
        onStep: (step) => { steps.push(step); paint(); scrollDown(); },
      });

      const reply: AskMessage = {
        role: 'assistant',
        text: r.answer || "I couldn't find anything on that.",
        results: r.results,
        steps: r.steps.length ? r.steps : steps,
        proposal: r.proposal,
      };
      persist([...withUser, reply]);
      remember(reply);
      haptics.success();
    } catch (e) {
      const why = (e instanceof AIError ? e.message : '').trim();
      // Keep whatever streamed before the failure: half an answer is worth
      // more than an error that erases it.
      persist([...withUser, {
        role: 'assistant',
        text: text || why || 'Saathi is unavailable right now.',
        steps,
      }]);
    } finally {
      setLoading(false);
      scrollDown();
    }
  };

  const openSession = async (id: string) => {
    setHistoryOpen(false);
    setLoading(true);
    try {
      const past = await fetchMessages(id);
      sessionId.current = id;
      persist(past);
      scrollDown();
    } catch {
      toast.show('Could not open that chat');
    } finally {
      setLoading(false);
    }
  };

  const newChat = () => { clearAskConversation(); setMessages([]); setInput(''); sessionId.current = null; };

  const empty = messages.length === 0;

  return (
    <KeyboardAvoider style={{ overflow: 'hidden', backgroundColor: c.bg }}>
      <ScreenHeader
        iconNode={<SaathiMark size={26} />}
        title="Saathi"
        showBack
        right={
          <View className="flex-row items-center gap-1.5">
            <Pressable
              onPress={() => setHistoryOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Your chats"
              className="h-8 w-8 items-center justify-center rounded-full bg-inset"
            >
              <Ionicons name="time-outline" size={16} color={c.muted} />
            </Pressable>
            {!empty ? (
              <Pressable onPress={newChat} hitSlop={8} className="flex-row items-center gap-1 rounded-full bg-inset px-3 py-1.5">
                <Ionicons name="add" size={15} color={c.muted} />
                <Text className="font-sans-sb text-[12px] text-muted">New</Text>
              </Pressable>
            ) : null}
          </View>
        }
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
                <SaathiMark size={24} />
                <View className="flex-shrink rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5">
                  {m.text ? (
                    <RichText text={m.text} />
                  ) : (
                    // An empty bubble with a separate spinner underneath it read
                    // as two things loading. The bubble is the spinner until the
                    // first token lands, then becomes the answer in place.
                    <ActivityIndicator size="small" color={ACCENT} />
                  )}
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
              {/* While the turn is still running the newest step shows in
                  full: "searched \"plumber\" — 3 matches" is the difference
                  between watching it work and watching a spinner. Once it is
                  done the steps collapse into the trail, because by then the
                  answer is what matters and the method is only interesting if
                  you doubt it. */}
              {loading && i === messages.length - 1 && m.steps?.length ? (
                <View className="ml-8 mt-1.5 flex-row items-center gap-1.5">
                  <ActivityIndicator size="small" color={c.subtle} />
                  <Text className="flex-1 text-[11.5px] font-sans-md" style={{ color: c.subtle }} numberOfLines={1}>
                    {m.steps[m.steps.length - 1].summary}
                  </Text>
                </View>
              ) : m.steps?.length ? (
                <StepsTrail steps={m.steps} />
              ) : null}
              {m.proposal ? (
                <View className="ml-8">
                  <ProposalCard proposal={m.proposal} onDone={() => {}} />
                </View>
              ) : null}
            </View>
          )))
        )}

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
      <HistorySheet
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onOpen={openSession}
        currentId={sessionId.current}
      />
    </KeyboardAvoider>
  );
}
