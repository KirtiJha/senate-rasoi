import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';

import { useAuth } from '../../context/auth';
import { useConfirm } from '../../context/confirm';
import { useToast } from '../../context/toast';
import { haptics } from '../../lib/haptics';
import { Watch, deleteWatch, fetchWatches, setAllWatchesActive, setWatchActive } from '../../lib/watches';
import { useThemeColors } from '../../theme';
import { Touchable } from '../ui';

/**
 * The watches Saathi is keeping, and the switches that stop them.
 *
 * Every watch is individually switchable rather than only deletable: someone
 * who has stopped house-hunting this month has not stopped house-hunting, and
 * making them delete the watch to get quiet means they lose it and have to
 * describe it again later.
 *
 * There is also one switch for all of them, because a resident who wants quiet
 * wants quiet — asking them to toggle six things is asking them to give up
 * halfway.
 *
 * The match terms are shown under each label. A watch whose rule you cannot
 * see is one you cannot reason about when it stays silent, and silence is
 * exactly how a watch fails.
 */
export function WatchList() {
  const c = useThemeColors();
  const toast = useToast();
  const confirm = useConfirm();
  const { userId } = useAuth();

  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try { setWatches(await fetchWatches(userId)); } catch { setWatches([]); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (w: Watch) => {
    haptics.select();
    // Optimistic: a switch that waits for the network reads as broken.
    setWatches((prev) => (prev ?? []).map((x) => (x.id === w.id ? { ...x, active: !x.active } : x)));
    try { await setWatchActive(w.id, !w.active); }
    catch { toast.show('Could not change that'); load(); }
  };

  const toggleAll = async (next: boolean) => {
    if (!userId || busy) return;
    haptics.select();
    setBusy(true);
    setWatches((prev) => (prev ?? []).map((x) => ({ ...x, active: next })));
    try { await setAllWatchesActive(userId, next); }
    catch { toast.show('Could not change those'); load(); }
    finally { setBusy(false); }
  };

  const remove = async (w: Watch) => {
    const ok = await confirm({
      title: 'Stop watching?',
      message: w.label,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setWatches((prev) => (prev ?? []).filter((x) => x.id !== w.id));
    try { await deleteWatch(w.id); } catch { toast.show('Could not delete that'); load(); }
  };

  if (watches === null) {
    return <View className="items-center py-6"><ActivityIndicator color={c.accent} /></View>;
  }

  if (watches.length === 0) {
    return (
      <View className="card px-4 py-5">
        <Text className="font-sans-md text-[13.5px] leading-[19px] text-subtle">
          Nothing yet. Ask Saathi to tell you when something appears — “let me know when a 2 BHK
          comes up” — and it will show here.
        </Text>
      </View>
    );
  }

  const anyOn = watches.some((w) => w.active);

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between px-1">
        <Text className="text-[12px] font-sans-md text-subtle">
          {watches.filter((w) => w.active).length} of {watches.length} on
        </Text>
        <Touchable haptic={null} onPress={() => toggleAll(!anyOn)} accessibilityRole="button"
          accessibilityLabel={anyOn ? 'Turn all watches off' : 'Turn all watches on'}>
          <View pointerEvents="none" className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.inset }}>
            <Text className="text-[12px] font-sans-sb" style={{ color: c.accent }}>
              {anyOn ? 'Turn all off' : 'Turn all on'}
            </Text>
          </View>
        </Touchable>
      </View>

      <View className="overflow-hidden card">
        {watches.map((w, i) => (
          <View key={w.id}>
            {i > 0 ? <View className="ml-4 h-px bg-line" /> : null}
            <View className="flex-row items-center gap-3 px-4 py-3">
              <View className="min-w-0 flex-1">
                <Text className="font-sans-md text-[14.5px] text-ink" numberOfLines={1}>{w.label}</Text>
                <Text className="mt-0.5 text-[11.5px] font-sans" style={{ color: c.subtle }} numberOfLines={1}>
                  {w.keywords.join(' + ')}
                  {w.last_fired_at ? ' · matched before' : ''}
                </Text>
              </View>

              <Switch
                value={w.active}
                onValueChange={() => toggle(w)}
                trackColor={{ false: c.line, true: c.accentSoft }}
                thumbColor={w.active ? c.accent : c.subtle}
              />

              <Touchable haptic={null} onPress={() => remove(w)} accessibilityRole="button"
                accessibilityLabel={`Delete watch ${w.label}`}>
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
