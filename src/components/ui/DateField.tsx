import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useThemeColors } from '../../theme';
import { Sheet } from './Sheet';
import { Touchable } from './Touchable';

/**
 * Tap-to-pick date and time fields.
 *
 * WHY IN-HOUSE RATHER THAN A LIBRARY
 * Typing "2026-11-08" into a text box asks a resident to know the format, get
 * the month right, and not fat-finger a digit — and the only feedback for
 * getting it wrong is a validation error after they press save. Worse, nothing
 * stops "08-11-2026", which is the same date to a person and a different one
 * to Postgres.
 *
 * The obvious fix is @react-native-community/datetimepicker, and it is the
 * wrong one here: it is a native module, so adopting it would mean a new build
 * through Play review before anybody saw the fix. Aangan ships over the air.
 * These are plain React Native views, so they go out with the next OTA.
 *
 * Both store and emit strings, not Date objects — 'YYYY-MM-DD' and 'HH:MM',
 * exactly what the columns hold and what the call sites already keep in state.
 * No timezone conversion happens anywhere: a date assembled from its own year,
 * month and day cannot drift across a midnight boundary the way
 * `new Date(...).toISOString()` famously does.
 */

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 'YYYY-MM-DD' for a local date, without going through UTC. */
function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todayIso(): string {
  const n = new Date();
  return iso(n.getFullYear(), n.getMonth(), n.getDate());
}

/** '2026-11-08' → 'Sat, 8 Nov 2026'. Returns null for anything unparseable. */
export function formatDateLabel(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()];
  return `${wd}, ${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

/** '18:00' → '6:00 pm'. Returns null for anything unparseable. */
export function formatTimeLabel(value: string | null | undefined): string | null {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  if (h > 23 || m > 59) return null;
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function FieldShell({
  label,
  text,
  placeholder,
  icon,
  onPress,
  onClear,
}: {
  label?: string;
  text: string | null;
  placeholder: string;
  icon: 'calendar-outline' | 'time-outline';
  onPress: () => void;
  onClear?: () => void;
}) {
  const c = useThemeColors();

  return (
    <View>
      {label ? (
        <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">{label}</Text>
      ) : null}

      <View className="flex-row items-center gap-2">
        <View style={{ flex: 1 }}>
          <Touchable onPress={onPress} accessibilityRole="button" accessibilityLabel={label ?? placeholder}>
            <View
              pointerEvents="none"
              className="flex-row items-center gap-2 rounded-2xl border border-line px-3.5 py-3"
              style={{ backgroundColor: c.inset }}
            >
              <Ionicons name={icon} size={16} color={c.muted} />
              <Text className="flex-1 font-sans text-[15px]" style={{ color: text ? c.ink : c.faint }}>
                {text ?? placeholder}
              </Text>
              <Ionicons name="chevron-down" size={15} color={c.faint} />
            </View>
          </Touchable>
        </View>

        {onClear && text ? (
          <Touchable onPress={onClear} accessibilityRole="button" accessibilityLabel="Clear">
            <View
              pointerEvents="none"
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: c.inset }}
            >
              <Ionicons name="close" size={16} color={c.muted} />
            </View>
          </Touchable>
        ) : null}
      </View>
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Pick a date',
  /** Earliest selectable day, 'YYYY-MM-DD'. Days before it are shown but inert. */
  minDate,
  /** Lets the field be emptied again. Omit for a date that must be set. */
  clearable = true,
}: {
  label?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  minDate?: string;
  clearable?: boolean;
}) {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);

  // The month on screen. Opens on the chosen date, or today when unset.
  const initial = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayIso();
  const [y0, m0] = initial.split('-').map(Number);
  const [view, setView] = useState({ y: y0, m: m0 - 1 });

  const grid = useMemo(() => {
    const first = new Date(view.y, view.m, 1).getDay();
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const cells: (number | null)[] = Array(first).fill(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [view]);

  const today = todayIso();
  const shift = (by: number) => {
    const m = view.m + by;
    setView({ y: view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };

  return (
    <>
      <FieldShell
        label={label}
        text={formatDateLabel(value)}
        placeholder={placeholder}
        icon="calendar-outline"
        onPress={() => {
          const base = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayIso();
          const [yy, mm] = base.split('-').map(Number);
          setView({ y: yy, m: mm - 1 });
          setOpen(true);
        }}
        onClear={clearable ? () => onChange(null) : undefined}
      />

      <Sheet visible={open} onClose={() => setOpen(false)} title="Pick a date">
        <View>
          <View className="mb-2 flex-row items-center justify-between">
            <Touchable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Previous month">
              <View pointerEvents="none" className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: c.inset }}>
                <Ionicons name="chevron-back" size={16} color={c.ink} />
              </View>
            </Touchable>

            <Text className="font-sans-sb text-[15px] text-ink">
              {MONTHS[view.m]} {view.y}
            </Text>

            <Touchable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Next month">
              <View pointerEvents="none" className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: c.inset }}>
                <Ionicons name="chevron-forward" size={16} color={c.ink} />
              </View>
            </Touchable>
          </View>

          <View className="flex-row">
            {WEEKDAYS.map((w, i) => (
              <View key={i} style={{ flex: 1 }} className="items-center py-1">
                <Text className="font-sans text-[11px]" style={{ color: c.faint }}>{w}</Text>
              </View>
            ))}
          </View>

          {/* Rows of seven equal cells. Laid out with flex rather than
              percentage widths — 7 × 14.28% rounds past 100% at some pixel
              densities and wraps the last day onto its own line. */}
          {grid.map((row, ri) => (
            <View key={ri} className="flex-row">
              {row.map((d, ci) => {
                if (d === null) return <View key={ci} style={{ flex: 1, height: 42 }} />;
                const day = iso(view.y, view.m, d);
                const selected = day === value;
                const isToday = day === today;
                const disabled = !!minDate && day < minDate;

                return (
                  <View key={ci} style={{ flex: 1, height: 42 }} className="items-center justify-center">
                    <Touchable
                      onPress={() => { if (!disabled) { onChange(day); setOpen(false); } }}
                      disabled={disabled}
                      accessibilityRole="button"
                      accessibilityLabel={formatDateLabel(day) ?? day}
                    >
                      <View
                        pointerEvents="none"
                        className="h-9 w-9 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: selected ? c.accent : 'transparent',
                          borderWidth: !selected && isToday ? 1 : 0,
                          borderColor: c.accentLine,
                          opacity: disabled ? 0.3 : 1,
                        }}
                      >
                        <Text
                          className="font-sans-sb text-[14px]"
                          style={{ color: selected ? c.onAccent : c.ink }}
                        >
                          {d}
                        </Text>
                      </View>
                    </Touchable>
                  </View>
                );
              })}
            </View>
          ))}

          <View className="mt-2 flex-row gap-2">
            <View style={{ flex: 1 }}>
              <Touchable onPress={() => { onChange(today); setOpen(false); }}
                accessibilityRole="button" accessibilityLabel="Today">
                <View pointerEvents="none" className="items-center rounded-xl py-2.5"
                  style={{ backgroundColor: c.inset }}>
                  <Text className="font-sans-sb text-[13.5px]" style={{ color: c.ink }}>Today</Text>
                </View>
              </Touchable>
            </View>
            <View style={{ flex: 1 }}>
              <Touchable
                onPress={() => {
                  const n = new Date();
                  n.setDate(n.getDate() + 1);
                  onChange(iso(n.getFullYear(), n.getMonth(), n.getDate()));
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Tomorrow"
              >
                <View pointerEvents="none" className="items-center rounded-xl py-2.5"
                  style={{ backgroundColor: c.inset }}>
                  <Text className="font-sans-sb text-[13.5px]" style={{ color: c.ink }}>Tomorrow</Text>
                </View>
              </Touchable>
            </View>
          </View>
        </View>
      </Sheet>
    </>
  );
}

/**
 * Hours down one column, minutes down the other.
 *
 * Five-minute steps rather than every minute: nothing in a society runs to
 * 6:37, and 12 choices scroll where 60 do not.
 */
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export function TimeField({
  label,
  value,
  onChange,
  placeholder = 'Pick a time',
  clearable = true,
}: {
  label?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  clearable?: boolean;
}) {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);

  const parsed = value && /^\d{1,2}:\d{2}$/.test(value) ? value.split(':').map(Number) : null;
  const [h, setH] = useState(parsed ? parsed[0] : 18);
  const [m, setM] = useState(parsed ? parsed[1] : 0);

  const commit = (hh: number, mm: number) => {
    onChange(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  };

  return (
    <>
      <FieldShell
        label={label}
        text={formatTimeLabel(value)}
        placeholder={placeholder}
        icon="time-outline"
        onPress={() => {
          const p = value && /^\d{1,2}:\d{2}$/.test(value) ? value.split(':').map(Number) : null;
          setH(p ? p[0] : 18);
          setM(p ? p[1] : 0);
          setOpen(true);
        }}
        onClear={clearable ? () => onChange(null) : undefined}
      />

      <Sheet visible={open} onClose={() => setOpen(false)} title="Pick a time">
        <View>
          <Text className="mb-2 text-center font-display-sb text-[26px] text-ink">
            {formatTimeLabel(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)}
          </Text>

          <View className="flex-row gap-3" style={{ height: 210 }}>
            <View style={{ flex: 1 }}>
              <Text className="mb-1 text-center text-[11px] font-sans-sb uppercase tracking-wider text-muted">Hour</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {HOURS.map((hh) => (
                  <Touchable key={hh} onPress={() => { setH(hh); commit(hh, m); }}
                    accessibilityRole="button" accessibilityLabel={`${hh} hours`}>
                    <View pointerEvents="none" className="mb-1 items-center rounded-xl py-2"
                      style={{ backgroundColor: hh === h ? c.accent : c.inset }}>
                      <Text className="font-sans-sb text-[14px]" style={{ color: hh === h ? c.onAccent : c.ink }}>
                        {formatTimeLabel(`${String(hh).padStart(2, '0')}:00`)?.replace(':00', '')}
                      </Text>
                    </View>
                  </Touchable>
                ))}
              </ScrollView>
            </View>

            <View style={{ flex: 1 }}>
              <Text className="mb-1 text-center text-[11px] font-sans-sb uppercase tracking-wider text-muted">Minute</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {MINUTES.map((mm) => (
                  <Touchable key={mm} onPress={() => { setM(mm); commit(h, mm); }}
                    accessibilityRole="button" accessibilityLabel={`${mm} minutes`}>
                    <View pointerEvents="none" className="mb-1 items-center rounded-xl py-2"
                      style={{ backgroundColor: mm === m ? c.accent : c.inset }}>
                      <Text className="font-sans-sb text-[14px]" style={{ color: mm === m ? c.onAccent : c.ink }}>
                        :{String(mm).padStart(2, '0')}
                      </Text>
                    </View>
                  </Touchable>
                ))}
              </ScrollView>
            </View>
          </View>

          <View className="mt-3">
            <Touchable onPress={() => { commit(h, m); setOpen(false); }}
              accessibilityRole="button" accessibilityLabel="Done">
              <View pointerEvents="none" className="items-center rounded-xl py-3"
                style={{ backgroundColor: c.accent }}>
                <Text className="font-sans-sb text-[14px]" style={{ color: c.onAccent }}>Done</Text>
              </View>
            </Touchable>
          </View>
        </View>
      </Sheet>
    </>
  );
}
