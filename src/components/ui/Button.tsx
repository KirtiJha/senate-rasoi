import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { fixed, gradients, useThemeColors } from '../../theme';

type Variant = 'primary' | 'whatsapp' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const BG: Record<Variant, string> = {
  primary: '', // gradient handled separately
  whatsapp: 'bg-whatsapp active:opacity-90',
  success: 'bg-success active:opacity-90',
  outline: 'bg-transparent border-[1.5px] border-line active:bg-inset',
  ghost: 'bg-transparent active:bg-inset',
  danger: 'bg-transparent border-[1.5px] border-nonveg active:bg-accent-soft',
};

const FG: Record<Variant, string> = {
  primary: 'text-on-accent',
  whatsapp: 'text-white',
  success: 'text-white',
  outline: 'text-ink',
  ghost: 'text-ink',
  danger: 'text-nonveg',
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
    variant === 'primary' ? c.onAccent
    : variant === 'whatsapp' || variant === 'success' ? fixed.white
    : variant === 'danger' ? c.nonveg
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

  if (variant === 'primary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        className={`overflow-hidden ${PAD[size]} ${fullWidth ? 'w-full' : 'self-start'} ${isDisabled ? 'opacity-50' : ''} ${className}`}
      >
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View className="flex-row items-center justify-center gap-2">{content}</View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`flex-row items-center justify-center gap-2 ${BG[variant]} ${PAD[size]} ${
        fullWidth ? 'w-full' : ''
      } ${isDisabled ? 'opacity-50' : ''} ${className}`}
    >
      {content}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color,
  size = 20,
  className = '',
}: {
  icon: keyof typeof Ionicons.glyphMap;
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
      className={`h-9 w-9 items-center justify-center rounded-full active:bg-inset ${className}`}
    >
      <Ionicons name={icon} size={size} color={color ?? c.muted} />
    </Pressable>
  );
}
