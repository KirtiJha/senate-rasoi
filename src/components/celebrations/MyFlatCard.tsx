import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { Contribution, declareOptOut, fetchMyContribution, rupees } from '../../lib/events';
import { haptics } from '../../lib/haptics';
import { useThemeColors } from '../../theme';
import { Button, Touchable } from '../ui';

/**
 * The two things a flat is the authority on: are we in, and how many of us.
 *
 * WHY THE COMMITTEE CANNOT ANSWER THESE. 244 flats, most still unoccupied.
 * Nobody is going to sit with a list and record, for every one of them,
 * whether they are taking part and how many people live there — and a
 * committee that guesses gets it wrong in both directions: a shortfall
 * invented for an empty flat, a family of six counted as two.
 *
 * 0087 through 0096 exist entirely for this card. Until now they had no screen
 * calling them, so the rules were enforced and unreachable.
 *
 * Shown to residents who are not running the celebration. The committee edits
 * any flat from the Collection screen, which is a different job.
 */
export function MyFlatCard({
  eventId,
  communityId,
  canManage,
}: {
  eventId: string;
  communityId: string;
  canManage: boolean;
}) {
  const c = useThemeColors();
  const toast = useToast();
  const { userId, profile } = useAuth();

  const [row, setRow] = useState<Contribution | null | 'none'>(null);
  const [heads, setHeads] = useState('');
  const [busy, setBusy] = useState(false);

  const flat = profile?.flat ?? null;

  const load = useCallback(async () => {
    if (!flat) { setRow('none'); return; }
    try {
      const r = await fetchMyContribution(eventId, flat);
      setRow(r);
      setHeads(r?.head_count ? String(r.head_count) : '');
    } catch {
      setRow('none');
    }
  }, [eventId, flat]);

  useEffect(() => { load(); }, [load]);

  // The committee has the Collection screen; this would be a second, worse
  // door into the same data.
  if (canManage || !flat || !userId) return null;
  if (row === null) return null;

  const current = row === 'none' ? null : row;
  const optedOut = !!current?.opted_out;
  const paid = current?.status === 'received';

  const save = async (nextOut: boolean, nextHeads?: string) => {
    if (busy) return;
    setBusy(true);
    haptics.select();
    try {
      const h = (nextHeads ?? heads).trim();
      await declareOptOut({
        eventId,
        communityId,
        flat,
        userId,
        existingId: current?.id ?? null,
        optedOut: nextOut,
        headCount: h ? Number(h) : null,
      });
      await load();
      toast.show(nextOut ? 'Noted — you are not taking part' : 'Updated');
    } catch {
      toast.show('Could not save that');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="mb-4 card p-4">
      <View className="flex-row items-center gap-2">
        <Ionicons name="home-outline" size={16} color={c.accent} />
        <Text className="flex-1 font-sans-sb text-[14.5px] text-ink">Your flat · {flat}</Text>
        {current ? (
          <Text className="font-sans text-[12.5px]" style={{ color: paid ? c.accent : c.faint }}>
            {paid ? `Paid ${rupees(Number(current.amount))}` : optedOut ? 'Not taking part' : 'Listed'}
          </Text>
        ) : null}
      </View>

      {/* Once the money is in, this is the treasurer's record, not a
          preference. Changing it here would be editing the ledger. */}
      {paid ? (
        <Text className="font-sans mt-2 text-[13px] leading-[19px]" style={{ color: c.subtle }}>
          Thank you — your contribution is recorded. Speak to the committee if anything looks wrong.
        </Text>
      ) : (
        <>
          <Text className="font-sans mt-2 text-[13px] leading-[19px]" style={{ color: c.subtle }}>
            {optedOut
              ? 'Your flat is marked as not taking part, so nobody will chase you and you are not counted in the shortfall.'
              : 'Not joining this one? Say so here and the committee will not have to ask.'}
          </Text>

          <View className="mt-3">
            <Button
              label={optedOut ? 'Actually, count us in' : 'We are not taking part'}
              variant={optedOut ? 'outline' : 'ghost'}
              size="sm"
              disabled={busy}
              onPress={() => save(!optedOut)}
            />
          </View>
        </>
      )}

      {/* Head count matters whenever a celebration splits per person, and only
          the household knows it. Offered even once paid, since it describes
          the flat rather than the payment. */}
      <View className="mt-3 border-t border-line pt-3">
        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
          People in your flat
        </Text>
        <View className="flex-row items-center gap-2">
          <TextInput
            value={heads}
            onChangeText={setHeads}
            keyboardType="number-pad"
            placeholder="e.g. 4"
            placeholderTextColor={c.faint}
            className="flex-1 rounded-xl px-3 py-2.5 text-[15px] text-ink"
            style={{ backgroundColor: c.inset, outline: 'none' } as never}
          />
          <Touchable
            onPress={() => save(optedOut)}
            disabled={busy || !current}
            accessibilityRole="button"
            accessibilityLabel="Save head count"
          >
            <View pointerEvents="none" className="rounded-xl px-4 py-2.5"
              style={{ backgroundColor: c.accentSoft, opacity: busy || !current ? 0.5 : 1 }}>
              <Text className="font-sans-sb text-[13px]" style={{ color: c.accent }}>Save</Text>
            </View>
          </Touchable>
        </View>
        {!current ? (
          <Text className="font-sans mt-1.5 text-[12px]" style={{ color: c.faint }}>
            The committee has not listed your flat yet — this saves once they do,
            or as soon as you opt out above.
          </Text>
        ) : null}
      </View>
    </View>
  );
}
