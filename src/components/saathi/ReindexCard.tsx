import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useToast } from '../../context/toast';
import { AIError } from '../../lib/ai';
import { ReembedProgress, reembedAll } from '../../lib/agent';
import { haptics } from '../../lib/haptics';
import { useThemeColors } from '../../theme';
import { Touchable } from '../ui';

/**
 * Rebuild Saathi's search index, on demand.
 *
 * WHY A BUTTON EXISTS
 * Embedding is normally lazy — a question is never blocked on the index, which
 * is right in steady state and useless after a bulk change. When the AI
 * provider changed, every vector had to be discarded and refilled, and the
 * only thing refilling them was residents happening to ask questions. Semantic
 * search stayed dead in the meantime, and nobody could tell: Saathi answered,
 * it just quietly could not find anything.
 *
 * Waiting for organic traffic to finish a migration is not a plan. This makes
 * it an action with a progress number.
 *
 * The work is done in bounded passes server-side and driven to completion from
 * here, because one unbounded pass over thousands of rows outlives the worker
 * and is killed mid-flight — leaving a half-built index and no error to
 * explain it.
 */
export function ReindexCard() {
  const c = useThemeColors();
  const toast = useToast();
  const [progress, setProgress] = useState<ReembedProgress | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (running) return;
    haptics.tap();
    setRunning(true);
    try {
      const final = await reembedAll(setProgress);
      if (final.pending === 0) {
        haptics.success();
        toast.show('Search index is up to date');
      } else {
        // Stopped making progress with work left — a row the provider will not
        // embed. Say so rather than looping on the same failure.
        toast.show(`Stopped with ${final.pending} left — check the function logs`);
      }
    } catch (e) {
      toast.show(e instanceof AIError ? e.message : 'Could not rebuild the index');
    } finally {
      setRunning(false);
    }
  };

  const total = progress ? progress.embedded + progress.pending : 0;
  const pct = total ? Math.round((progress!.embedded / total) * 100) : 0;

  return (
    <View className="card p-4">
      <View className="flex-row items-center gap-2">
        <Ionicons name="sparkles-outline" size={17} color={c.accent} />
        <Text className="font-sans-sb text-[14px] text-ink">Saathi search index</Text>
      </View>
      <Text className="font-sans mt-1 text-[12.5px] leading-[18px] text-subtle">
        Saathi can only find what has been indexed. New posts and listings are added
        automatically — rebuild only after a bulk import, or if answers seem to be
        missing things that exist.
      </Text>

      {progress ? (
        <View className="mt-3">
          <View className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: c.inset }}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.accent }} />
          </View>
          <Text className="font-sans mt-1.5 text-[12px]" style={{ color: c.muted }}>
            {progress.pending === 0
              ? `All ${progress.embedded} items indexed`
              : `${progress.embedded} indexed · ${progress.pending} to go`}
          </Text>
        </View>
      ) : null}

      <View className="mt-3">
        <Touchable onPress={run} disabled={running} accessibilityRole="button" accessibilityLabel="Rebuild search index">
          <View
            pointerEvents="none"
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              paddingVertical: 11,
              backgroundColor: running ? c.inset : c.accentSoft,
              borderWidth: 1,
              borderColor: running ? c.line : c.accentLine,
            }}
          >
            <Text className="font-sans-sb text-[13.5px]" style={{ color: running ? c.muted : c.accent }}>
              {running ? 'Indexing…' : 'Rebuild index'}
            </Text>
          </View>
        </Touchable>
      </View>
    </View>
  );
}
