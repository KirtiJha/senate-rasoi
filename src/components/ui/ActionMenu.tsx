import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useThemeColors } from '../../theme';
import { Sheet } from './Sheet';

export interface ActionMenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  onPress: () => void;
  destructive?: boolean;
}

/**
 * The "…" on a card, and the sheet of actions behind it.
 *
 * Author actions used to sit on the card as a row of three small grey
 * icons — edit, close, delete — competing with the content for the eye and
 * too small to hit cleanly. One quiet button now, and the actions open in
 * the same sheet the moderation menu already uses, each with a name and a
 * line saying what it does. Destructive ones wear the danger fill.
 */
export function ActionMenu({ label, items, title = 'Options', size = 18, tint }: {
  /** What the button is for, for a screen reader: "Poll options". */
  label: string;
  items: ActionMenuItem[];
  title?: string;
  size?: number;
  tint?: string;
}) {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="h-8 w-8 items-center justify-center rounded-full active:bg-inset"
      >
        <Ionicons name="ellipsis-horizontal" size={size} color={tint ?? c.faint} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={title}>
        <View style={{ gap: 8 }}>
          {items.map((it) => (
            <Pressable
              key={it.label}
              onPress={() => { setOpen(false); it.onPress(); }}
              accessibilityRole="button"
              accessibilityLabel={it.label}
              className="flex-row items-center gap-3 rounded-2xl px-3.5 py-3.5 active:opacity-70"
              style={{ backgroundColor: it.destructive ? c.dangerSoft : c.inset }}
            >
              <Ionicons name={it.icon} size={19} color={it.destructive ? c.danger : c.ink} />
              <View className="flex-1">
                <Text className="font-sans-sb text-[14px]" style={{ color: it.destructive ? c.dangerInk : c.ink }}>{it.label}</Text>
                {it.detail ? <Text className="font-sans text-[12px] text-muted">{it.detail}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </>
  );
}
