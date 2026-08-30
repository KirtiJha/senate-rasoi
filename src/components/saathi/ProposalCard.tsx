import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { AgentProposal, describeProposal, executeProposal } from '../../lib/agent';
import { haptics } from '../../lib/haptics';
import { useThemeColors } from '../../theme';
import { Touchable } from '../ui';

/**
 * The moment a suggestion becomes an action.
 *
 * WHY THIS SCREEN EXISTS AT ALL
 * Saathi never writes anything itself. The edge function has no write path —
 * it returns a *proposal*, and this card is where a human decides. That is not
 * politeness, it is the security boundary: resident-written posts and comments
 * reach the model's context, so an instruction hidden in a comment could in
 * principle steer it. Everything such an instruction can achieve ends here, in
 * front of someone who can say no.
 *
 * So the card shows the actual field values that will be written — not a
 * paraphrase. A confirmation that summarises is a confirmation that can lie
 * about what you agreed to.
 */
export function ProposalCard({
  proposal,
  onDone,
}: {
  proposal: AgentProposal;
  /** Called once the action is committed or dismissed, so the thread can settle. */
  onDone: (outcome: 'done' | 'dismissed') => void;
}) {
  const c = useThemeColors();
  const router = useRouter();
  const toast = useToast();
  const { userId, communityId } = useAuth();
  const [busy, setBusy] = useState(false);
  const [settled, setSettled] = useState<'done' | 'dismissed' | null>(null);

  const meta = describeProposal(proposal);

  const confirm = async () => {
    if (busy || settled || !userId || !communityId) return;
    setBusy(true);
    try {
      const { route } = await executeProposal(proposal, { userId, communityId });
      haptics.success();
      setSettled('done');
      onDone('done');
      // Land on the thing that was just made. Saying "posted!" and leaving
      // someone in the chat makes them go and check whether it really was.
      router.push(route as never);
    } catch {
      toast.show('Could not do that — try again');
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    haptics.select();
    setSettled('dismissed');
    onDone('dismissed');
  };

  if (settled) {
    return (
      <View
        className="mt-2 flex-row items-center gap-2 rounded-2xl px-3.5 py-2.5"
        style={{ backgroundColor: c.inset }}
      >
        <Ionicons
          name={settled === 'done' ? 'checkmark-circle' : 'close-circle-outline'}
          size={16}
          color={settled === 'done' ? c.accent : c.muted}
        />
        <Text className="font-sans-md text-[13px]" style={{ color: c.muted }}>
          {settled === 'done' ? 'Done' : 'Not posted'}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="mt-2 overflow-hidden rounded-2xl"
      style={{ borderWidth: 1, borderColor: c.accentLine, backgroundColor: c.surface }}
    >
      <View
        className="flex-row items-center gap-2 px-3.5 py-2.5"
        style={{ backgroundColor: c.accentSoft }}
      >
        <Ionicons name={meta.icon as never} size={16} color={c.accent} />
        <Text className="font-sans-sb text-[13px]" style={{ color: c.accent }}>{meta.title}</Text>
      </View>

      <View className="gap-2 px-3.5 py-3">
        {meta.lines.map(([label, value]) => (
          <View key={label}>
            <Text className="text-[10.5px] font-sans-sb uppercase" style={{ color: c.subtle, letterSpacing: 1 }}>
              {label}
            </Text>
            <Text className="mt-0.5 font-sans text-[13.5px] leading-[19px] text-ink">{value}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row gap-2 px-3.5 pb-3.5">
        <View style={{ flex: 1 }}>
          <Touchable onPress={confirm} disabled={busy} accessibilityRole="button" accessibilityLabel={meta.verb}>
            <View
              pointerEvents="none"
              style={{
                alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 11,
                backgroundColor: c.accent, opacity: busy ? 0.6 : 1,
              }}
            >
              <Text className="font-sans-sb text-[14px]" style={{ color: c.onAccent }}>
                {busy ? 'Working…' : meta.verb}
              </Text>
            </View>
          </Touchable>
        </View>
        <View style={{ flex: 1 }}>
          <Touchable onPress={dismiss} disabled={busy} accessibilityRole="button" accessibilityLabel="Not now">
            <View
              pointerEvents="none"
              style={{
                alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 11,
                backgroundColor: c.inset,
              }}
            >
              <Text className="font-sans-sb text-[14px]" style={{ color: c.muted }}>Not now</Text>
            </View>
          </Touchable>
        </View>
      </View>
    </View>
  );
}

/**
 * What Saathi actually did before answering.
 *
 * An agent that silently takes eight seconds reads as broken; the same eight
 * seconds with "searched flats · counted 3" reads as thorough. It also makes
 * the answer checkable — you can see it looked, and where.
 *
 * Collapsed by default: interesting when you doubt the answer, noise when you
 * do not.
 */
export function StepsTrail({ steps }: { steps: { tool: string; summary: string }[] }) {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;

  return (
    <View className="ml-8 mt-1.5">
      <Touchable
        onPress={() => { haptics.select(); setOpen((v) => !v); }}
        haptic={null}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`How Saathi checked, ${steps.length} step${steps.length === 1 ? '' : 's'}`}
      >
        <View pointerEvents="none" className="flex-row items-center gap-1 self-start">
          <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={12} color={c.subtle} />
          <Text className="text-[11.5px] font-sans-md" style={{ color: c.subtle }}>
            {open ? 'How I checked' : `Checked ${steps.length} thing${steps.length === 1 ? '' : 's'}`}
          </Text>
        </View>
      </Touchable>

      {open ? (
        <View className="mt-1.5 gap-1 rounded-xl px-3 py-2" style={{ backgroundColor: c.inset }}>
          {steps.map((s, i) => (
            <View key={i} className="flex-row items-start gap-2">
              <Text className="text-[11px] font-sans-sb" style={{ color: c.accent, marginTop: 1 }}>{i + 1}</Text>
              <Text className="flex-1 text-[11.5px] font-sans leading-[16px]" style={{ color: c.muted }}>
                {s.summary}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
