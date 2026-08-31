import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';

import { useAuth } from '../../context/auth';
import { useConfirm } from '../../context/confirm';
import { useToast } from '../../context/toast';
import { DishRow } from '../../lib/types';
import {
  DishTemplate,
  createDishTemplate,
  deleteDishTemplate,
  fetchDishTemplates,
  setDishTemplateActive,
} from '../../lib/dishes';
import { haptics } from '../../lib/haptics';
import { useThemeColors } from '../../theme';
import { Touchable } from '../ui';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * "Make this every week."
 *
 * THE POINT OF THE WHOLE FEATURE is that a chef never retypes a dish. So this
 * is attached to a dish they have already posted — pick the days, done — and
 * never a second form asking for the name, price and photo again. A recurring-
 * dish screen that costs as much as posting would be used once.
 *
 * The days are a row of seven letters rather than a list of checkboxes: the
 * shape of a week is the fastest thing to read, and "Tue and Fri" should take
 * one glance to confirm.
 */
export function RepeatDish({ dish, onDone }: { dish: DishRow; onDone?: () => void }) {
  const c = useThemeColors();
  const toast = useToast();
  const { userId, communityId } = useAuth();
  const [days, setDays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (d: number) => {
    haptics.select();
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const save = async () => {
    if (!days.length || busy || !userId || !communityId) return;
    setBusy(true);
    try {
      await createDishTemplate(dish, days, { userId, communityId });
      haptics.success();
      toast.show(`${dish.dish_name} will be posted every ${days.map((d) => DAY_NAMES[d]).join(' and ')}`);
      onDone?.();
    } catch {
      toast.show('Could not save that — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="card p-4">
      <View className="flex-row items-center gap-2">
        <Ionicons name="repeat" size={17} color={c.accent} />
        <Text className="font-sans-sb text-[14px] text-ink">Cook this every week?</Text>
      </View>
      <Text className="font-sans mt-1 text-[12.5px] leading-[18px]" style={{ color: c.subtle }}>
        We will post it for you the night before, so you never have to type it again.
        You can change or stop it any time.
      </Text>

      <View className="mt-3 flex-row gap-1.5">
        {DAYS.map((letter, d) => {
          const on = days.includes(d);
          return (
            <View key={d} style={{ flex: 1 }}>
              <Touchable
                haptic={null}
                onPress={() => toggle(d)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={DAY_NAMES[d]}
              >
                <View
                  pointerEvents="none"
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 9,
                    borderRadius: 12,
                    backgroundColor: on ? c.accent : c.inset,
                  }}
                >
                  <Text className="font-sans-sb text-[13px]" style={{ color: on ? c.onAccent : c.muted }}>
                    {letter}
                  </Text>
                </View>
              </Touchable>
            </View>
          );
        })}
      </View>

      <View className="mt-3">
        <Touchable onPress={save} disabled={!days.length || busy} accessibilityRole="button" accessibilityLabel="Save repeat">
          <View
            pointerEvents="none"
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              paddingVertical: 11,
              backgroundColor: days.length ? c.accent : c.inset,
            }}
          >
            <Text className="font-sans-sb text-[13.5px]" style={{ color: days.length ? c.onAccent : c.muted }}>
              {busy ? 'Saving…' : days.length ? 'Repeat on these days' : 'Pick a day'}
            </Text>
          </View>
        </Touchable>
      </View>
    </View>
  );
}

/**
 * The standing dishes a chef has, and the switches that stop them.
 *
 * Switchable rather than only deletable: a cook who is travelling for a
 * fortnight has not stopped making idli, and forcing a delete means they lose
 * the setup and have to rebuild it when they return.
 */
export function RepeatList() {
  const c = useThemeColors();
  const toast = useToast();
  const confirm = useConfirm();
  const { userId } = useAuth();
  const [items, setItems] = useState<DishTemplate[] | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try { setItems(await fetchDishTemplates(userId)); } catch { setItems([]); }
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (t: DishTemplate) => {
    haptics.select();
    setItems((prev) => (prev ?? []).map((x) => (x.id === t.id ? { ...x, active: !x.active } : x)));
    try { await setDishTemplateActive(t.id, !t.active); }
    catch { toast.show('Could not change that'); load(); }
  };

  const remove = async (t: DishTemplate) => {
    const ok = await confirm({
      title: 'Stop repeating?',
      message: `${t.dish_name} will no longer be posted automatically. Dishes already up stay up.`,
      confirmLabel: 'Stop',
      destructive: true,
    });
    if (!ok) return;
    setItems((prev) => (prev ?? []).filter((x) => x.id !== t.id));
    try { await deleteDishTemplate(t.id); } catch { toast.show('Could not stop that'); load(); }
  };

  if (items === null) return <View className="items-center py-5"><ActivityIndicator color={c.accent} /></View>;
  if (items.length === 0) return null;

  return (
    <View className="mb-4">
      <Text className="mb-2 ml-1 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
        Posted automatically
      </Text>
      <View className="overflow-hidden card">
        {items.map((t, i) => (
          <View key={t.id}>
            {i > 0 ? <View className="ml-4 h-px bg-line" /> : null}
            <View className="flex-row items-center gap-3 px-4 py-3">
              <View className="min-w-0 flex-1">
                <Text className="font-sans-md text-[14.5px] text-ink" numberOfLines={1}>{t.dish_name}</Text>
                <Text className="mt-0.5 text-[11.5px] font-sans" style={{ color: c.subtle }} numberOfLines={1}>
                  {t.slot} · {t.days_of_week.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ')} · ₹{t.price}
                </Text>
              </View>
              <Switch
                value={t.active}
                onValueChange={() => toggle(t)}
                trackColor={{ false: c.line, true: c.accentSoft }}
                thumbColor={t.active ? c.accent : c.subtle}
              />
              <Touchable haptic={null} onPress={() => remove(t)} accessibilityRole="button"
                accessibilityLabel={`Stop repeating ${t.dish_name}`}>
                <View pointerEvents="none" className="h-8 w-8 items-center justify-center rounded-full">
                  <Ionicons name="trash-outline" size={15} color={c.subtle} />
                </View>
              </Touchable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
