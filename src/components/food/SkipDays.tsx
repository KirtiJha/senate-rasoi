import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useToast } from '../../context/toast';
import { haptics } from '../../lib/haptics';
import { fetchSkips, setSkip } from '../../lib/tiffin';
import { useThemeColors } from '../../theme';
import { Sheet, Touchable } from '../ui';

/**
 * "I'm away on Thursday."
 *
 * `subscription_skips` has existed since 0007 — per-subscriber RLS, and the
 * chef's daily roster already excludes skipped dates — and nothing in the app
 * ever touched it. So a subscriber going away for two days had to pause the
 * entire subscription and remember to resume it, or accept food they were not
 * there to eat. Both outcomes cost the chef a plate they had already cooked.
 *
 * Only the days this plan actually serves are offered, because skipping a
 * Sunday on a weekdays-only tiffin means nothing, and a calendar full of
 * unusable dates is how people mis-tap.
 *
 * Two weeks ahead: far enough for a trip, short enough that the list stays
 * scannable without a month view.
 */
const HORIZON_DAYS = 14;

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function SkipDays({
  visible,
  subscriptionId,
  daysOfWeek,
  planTitle,
  onClose,
}: {
  visible: boolean;
  subscriptionId: string | null;
  /** 0 = Sunday, matching tiffin_plans.days_of_week. */
  daysOfWeek: number[];
  planTitle: string;
  onClose: () => void;
}) {
  const c = useThemeColors();
  const toast = useToast();

  const [skips, setSkips] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!subscriptionId) return;
    try {
      setSkips(new Set(await fetchSkips(subscriptionId)));
    } catch {
      setSkips(new Set());
    }
  }, [subscriptionId]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  // Tomorrow onward: today's tiffin is already being cooked.
  const days: Date[] = [];
  for (let i = 1; i <= HORIZON_DAYS; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    if (daysOfWeek.includes(d.getDay())) days.push(d);
  }

  const toggle = async (d: Date) => {
    if (!subscriptionId) return;
    const key = iso(d);
    const on = skips?.has(key) ?? false;
    setBusy(key);
    haptics.select();
    try {
      await setSkip(subscriptionId, key, !on);
      setSkips((prev) => {
        const next = new Set(prev ?? []);
        if (on) next.delete(key); else next.add(key);
        return next;
      });
    } catch {
      toast.show('Could not save that');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Days to skip">
      <Text className="font-sans mb-3 text-[13px] leading-[19px]" style={{ color: c.subtle }}>
        Away for a day or two? Skip just those days of {planTitle} — your subscription
        keeps running, and the cook is not left with a plate nobody collects.
      </Text>

      {skips === null ? (
        <View className="items-center py-8"><ActivityIndicator color={c.accent} /></View>
      ) : days.length === 0 ? (
        <Text className="font-sans py-6 text-center text-[13px]" style={{ color: c.faint }}>
          Nothing served in the next fortnight.
        </Text>
      ) : (
        <View className="gap-1.5">
          {days.map((d) => {
            const key = iso(d);
            const off = skips.has(key);
            const label = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
            return (
              <Touchable key={key} onPress={() => toggle(d)} disabled={busy === key}
                accessibilityRole="button"
                accessibilityState={{ selected: off }}
                accessibilityLabel={`${off ? 'Take' : 'Skip'} ${label}`}>
                <View pointerEvents="none"
                  className="flex-row items-center gap-2.5 rounded-xl px-3.5 py-3"
                  style={{
                    backgroundColor: off ? c.inset : c.surface,
                    borderWidth: 1,
                    borderColor: off ? c.line : c.accentLine,
                    opacity: busy === key ? 0.5 : 1,
                  }}>
                  <Ionicons
                    name={off ? 'close-circle' : 'checkmark-circle-outline'}
                    size={18}
                    color={off ? c.muted : c.accent}
                  />
                  <Text className="flex-1 font-sans-sb text-[14px]"
                    style={{ color: off ? c.muted : c.ink, textDecorationLine: off ? 'line-through' : 'none' }}>
                    {label}
                  </Text>
                  <Text className="font-sans text-[12px]" style={{ color: off ? c.muted : c.accent }}>
                    {off ? 'Skipping' : 'Taking'}
                  </Text>
                </View>
              </Touchable>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}
