import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '../ui';
import { ChefFeedback, fetchChefFeedback } from '../../lib/dishes';
import { timeAgo } from '../../lib/time';
import { useThemeColors } from '../../theme';

/**
 * Everything neighbours have said about this cook, across every dish.
 *
 * `chef_feedback` and its client wrapper were written and then never called,
 * so the only way a cook could read a review was to open the individual dish
 * — and dishes dropped off the Kitchen tab the night they were served. People
 * were leaving notes into a void.
 *
 * The same rows are public on each dish page; this is a convenience, not a
 * private channel. Renders nothing until somebody has said something.
 */
export function ChefFeedbackList() {
  const c = useThemeColors();
  const router = useRouter();
  const [rows, setRows] = useState<ChefFeedback[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [all, setAll] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await fetchChefFeedback()); }
    catch { /* the kitchen must still work without it */ }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!loaded || rows.length === 0) return null;

  const repeats = rows.filter((r) => r.would_repeat).length;
  const shown = all ? rows : rows.slice(0, 3);

  return (
    <View className="mb-4 mt-2">
      <View className="mb-2 flex-row items-center justify-between px-1">
        <Text className="text-[11px] font-sans-sb uppercase tracking-wider text-muted">
          What people said about your cooking
        </Text>
        <Text className="font-sans text-[12px] text-muted">
          {repeats} of {rows.length} would order again
        </Text>
      </View>

      <View className="gap-2">
        {shown.map((r) => (
          <Pressable
            key={`${r.dish_id}:${r.order_id}`}
            onPress={() => router.push(`/dish/${r.dish_id}` as never)}
            className="card p-3.5 active:opacity-80"
          >
            <View className="flex-row items-center gap-2.5">
              <Avatar name={r.rater_name ?? '?'} size={28} />
              <View className="min-w-0 flex-1">
                <Text className="font-sans-sb text-[13px] text-ink" numberOfLines={1}>
                  {r.rater_name ?? 'A neighbour'}
                  <Text className="font-sans text-[12px] text-muted">{`  ·  ${r.dish_name}`}</Text>
                </Text>
                <Text className="font-sans text-[11px] text-faint">{timeAgo(r.created_at)}</Text>
              </View>
              <Ionicons
                name={r.would_repeat ? 'heart' : 'remove-circle-outline'}
                size={15}
                color={r.would_repeat ? c.accent : c.muted}
              />
            </View>
            {r.note ? (
              <Text className="font-sans mt-2 text-[13px] leading-[19px] text-ink">{r.note}</Text>
            ) : null}
          </Pressable>
        ))}
      </View>

      {rows.length > 3 ? (
        <Pressable onPress={() => setAll((v) => !v)} className="mt-2 self-center py-1.5 active:opacity-70">
          <Text className="text-[12px] font-sans-sb text-accent">
            {all ? 'Show less' : `Show all ${rows.length}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
