import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';

import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { getOrCreateThread } from '../lib/dm';
import { haptics } from '../lib/haptics';
import { useThemeColors } from '../theme';
import { Button } from './ui';

/**
 * Open (or start) the DM thread with one neighbour.
 *
 * Shared by the full-width button below and the icon-sized one used in dense
 * rows, so there is one definition of what "message them" means.
 */
export function useOpenThread(userId: string | null | undefined) {
  const router = useRouter();
  const toast = useToast();
  const { userId: me } = useAuth();
  const [busy, setBusy] = useState(false);

  const open = useCallback(async () => {
    if (busy || !userId) return;
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
  }, [busy, userId, router, toast]);

  /** Nothing to message: no account, or it is you. */
  const canMessage = !!userId && userId !== me;

  return { open, busy, canMessage };
}

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
  const { open, busy, canMessage } = useOpenThread(userId);
  if (!canMessage) return null;

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

/**
 * The same thing, sized for a row of actions rather than a page.
 *
 * Order rows on both sides of a transaction already sit shoulder to shoulder
 * with Pay, Accept and Cancel; a full-width button does not fit there, and
 * leaving the row with only a WhatsApp glyph is how in-app messaging stayed
 * invisible in the food flow long after it worked everywhere else.
 */
export function MessageIconButton({
  userId,
  label = 'Message in Aangan',
}: {
  userId: string | null | undefined;
  label?: string;
}) {
  const c = useThemeColors();
  const { open, busy, canMessage } = useOpenThread(userId);
  if (!canMessage) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={open}
      disabled={busy}
      hitSlop={6}
      className="h-9 w-9 items-center justify-center rounded-full bg-inset active:opacity-70"
    >
      <Ionicons name="chatbubble-ellipses-outline" size={17} color={c.accent} />
    </Pressable>
  );
}
