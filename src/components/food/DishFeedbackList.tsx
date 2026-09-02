import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Avatar } from '../ui';
import { DishFeedback, fetchDishFeedback } from '../../lib/dishes';
import { timeAgo } from '../../lib/time';
import { useThemeColors } from '../../theme';

/**
 * What neighbours said about a dish.
 *
 * Public to the society and attributed, which is the whole point: someone
 * deciding whether to order should see what the flat upstairs thought, the
 * same way they would ask in the lift. The chef sees this too — it is the
 * same list, not a separate private one.
 *
 * Renders nothing until there is something to show. An empty "no reviews yet"
 * block on a brand-new dish reads as a warning rather than an absence.
 */
export function DishFeedbackList({ dishId }: { dishId: string }) {
  const c = useThemeColors();
  const [rows, setRows] = useState<DishFeedback[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await fetchDishFeedback(dishId)); }
    catch { /* a missing review list must not take the dish page down */ }
    finally { setLoaded(true); }
  }, [dishId]);

  useEffect(() => { load(); }, [load]);

  if (!loaded || rows.length === 0) return null;

  const repeats = rows.filter((r) => r.would_repeat).length;

  return (
    <View className="mt-6">
      <View className="mb-2 flex-row items-center justify-between px-1">
        <Text className="text-[11px] font-sans-sb uppercase tracking-wider text-muted">
          What neighbours said
        </Text>
        <Text className="font-sans text-[12px] text-muted">
          {repeats} of {rows.length} would order again
        </Text>
      </View>

      <View className="gap-2">
        {rows.map((r) => (
          <View key={r.order_id} className="card p-3.5">
            <View className="flex-row items-center gap-2.5">
              <Avatar name={r.rater_name ?? '?'} size={30} />
              <View className="min-w-0 flex-1">
                <Text className="font-sans-sb text-[13px] text-ink" numberOfLines={1}>
                  {r.rater_name ?? 'A neighbour'}
                  {r.rater_flat ? <Text className="font-sans text-[12px] text-muted">{`  ·  ${r.rater_flat}`}</Text> : null}
                </Text>
                <Text className="font-sans text-[11px] text-faint">{timeAgo(r.created_at)}</Text>
              </View>
              <View
                className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
                style={{ backgroundColor: (r.would_repeat ? c.accent : c.muted) + '1A' }}
              >
                <Ionicons
                  name={r.would_repeat ? 'heart' : 'remove-circle-outline'}
                  size={12}
                  color={r.would_repeat ? c.accent : c.muted}
                />
                <Text
                  className="text-[11px] font-sans-sb"
                  style={{ color: r.would_repeat ? c.accent : c.muted }}
                >
                  {r.would_repeat ? 'Would order again' : 'Maybe not'}
                </Text>
              </View>
            </View>

            {r.note ? (
              <Text className="font-sans mt-2 text-[13px] leading-[19px] text-ink">{r.note}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
