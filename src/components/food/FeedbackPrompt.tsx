import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useToast } from '../../context/toast';
import { PendingFeedback, fetchPendingFeedback, leaveDishFeedback } from '../../lib/dishes';
import { haptics } from '../../lib/haptics';
import { useThemeColors } from '../../theme';
import { Touchable } from '../ui';

/**
 * "Would you order again?"
 *
 * WHY NOT STARS
 * A score out of five for a restaurant is a judgement. The same score for the
 * neighbour you will meet in the lift tomorrow is a social act, and people
 * handle it by rating everyone four — or by not rating at all. A board of
 * polite fours tells nobody anything.
 *
 * Yes or no is answerable honestly by somebody who still has to be pleasant on
 * Tuesday, and it still aggregates into a number worth reading.
 *
 * The note is private to the chef. Public praise, private correction: the one
 * arrangement where an honest "the dal was very salty" gets written at all.
 *
 * Shown at the top of Orders rather than as a popup. A modal that ambushes you
 * on open gets dismissed reflexively, and a dismissed prompt never comes back.
 */
export function FeedbackPrompt() {
  const c = useThemeColors();
  const toast = useToast();

  const [pending, setPending] = useState<PendingFeedback[]>([]);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setPending(await fetchPendingFeedback()); } catch { setPending([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const item = pending[0];
  if (!item) return null;

  const submit = async (repeat: boolean) => {
    if (busy) return;
    setBusy(true);
    haptics.select();
    try {
      await leaveDishFeedback(item.order_id, repeat, note);
      haptics.success();
      // Straight to the next one, if there is one. Asking about three meals in
      // a row is worse than asking about one, so the queue is capped at five
      // server-side and most people will see zero or one.
      setPending((prev) => prev.slice(1));
      setAnswer(null);
      setNote('');
    } catch {
      toast.show('Could not save that — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      className="mb-4 overflow-hidden rounded-2xl"
      style={{ borderWidth: 1, borderColor: c.accentLine, backgroundColor: c.surface }}
    >
      <View className="px-4 pt-3.5">
        <Text className="text-[11px] font-sans-sb uppercase" style={{ color: c.accent, letterSpacing: 1 }}>
          How was it?
        </Text>
        <Text className="mt-1 font-sans-sb text-[15px] text-ink">
          {item.dish_name}
        </Text>
        <Text className="font-sans text-[12.5px]" style={{ color: c.subtle }}>
          from {item.chef_name}
        </Text>
      </View>

      {answer === null ? (
        <View className="flex-row gap-2 px-4 py-3.5">
          <View style={{ flex: 1 }}>
            <Touchable onPress={() => { haptics.select(); setAnswer(true); }} haptic={null}
              accessibilityRole="button" accessibilityLabel="Yes, I would order again">
              <View pointerEvents="none" className="flex-row items-center justify-center gap-2 rounded-xl py-2.5"
                style={{ backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accentLine }}>
                <Ionicons name="thumbs-up-outline" size={16} color={c.accent} />
                <Text className="font-sans-sb text-[13.5px]" style={{ color: c.accent }}>Would order again</Text>
              </View>
            </Touchable>
          </View>
          <View style={{ flex: 1 }}>
            <Touchable onPress={() => { haptics.select(); setAnswer(false); }} haptic={null}
              accessibilityRole="button" accessibilityLabel="No, I would not order again">
              <View pointerEvents="none" className="items-center justify-center rounded-xl py-2.5"
                style={{ backgroundColor: c.inset }}>
                <Text className="font-sans-sb text-[13.5px]" style={{ color: c.muted }}>Not this time</Text>
              </View>
            </Touchable>
          </View>
        </View>
      ) : (
        <View className="px-4 py-3.5">
          <Text className="font-sans mb-2 text-[12.5px] leading-[18px]" style={{ color: c.subtle }}>
            {answer
              ? 'Anything you want to tell them? Only they will see it.'
              : 'What would you tell them? Only they will see it — nothing is posted publicly.'}
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={answer ? 'Optional' : 'Optional, and kept private'}
            placeholderTextColor={c.faint}
            multiline
            maxLength={500}
            className="rounded-xl px-3 py-2.5 text-[14px] text-ink"
            style={{ backgroundColor: c.inset, minHeight: 64, outline: 'none' } as never}
          />
          <View className="mt-2.5 flex-row gap-2">
            <View style={{ flex: 1 }}>
              <Touchable onPress={() => submit(answer)} disabled={busy} accessibilityRole="button" accessibilityLabel="Send">
                <View pointerEvents="none" className="items-center justify-center rounded-xl py-2.5"
                  style={{ backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }}>
                  <Text className="font-sans-sb text-[13.5px]" style={{ color: c.onAccent }}>
                    {busy ? 'Sending…' : note.trim() ? 'Send' : 'Skip the note'}
                  </Text>
                </View>
              </Touchable>
            </View>
            <Touchable onPress={() => { setAnswer(null); setNote(''); }} disabled={busy}
              accessibilityRole="button" accessibilityLabel="Back">
              <View pointerEvents="none" className="items-center justify-center rounded-xl px-4 py-2.5"
                style={{ backgroundColor: c.inset }}>
                <Text className="font-sans-sb text-[13.5px]" style={{ color: c.muted }}>Back</Text>
              </View>
            </Touchable>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * A kitchen's standing, on a dish card.
 *
 * Says "new kitchen" rather than a percentage until five people have answered.
 * A number computed from one response looks precise and is not, and the first
 * unlucky night should not follow a cook around.
 */
export function ChefStanding({
  total,
  repeatCount,
  enough,
  compact,
}: {
  total: number;
  repeatCount: number;
  enough: boolean;
  compact?: boolean;
}) {
  const c = useThemeColors();

  if (!enough) {
    return (
      <Text className="font-sans" style={{ fontSize: compact ? 11 : 12, color: c.subtle }}>
        New kitchen
      </Text>
    );
  }

  const pct = Math.round((repeatCount / Math.max(total, 1)) * 100);
  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name="thumbs-up" size={compact ? 11 : 12} color={c.accent} />
      <Text className="font-sans-sb" style={{ fontSize: compact ? 11 : 12, color: c.accent }}>
        {pct}%
      </Text>
      <Text className="font-sans" style={{ fontSize: compact ? 11 : 12, color: c.subtle }}>
        would order again · {total}
      </Text>
    </View>
  );
}
