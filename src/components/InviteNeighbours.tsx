import { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, Pressable, Text, View } from 'react-native';

import { useToast } from '../context/toast';
import { inviteUrl, inviteWhatsAppLink, shareInvite } from '../lib/share';
import { useThemeColors } from '../theme';

function openUrl(u: string) { if (Platform.OS === 'web') window.open(u, '_blank'); else Linking.openURL(u); }

/**
 * Getting your neighbours in.
 *
 * A founder onboards their society and lands in an app with nothing in it and
 * nobody else in it. Nothing anywhere said that the first job is to bring
 * people in, and there was no invite of any kind to do it with — the only
 * route was to describe Aangan and hope the other person picked the same
 * society out of a national list.
 *
 * The link is just the sign-up screen with the society already chosen, which
 * that screen has understood all along. It had simply never been handed to
 * anybody.
 */
export function InviteNeighbours({
  communityId, societyName, tone = 'card',
}: {
  communityId: string;
  societyName: string;
  /** 'hero' is the first-run prompt on Home; 'card' sits among other rows. */
  tone?: 'card' | 'hero';
}) {
  const c = useThemeColors();
  const toast = useToast();
  const hero = tone === 'hero';

  const onShare = async () => {
    const r = await shareInvite(societyName, communityId);
    toast.show(r === 'shared' ? 'Invite ready to send' : 'Copy the link below and send it');
  };

  return (
    <View
      className="rounded-2xl border p-4"
      style={{
        borderColor: hero ? c.accent + '55' : c.line,
        backgroundColor: hero ? c.accent + '0C' : c.surface,
      }}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: c.accent + '1A' }}>
          <Ionicons name="person-add-outline" size={19} color={c.accent} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-sans-bold text-[15px] text-ink">
            {hero ? 'Aangan works once your neighbours are here' : 'Invite your neighbours'}
          </Text>
          <Text className="font-sans mt-0.5 text-[12.5px] leading-[18px] text-muted">
            {hero
              ? `Send this to your society group. It opens sign-up with ${societyName} already chosen, so nobody lands in the wrong one.`
              : `Opens sign-up with ${societyName} already chosen.`}
          </Text>
        </View>
      </View>

      <View className="mt-3 flex-row gap-2">
        <Pressable
          onPress={() => openUrl(inviteWhatsAppLink(societyName, communityId))}
          accessibilityRole="button"
          accessibilityLabel="Invite on WhatsApp"
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 active:opacity-90"
          style={{ backgroundColor: '#25D366' }}
        >
          <Ionicons name="logo-whatsapp" size={16} color="#fff" />
          <Text className="text-[13px] font-sans-sb text-white">WhatsApp</Text>
        </Pressable>
        <Pressable
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel="Share invite"
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 active:bg-inset"
        >
          <Ionicons name="share-outline" size={16} color={c.ink} />
          <Text className="text-[13px] font-sans-sb text-ink">Share</Text>
        </Pressable>
      </View>

      {/* The link in full, because a society group is often on a laptop and
          someone will want to paste it rather than share it. */}
      <Text className="font-sans mt-2.5 text-[11px] leading-[15px] text-faint" numberOfLines={2}>
        {inviteUrl(communityId)}
      </Text>
    </View>
  );
}
