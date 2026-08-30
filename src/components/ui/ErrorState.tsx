import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { ZoomIn } from 'react-native-reanimated';

import { AView, dur, ease } from '../../lib/motion';

import { useThemeColors } from '../../theme';
import { Button } from './Button';

/**
 * "We couldn't load this" — with a way to try again.
 *
 * WHY THIS EXISTS
 * Every list screen used to collapse three different outcomes into one view:
 * a successful-but-empty result, a request that failed, and a record that was
 * genuinely deleted. So a dropped connection told residents "No donors have
 * opted in yet" on the Blood & SOS screen, and "Listing removed — it may have
 * been removed by the owner" on a listing that was still there. Neither is
 * true, both are unfalsifiable from the user's side, and nothing anywhere in
 * the app offered a retry.
 *
 * The rule this component encodes: render the error branch BEFORE the empty
 * branch, and only say something is missing when the server actually said so.
 * A thrown error is "couldn't load"; a null/404 result is "removed".
 */
export function ErrorState({
  title = "Couldn't load this",
  message = 'Check your connection and try again.',
  icon = 'cloud-offline-outline',
  onRetry,
  retryLabel = 'Try again',
  retrying,
  compact,
}: {
  title?: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onRetry?: () => void;
  retryLabel?: string;
  /** Shows a spinner in the retry button while the refetch is in flight. */
  retrying?: boolean;
  /** Tighter padding, for use inside a card or a section rather than a screen. */
  compact?: boolean;
}) {
  const c = useThemeColors();

  return (
    <View
      className={`items-center px-6 ${compact ? 'py-8' : 'py-16'}`}
      accessibilityRole="alert"
    >
      <AView
        entering={ZoomIn.duration(dur.expressive).easing(ease.emphasized)
          .withInitialValues({ transform: [{ scale: 0.7 }] })}
        className="mb-4 items-center justify-center"
        style={{
          width: compact ? 56 : 72,
          height: compact ? 56 : 72,
          backgroundColor: c.dangerSoft,
          borderTopLeftRadius: compact ? 16 : 22,
          borderTopRightRadius: compact ? 16 : 22,
          borderBottomLeftRadius: compact ? 10 : 14,
          borderBottomRightRadius: compact ? 10 : 14,
        }}
      >
        <Ionicons name={icon} size={compact ? 24 : 30} color={c.danger} />
      </AView>

      <Text className={`mb-1.5 text-center font-display text-ink ${compact ? 'text-[15px]' : 'text-[17px]'}`}>
        {title}
      </Text>

      <Text className="font-sans mb-5 max-w-[280px] text-center text-[14px] leading-6 text-muted">{message}</Text>

      {onRetry ? (
        <Button
          label={retryLabel}
          onPress={onRetry}
          variant="outline"
          size={compact ? 'sm' : 'md'}
          icon="refresh"
          loading={retrying}
        />
      ) : null}
    </View>
  );
}

/**
 * A one-line version for sections inside a bigger screen — a home-screen strip,
 * a card body — where a full-height error block would push everything down.
 */
export function ErrorRow({
  message = "Couldn't load",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const c = useThemeColors();

  return (
    <View
      className="mx-4 mb-3 flex-row items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3"
      accessibilityRole="alert"
    >
      <Ionicons name="cloud-offline-outline" size={17} color={c.muted} />
      <Text className="font-sans min-w-0 flex-1 text-[13px] text-muted">{message}</Text>
      {onRetry ? (
        <Button label="Retry" onPress={onRetry} variant="ghost" size="sm" />
      ) : null}
    </View>
  );
}
