import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAuth } from '../context/auth';
import { useConfirm } from '../context/confirm';
import { useToast } from '../context/toast';
import { removeAvatar, uploadAvatar } from '../lib/avatar';
import { haptics } from '../lib/haptics';
import { openPhotoPicker } from '../lib/photo';
import { useThemeColors } from '../theme';
import { Avatar } from './ui';

/**
 * Your own face, and the one place to change it.
 *
 * Tap to choose a photo (cropped square on the way in); with a photo set,
 * tap offers a new one or none. The preview shows at once and the upload
 * happens behind it; every other Avatar in the app picks the change up
 * through the society map.
 */
export function ProfilePhoto({ size = 88 }: { size?: number }) {
  const c = useThemeColors();
  const toast = useToast();
  const confirm = useConfirm();
  const { profile, userId, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const has = !!(preview ?? profile?.avatar_url);

  const choose = async () => {
    if (!userId || busy) return;
    const res = await openPhotoPicker({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    if (res.canceled || !res.assets[0]) return;
    const uri = res.assets[0].uri;
    setPreview(uri);
    setBusy(true);
    try {
      await uploadAvatar(uri, userId);
      await refreshProfile();
      haptics.tap();
      toast.show('Photo updated');
    } catch {
      setPreview(null);
      toast.show('Could not upload the photo — try again');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!userId || busy) return;
    if (!(await confirm({ title: 'Remove your photo?', message: 'Neighbours will see your initials instead.', confirmLabel: 'Remove', destructive: true }))) return;
    setBusy(true);
    try {
      await removeAvatar(userId);
      setPreview(null);
      await refreshProfile();
      toast.show('Photo removed');
    } catch { toast.show('Could not remove the photo'); }
    finally { setBusy(false); }
  };

  return (
    <View className="items-center">
      <Pressable
        onPress={choose}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={has ? 'Change your photo' : 'Add a photo'}
        className="active:opacity-80"
      >
        <View style={{ width: size, height: size }}>
          <Avatar name={profile?.name ?? 'Me'} size={size} userId={userId} uri={preview} />
          {busy ? (
            <View className="absolute inset-0 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
          <View
            className="absolute items-center justify-center rounded-full border-2"
            style={{ right: -2, bottom: -2, width: size * 0.34, height: size * 0.34, backgroundColor: c.accent, borderColor: c.bg }}
          >
            <Ionicons name={has ? 'camera' : 'add'} size={size * 0.18} color={c.onAccent} />
          </View>
        </View>
      </Pressable>
      <View className="mt-2 flex-row items-center gap-3">
        <Pressable onPress={choose} disabled={busy} hitSlop={6} accessibilityRole="button" accessibilityLabel={has ? 'Change photo' : 'Add a photo'}>
          <Text className="text-[13px] font-sans-sb text-accent">{has ? 'Change photo' : 'Add a photo'}</Text>
        </Pressable>
        {has ? (
          <>
            <Text className="text-[13px] text-faint">·</Text>
            <Pressable onPress={remove} disabled={busy} hitSlop={6} accessibilityRole="button" accessibilityLabel="Remove photo">
              <Text className="text-[13px] font-sans-sb text-muted">Remove</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}
