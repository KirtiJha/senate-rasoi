import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { getOrCreateThread } from '../lib/dm';
import { haptics } from '../lib/haptics';
import { Button } from './ui';

/**
 * Message a neighbour inside Aangan.
 *
 * WHY IT EXISTS. Half the app's contact buttons opened WhatsApp and nothing
 * else — borrow, lost & found, flats, every listing category. That made an
 * account on another company's product a requirement for using this one, and
 * when a neighbour had not added a number the screens gave up entirely and
 * told people to "contact the poster through your society group", which is the
 * WhatsApp group this app exists to replace.
 *
 * Direct messages have worked since 0023. They were simply never offered from
 * the places where somebody actually wants to say something.
 *
 * Renders nothing when there is no account to message — a referral listing
 * posted on behalf of an outside plumber has a phone number and no user, and
 * WhatsApp is genuinely the only way to reach them.
 */
export function MessageNeighbour({
  userId,
  label = 'Message in Aangan',
  variant = 'primary',
}: {
  /** The neighbour's profile id. Null or your own id renders nothing. */
  userId: string | null | undefined;
  label?: string;
  variant?: 'primary' | 'outline';
}) {
  const router = useRouter();
  const toast = useToast();
  const { userId: me } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!userId || userId === me) return null;

  const open = async () => {
    if (busy) return;
    setBusy(true);
    haptics.tap();
    try {
      const threadId = await getOrCreateThread(userId);
      router.push(`/messages/${threadId}` as never);
    } catch {
      toast.show('Could not open the chat — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      label={busy ? 'Opening…' : label}
      icon="chatbubble-ellipses-outline"
      variant={variant}
      size="lg"
      fullWidth
      disabled={busy}
      onPress={open}
    />
  );
}
