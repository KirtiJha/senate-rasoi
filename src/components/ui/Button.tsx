import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { fixed, useThemeColors } from '../../theme';
import { Touchable } from './Touchable';

type Variant = 'primary' | 'whatsapp' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const BG: Record<Variant, string> = {
  primary: 'bg-accent active:bg-accent-press',
  whatsapp: 'bg-whatsapp active:opacity-90',
  success: 'bg-success active:opacity-90',
  outline: 'bg-accent-soft active:opacity-80',
  ghost: 'bg-transparent active:bg-inset',
  danger: 'bg-danger active:opacity-90',
};

const FG: Record<Variant, string> = {
  primary: 'text-on-accent',
  whatsapp: 'text-[#06251A]',
  success: 'text-white',
  outline: 'text-accent',
  ghost: 'text-ink',
  danger: 'text-on-accent',
};

const PAD: Record<Size, string> = {
  sm: 'px-3.5 py-2 rounded-xl',
  md: 'px-4 py-3 rounded-2xl',
  lg: 'px-5 py-4 rounded-2xl',
};
const TXT: Record<Size, string> = { sm: 'text-[13px]', md: 'text-[15px]', lg: 'text-base' };
const ICON_SIZE: Record<Size, number> = { sm: 15, md: 18, lg: 20 };

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  fullWidth,
  className = '',
}: ButtonProps) {
  const c = useThemeColors();
  const iconColor =
    variant === 'primary' || variant === 'danger' ? c.onAccent
    : variant === 'whatsapp' ? '#06251A'
    : variant === 'success' ? fixed.white
    : variant === 'outline' ? c.accent
    : c.ink;
  const isDisabled = disabled || loading;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : icon ? (
        <Ionicons name={icon} size={ICON_SIZE[size]} color={iconColor} />
      ) : null}
      <Text className={`font-sans-sb ${FG[variant]} ${TXT[size]}`}>{label}</Text>
    </>
  );

  // Layout on the Touchable, paint on a plain child.
  //
  // Touchable is cssInterop-registered AND sets its own animated `style`, so a
  // className carrying a background on it puts the two in contention for the
  // same prop — and the background loses. That is why "Remove" was invisible in
  // dark mode: bg-danger never painted, leaving near-black label text on the
  // near-black page. It was silently affecting every variant.
  return (
    <Touchable
      onPress={onPress}
      disabled={isDisabled}
      haptic={isDisabled ? null : variant === 'danger' ? 'warning' : 'tap'}
      className={fullWidth ? 'w-full' : ''}
    >
      <View
        className={`flex-row items-center justify-center gap-2 ${BG[variant]} ${PAD[size]} ${
          fullWidth ? 'w-full' : ''
        } ${isDisabled ? 'opacity-50' : ''} ${className}`}
      >
        {content}
      </View>
    </Touchable>
  );
}

/**
 * An icon-only control.
 *
 * `label` is REQUIRED. This component had no label prop at all, so every
 * screen using it — including the close button on three modals — was
 * unlabelled by construction: a screen reader announced "button", with no way
 * to know what it does. Making it required means the gap cannot reopen, and
 * the type error is the reminder.
 */
export function IconButton({
  icon,
  label,
  onPress,
  color,
  size = 20,
  className = '',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  /** What the button does, in the user's words: "Close", "Remove photo". */
  label: string;
  onPress?: () => void;
  color?: string;
  size?: number;
  className?: string;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-9 w-9 items-center justify-center rounded-full active:bg-inset ${className}`}
    >
      <Ionicons name={icon} size={size} color={color ?? c.muted} />
    </Pressable>
  );
}
