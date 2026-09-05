import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useToast } from '../context/toast';
import { FOUNDER_HIDDEN_KEY, FOUNDER_PREVIEW_KEY, fetchFounderProgress } from '../lib/founder';
import { shareInvite } from '../lib/share';
import { useThemeColors } from '../theme';

/**
 * The founder's first week, as a list.
 *
 * Every step is something the society needs before Aangan is worth opening
 * twice: neighbours, a first notice, the guard's number, the bye-laws, the
 * nearest hospital. Each is ticked from the data — not from having tapped
 * the row — and the card goes away by itself when the five are done, or
 * when the founder hides it.
 */
export function FounderChecklist({ communityId, societyName }: { communityId: string; societyName: string }) {
  const c = useThemeColors();
  const router = useRouter();
  const toast = useToast();
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([AsyncStorage.getItem(FOUNDER_HIDDEN_KEY(communityId)), AsyncStorage.getItem(FOUNDER_PREVIEW_KEY)])
      .then(([h, p]) => { if (live) { setHidden(h === '1'); setPreview(__DEV__ && p === '1'); } })
      .catch(() => { if (live) setHidden(false); });
    return () => { live = false; };
  }, [communityId]);

  const progress = useQuery({
    queryKey: ['founder', communityId],
    queryFn: () => fetchFounderProgress(communityId),
    enabled: hidden === false,
    staleTime: 5 * 60_000,
  });

  if (hidden !== false || !progress.data) return null;
  const p = progress.data;
  const steps = [
    {
      key: 'invite', done: p.members >= 5, icon: 'person-add-outline' as const,
      title: 'Invite five neighbours', detail: p.members >= 5 ? `${p.members} here already` : `${p.members} of 5 so far`,
      go: async () => { const r = await shareInvite(societyName, communityId); toast.show(r === 'shared' ? 'Invite ready to send' : 'Invite link copied'); },
    },
    {
      key: 'welcome', done: p.announcements >= 1, icon: 'megaphone-outline' as const,
      title: 'Post a welcome notice', detail: 'So the feed is not empty when they arrive',
      go: () => router.push('/feed' as never),
    },
    {
      key: 'guard', done: p.emergencyContacts >= 1, icon: 'call-outline' as const,
      title: "Add the guard's number", detail: 'Security, maintenance, the plumber who answers',
      go: () => router.push('/emergency' as never),
    },
    {
      key: 'documents', done: p.documents >= 1, icon: 'folder-open-outline' as const,
      title: 'Upload the bye-laws', detail: 'Rules, notices, the maintenance schedule',
      go: () => router.push('/documents' as never),
    },
    {
      key: 'places', done: p.places >= 1, icon: 'location-outline' as const,
      title: 'Pin the nearest hospital', detail: 'And the pharmacy, the school, the good dosa place',
      go: () => router.push('/places' as never),
    },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length && !preview) return null;

  const hide = async () => {
    setHidden(true);
    try { await AsyncStorage.setItem(FOUNDER_HIDDEN_KEY(communityId), '1'); } catch { /* it comes back next launch; fine */ }
  };

  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: c.accent + '55', backgroundColor: c.accent + '0C' }}>
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: c.accent + '1A' }}>
          <Ionicons name="checkmark-done-outline" size={20} color={c.accent} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-sans-bold text-[15px] text-ink">Set up {societyName}</Text>
          <Text className="font-sans mt-0.5 text-[12.5px] leading-[18px] text-muted">
            {done} of {steps.length} done. Five small things, and the aangan is alive.
          </Text>
        </View>
        <Pressable onPress={hide} hitSlop={8} accessibilityRole="button" accessibilityLabel="Hide this checklist">
          <Ionicons name="close" size={18} color={c.faint} />
        </Pressable>
      </View>

      {/* Progress: one bar, five segments. */}
      <View className="mt-3 flex-row gap-1">
        {steps.map((s) => (
          <View key={s.key} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: s.done ? c.accent : c.accent + '22' }} />
        ))}
      </View>

      <View className="mt-3">
        {steps.map((s, i) => (
          <Pressable
            key={s.key}
            onPress={s.done ? undefined : s.go}
            disabled={s.done}
            accessibilityRole="button"
            accessibilityState={{ disabled: s.done, checked: s.done }}
            accessibilityLabel={`${s.title}${s.done ? ', done' : ''}`}
            className={`flex-row items-center gap-3 py-2.5 ${i ? 'border-t' : ''} active:opacity-70`}
            style={{ borderColor: c.accent + '22', opacity: s.done ? 0.6 : 1 }}
          >
            <Ionicons name={s.done ? 'checkmark-circle' : s.icon} size={20} color={s.done ? c.success : c.accent} />
            <View className="min-w-0 flex-1">
              <Text className={`font-sans-sb text-[14px] text-ink ${s.done ? 'line-through' : ''}`}>{s.title}</Text>
              <Text className="font-sans text-[12px] text-muted" numberOfLines={1}>{s.detail}</Text>
            </View>
            {!s.done ? <Ionicons name="chevron-forward" size={16} color={c.faint} /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
