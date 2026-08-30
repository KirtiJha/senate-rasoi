import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { openPhotoPicker } from '../../lib/photo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Container, ScreenHeader } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { LOST_FOUND_CATEGORIES, LostFoundKind, postLostFoundItem } from '../../lib/lostFound';
import { useThemeColors } from '../../theme';


export default function NewLostFoundScreen() {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const toast = useToast();
  const router = useRouter();
  const { userId, profile, communityId } = useAuth();
  const { kind: kindParam } = useLocalSearchParams<{ kind?: string }>();
  const kind: LostFoundKind = kindParam === 'found' ? 'found' : 'lost';
  const isLost = kind === 'lost';

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState<string>('other');
  const [photo, setPhoto] = useState<string | null>(null);
  const [wa, setWa] = useState(profile?.whatsapp ?? '');
  const [submitting, setSubmitting] = useState(false);

  const pick = async () => {
    const res = await openPhotoPicker({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true });
    if (!res.canceled) setPhoto(res.assets[0].uri);
  };

  const submit = async () => {
    if (!userId) return;
    if (!title.trim()) return toast.show(isLost ? 'What did you lose?' : 'What did you find?');
    setSubmitting(true);
    try {
      const item = await postLostFoundItem({
        communityId,
        ownerUserId: userId,
        kind,
        title,
        description: desc || null,
        category,
        photoUri: photo,
        contactWhatsapp: wa || null,
      });
      toast.show(isLost ? 'Reported! Neighbours will be notified 🔍' : 'Reported! The owner can now reach you 📦');
      router.replace(`/lost-found/${item.id}` as any);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Could not post');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink';
  const labelCls = 'mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted';

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        icon="search-outline"
        iconColor={ACCENT}
        title={isLost ? 'Report lost item' : 'Report found item'}
        showBack
        hideSociety
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Container narrow>
          {/* Kind toggle */}
          <View className="mb-5 flex-row rounded-2xl p-1" style={{ backgroundColor: c.inset }}>
            {([['lost', '🔍 I lost something'], ['found', '📦 I found something']] as [LostFoundKind, string][]).map(([k, lbl]) => (
              <Pressable
                key={k}
                onPress={() => router.replace((`/lost-found/new?kind=${k}`) as any)}
                className="flex-1 items-center rounded-xl py-2"
                style={{ backgroundColor: kind === k ? c.bg : 'transparent' }}
              >
                <Text className="text-[12px] font-sans-sb" style={{ color: kind === k ? ACCENT : c.muted }} numberOfLines={1}>
                  {lbl}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Photo */}
          <Text className={labelCls}>Photo (optional)</Text>
          <Pressable
            onPress={pick}
            className="mb-4 h-32 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface active:opacity-70"
          >
            {photo ? (
              <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={26} color={ACCENT} />
                <Text className="font-sans mt-1 text-[12px] text-muted">Add a photo</Text>
              </>
            )}
          </Pressable>

          <Text className={labelCls}>{isLost ? 'What did you lose?' : 'What did you find?'}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={isLost ? 'e.g. Keys with blue keychain' : 'e.g. Black wallet near main lobby'}
            placeholderTextColor={c.faint}
            className={`mb-3 ${inputCls}`}
            style={{ outline: 'none' } as any}
          />

          <Text className={labelCls}>Category</Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {LOST_FOUND_CATEGORIES.map((b) => {
              const on = category === b.key;
              return (
                <Pressable
                  key={b.key}
                  onPress={() => setCategory(b.key)}
                  className="flex-row items-center gap-1 rounded-full border px-3 py-1.5"
                  style={{ borderColor: on ? ACCENT : c.line, backgroundColor: on ? ACCENT : c.surface }}
                >
                  <Ionicons name={b.icon as any} size={12} color={on ? '#fff' : c.muted} />
                  <Text className="text-[12px] font-sans-sb" style={{ color: on ? '#fff' : c.muted }}>{b.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text className={labelCls}>{isLost ? 'Where / when did you lose it?' : 'Where did you find it?'}</Text>
          <TextInput
            value={desc}
            onChangeText={setDesc}
            placeholder={isLost ? 'Near the gym, yesterday evening…' : 'Found near the lift on 3rd floor…'}
            placeholderTextColor={c.faint}
            multiline
            className={`mb-4 ${inputCls}`}
            style={{ minHeight: 64, outline: 'none' } as any}
          />

          <Text className={labelCls}>WhatsApp (for contact)</Text>
          <TextInput
            value={wa}
            onChangeText={setWa}
            keyboardType="phone-pad"
            placeholder="98765 43210"
            placeholderTextColor={c.faint}
            className={`mb-5 ${inputCls}`}
            style={{ outline: 'none' } as any}
          />

          <Button
            label={isLost ? 'Report lost item' : 'Report found item'}
            icon="checkmark"
            size="lg"
            fullWidth
            loading={submitting}
            onPress={submit}
          />
          <Text className="font-sans mt-3 text-center text-[12px] leading-[18px] text-faint">
            {isLost
              ? 'Your neighbours will be notified and can reach out if they spot it.'
              : "The owner can contact you to claim the item. You're a star! ⭐"}
          </Text>
        </Container>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
