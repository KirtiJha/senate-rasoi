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
      {subtitle ? <Text className="font-sans mb-3 mt-0.5 text-[12px] text-subtle">{subtitle}</Text> : <View className="mb-3" />}
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
  /** Inline validation message. Replaces the hint and rings the field. */
  error?: string;
}

/**
 * A text field.
 *
 * WHY IT CHANGED
 * It was bordered AND filled — a 1.5px line around a tinted well — which is
 * the most common signature of an app that has not been designed. Pick one:
 * the fill. At rest the field is just `inset` with no border, so a form reads
 * as a set of wells rather than a stack of outlined boxes.
 *
 * Focus draws a 2px accent ring INSIDE the existing footprint, so nothing
 * reflows when you tap in, and the fill lifts to `surface` — the field
 * brightens as it becomes the thing you are editing.
 *
 * Error was impossible to express before: every form in the app validated by
 * toast, with no field-level message and nothing marking which input was
 * wrong. A three-second toast is not an error state.
 */
export function Field({ label, required, hint, prefix, error, style, multiline, ...inputProps }: FieldProps) {
  const c = useThemeColors();
  const [focused, setFocused] = useState(false);

  const ringColor = error ? c.danger : focused ? c.accent : 'transparent';

  return (
    <View className="mb-3.5">
      {label ? <Label required={required}>{label}</Label> : null}
      <View
        className="flex-row items-center rounded-2xl px-3.5"
        style={{
          backgroundColor: focused && !error ? c.surface : c.inset,
          borderWidth: 2,
          borderColor: ringColor,
        }}
      >
        {prefix ? <Text className="mr-1 font-sans-sb text-[15px] text-muted">{prefix}</Text> : null}
        <TextInput
          placeholderTextColor={c.subtle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline={multiline}
          className="flex-1 font-sans-md text-[15px] text-ink"
          style={[
            { outlineWidth: 0, paddingVertical: 11 } as object,
            multiline ? { height: 84, textAlignVertical: 'top' } : null,
            style,
          ]}
          {...inputProps}
        />
      </View>
      {error ? (
        <Text className="mt-1.5 font-sans-sb text-[12px]" style={{ color: c.danger }}>{error}</Text>
      ) : hint ? (
        <Text className="font-sans mt-1 text-[11px] text-subtle">{hint}</Text>
      ) : null}
    </View>
  );
}
