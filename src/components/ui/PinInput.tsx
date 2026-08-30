import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useThemeColors } from '../../theme';

/**
 * The six-digit code, as six boxes.
 *
 * WHY THIS EXISTS
 * Sign-in asked for the PIN through an ordinary `Field` with `secureTextEntry`
 * and a `••••••` placeholder — a single grey box that looks exactly like the
 * phone-number box above it and tells you nothing about how many digits it
 * wants. You cannot see how many you have typed, and the one rule that gets
 * you rejected ("exactly 6") is invisible until you fail it.
 *
 * Six boxes make the requirement part of the control: the shape of the thing
 * tells you the length, the filled ones tell you where you are, and the caret
 * sits on the box you are actually filling.
 *
 * HOW IT WORKS
 * One real, invisible TextInput stretched over the whole row owns the text and
 * the keyboard; the boxes are painted underneath and are purely decorative.
 * That keeps a single source of truth for the value and avoids the focus
 * ping-pong of six separate inputs, which breaks backspace on Android.
 */
export function PinInput({
  value,
  onChange,
  length = 6,
  autoFocus,
  /** Shown filled rather than as digits, for entering an existing PIN. */
  secure = true,
  accessibilityLabel = 'Six digit code',
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  autoFocus?: boolean;
  secure?: boolean;
  accessibilityLabel?: string;
}) {
  const c = useThemeColors();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const digits = value.slice(0, length).split('');
  // The active box is the next empty one, except when full — then it is the
  // last, so the row does not look like it has lost focus on the final digit.
  const active = focused ? Math.min(digits.length, length - 1) : -1;

  return (
    <Pressable
      onPress={() => input.current?.focus()}
      accessibilityRole="none"
      // The row is a hit target for the hidden input, not a button in its own
      // right — `none` keeps a screen reader from announcing it as one.
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {Array.from({ length }).map((_, i) => {
          const filled = i < digits.length;
          const isActive = i === active;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 56,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isActive ? c.accentSoft : c.inset,
                borderWidth: isActive ? 2 : 1,
                borderColor: isActive ? c.accent : c.line,
              }}
            >
              {filled ? (
                secure ? (
                  <View
                    style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: c.ink }}
                  />
                ) : (
                  <Text className="font-sans-bold" style={{ fontSize: 22, color: c.ink }}>
                    {digits[i]}
                  </Text>
                )
              ) : isActive ? (
                <View style={{ width: 2, height: 22, borderRadius: 1, backgroundColor: c.accent }} />
              ) : null}
            </View>
          );
        })}
      </View>

      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        maxLength={length}
        accessibilityLabel={accessibilityLabel}
        // Covers the row so a tap anywhere focuses it, and is invisible rather
        // than unmounted so the keyboard and selection keep working.
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0,
          color: 'transparent',
        }}
      />
    </Pressable>
  );
}
