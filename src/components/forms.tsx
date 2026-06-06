import { ReactNode, useState } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';
import { useThemeColors } from '../theme';

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View className="mb-4 rounded-3xl border border-line bg-surface p-4">
      <Text className="font-display text-[17px] text-ink">{title}</Text>
      {subtitle ? <Text className="mb-3 mt-0.5 text-[12px] text-faint">{subtitle}</Text> : <View className="mb-3" />}
      {children}
    </View>
  );
}

export function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
      {children}
      {required ? <Text className="text-accent"> *</Text> : null}
    </Text>
  );
}

interface FieldProps extends TextInputProps {
  label?: string;
  required?: boolean;
  hint?: string;
  prefix?: string;
}

export function Field({ label, required, hint, prefix, style, multiline, ...inputProps }: FieldProps) {
  const c = useThemeColors();
  const [focused, setFocused] = useState(false);
  return (
    <View className="mb-3.5">
      {label ? <Label required={required}>{label}</Label> : null}
      <View
        className={`flex-row items-center rounded-2xl border-[1.5px] bg-inset px-3.5 ${
          focused ? 'border-accent' : 'border-line'
        }`}
      >
        {prefix ? <Text className="mr-1 font-sans-sb text-[15px] text-muted">{prefix}</Text> : null}
        <TextInput
          placeholderTextColor={c.faint}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline={multiline}
          className="flex-1 py-3 font-sans-md text-[15px] text-ink"
          style={[{ outlineWidth: 0 } as object, multiline ? { height: 84, textAlignVertical: 'top' } : null, style]}
          {...inputProps}
        />
      </View>
      {hint ? <Text className="mt-1 text-[11px] text-faint">{hint}</Text> : null}
    </View>
  );
}
