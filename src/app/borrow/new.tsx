import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Container, ScreenHeader } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { BORROW_CATEGORIES, postItem } from '../../lib/borrow';
import { useThemeColors } from '../../theme';

const ACCENT = '#0891B2';

export default function NewLendItemScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const router = useRouter();
  const { userId, profile, communityId } = useAuth();

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState<string>('tools');
  const [photo, setPhoto] = useState<string | null>(null);
  const [wa, setWa] = useState(profile?.whatsapp ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [submitting, setSubmitting] = useState(false);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true });
    if (!res.canceled) setPhoto(res.assets[0].uri);
  };

  const submit = async () => {
    if (!userId) return;
    if (!title.trim()) return toast.show('What are you lending?');
    setSubmitting(true);
    try {
      const item = await postItem({ communityId, ownerUserId: userId, title, description: desc || null, category, photoUri: photo, contactWhatsapp: wa || null, contactPhone: phone || null });
      toast.show('Listed to lend 🤝');
      router.replace(`/borrow/${item.id}` as any);
    } catch (e) { toast.show(e instanceof Error ? e.message : 'Could not post'); } finally { setSubmitting(false); }
  };

  const input = 'rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink';
  const label = 'mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted';

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader icon="swap-horizontal-outline" iconColor={ACCENT} title="Lend something" showBack hideSociety />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Container narrow>
          <Text className={label}>Photo (optional)</Text>
          <Pressable onPress={pick} className="mb-4 h-32 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface active:opacity-70">
            {photo ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : (
              <><Ionicons name="camera-outline" size={26} color={ACCENT} /><Text className="mt-1 text-[12px] text-muted">Add a photo</Text></>
            )}
          </Pressable>

          <Text className={label}>What are you lending?</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Bosch drill machine" placeholderTextColor={c.faint} className={`mb-3 ${input}`} style={{ outline: 'none' } as any} />

          <Text className={label}>Category</Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {BORROW_CATEGORIES.map((b) => {
              const on = category === b.key;
              return (
                <Pressable key={b.key} onPress={() => setCategory(b.key)} className="flex-row items-center gap-1 rounded-full border px-3 py-1.5" style={{ borderColor: on ? ACCENT : c.line, backgroundColor: on ? ACCENT : c.surface }}>
                  <Ionicons name={b.icon as any} size={12} color={on ? '#fff' : c.muted} />
                  <Text className="text-[12px] font-sans-sb" style={{ color: on ? '#fff' : c.muted }}>{b.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text className={label}>Notes (optional)</Text>
          <TextInput value={desc} onChangeText={setDesc} placeholder="Condition, how long it can be borrowed, etc." placeholderTextColor={c.faint} multiline className={`mb-4 ${input}`} style={{ minHeight: 64, outline: 'none' } as any} />

          <Text className={label}>WhatsApp (for coordination)</Text>
          <TextInput value={wa} onChangeText={setWa} keyboardType="phone-pad" placeholder="98765 43210" placeholderTextColor={c.faint} className={`mb-5 ${input}`} style={{ outline: 'none' } as any} />

          <Button label="List it to lend" icon="checkmark" size="lg" fullWidth loading={submitting} onPress={submit} />
          <Text className="mt-3 text-center text-[12px] leading-[18px] text-faint">It's a free favour between neighbours — you'll approve who borrows and mark it returned.</Text>
        </Container>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
