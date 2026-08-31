import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { useAuth } from '../../context/auth';
import {
  FEEDBACK_KINDS,
  FEEDBACK_STATUS,
  FeedbackItem,
  fetchMyFeedback,
} from '../../lib/feedback';
import { useThemeColors } from '../../theme';
import { Badge, Container, ScreenHeader, Touchable } from '../../components/ui';

/**
 * What this resident has reported, and what came of it.
 *
 * The list exists mostly so the second half of a report is visible: today a
 * bug mentioned in a WhatsApp group vanishes, and the reporter never learns
 * whether anyone heard it. A row that says "In progress" is the difference
 * between a channel and a suggestion box.
 */
export default function MyFeedbackScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const { userId, isAdmin } = useAuth();

  const [items, setItems] = useState<FeedbackItem[] | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setItems([]); return; }
    try { setItems(await fetchMyFeedback(userId)); } catch { setItems([]); }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader title="Help us improve" showBack backHref="/settings" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          <Text className="font-sans mb-4 text-[13.5px] leading-[20px]" style={{ color: c.subtle }}>
            Found something broken, or wish Aangan did something it does not? Tell us here rather than
            in the group chat — you will see the reply on this screen.
          </Text>

          <View className="mb-5 gap-2">
            {FEEDBACK_KINDS.map((k) => (
              <Touchable
                key={k.key}
                onPress={() => router.push(`/feedback/new?kind=${k.key}` as never)}
                accessibilityRole="button"
                accessibilityLabel={k.label}
              >
                <View
                  pointerEvents="none"
                  className="flex-row items-center gap-3 rounded-2xl px-4 py-3.5"
                  style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}
                >
                  <View
                    className="h-9 w-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: c.accentSoft }}
                  >
                    <Ionicons name={k.icon as never} size={17} color={c.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className="font-sans-sb text-[14.5px] text-ink">{k.label}</Text>
                    <Text className="font-sans text-[12.5px]" style={{ color: c.subtle }}>{k.blurb}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={c.faint} />
                </View>
              </Touchable>
            ))}
          </View>

          {isAdmin ? (
            <View className="mb-5">
              <Touchable
                onPress={() => router.push('/admin/feedback' as never)}
                accessibilityRole="button"
                accessibilityLabel="Open the reports queue"
              >
                <View
                  pointerEvents="none"
                  className="flex-row items-center gap-3 rounded-2xl px-4 py-3.5"
                  style={{ backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accentLine }}
                >
                  <Ionicons name="clipboard-outline" size={17} color={c.accent} />
                  <Text className="flex-1 font-sans-sb text-[14px]" style={{ color: c.accent }}>
                    Everything residents have reported
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={c.accent} />
                </View>
              </Touchable>
            </View>
          ) : null}

          <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
            What you have sent
          </Text>

          {items === null ? (
            <View className="items-center py-8"><ActivityIndicator color={c.accent} /></View>
          ) : items.length === 0 ? (
            <Text className="font-sans py-6 text-center text-[13px]" style={{ color: c.faint }}>
              Nothing yet.
            </Text>
          ) : (
            items.map((it) => (
              <Touchable
                key={it.id}
                onPress={() => router.push(`/feedback/${it.id}` as never)}
                accessibilityRole="button"
                accessibilityLabel={it.title}
              >
                <View pointerEvents="none" className="mb-2 card p-3.5">
                  <View className="flex-row items-start gap-2">
                    <View style={{ flex: 1 }}>
                      <Text className="font-sans-sb text-[14.5px] text-ink" numberOfLines={2}>{it.title}</Text>
                      <Text className="font-sans mt-0.5 text-[12px]" style={{ color: c.faint }}>
                        {FEEDBACK_KINDS.find((k) => k.key === it.kind)?.label}
                      </Text>
                    </View>
                    <Badge label={FEEDBACK_STATUS[it.status].label} tone={FEEDBACK_STATUS[it.status].tone} />
                  </View>
                </View>
              </Touchable>
            ))
          )}
        </Container>
      </ScrollView>
    </View>
  );
}
