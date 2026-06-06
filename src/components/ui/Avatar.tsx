import { Text, View } from 'react-native';

// Deterministic warm avatar colors keyed off the name, so each chef has a
// stable, friendly identity color.
const PALETTE = [
  { bg: '#1F5138', fg: '#EAF3EC' }, // forest
  { bg: '#B5531B', fg: '#FDEFE2' }, // clay
  { bg: '#3D6B8E', fg: '#E8F1F8' }, // slate blue
  { bg: '#8A4B7D', fg: '#F8ECF5' }, // plum
  { bg: '#C26A18', fg: '#FFF3E2' }, // saffron-deep
  { bg: '#4A6B2A', fg: '#EEF5E4' }, // olive
];

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '🍲'
  );
}

function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const c = colorFor(name);
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg }}
      className="items-center justify-center"
    >
      <Text style={{ color: c.fg, fontSize: size * 0.36 }} className="font-sans-bold">
        {initials(name)}
      </Text>
    </View>
  );
}
