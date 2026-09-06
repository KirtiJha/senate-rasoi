import { Image } from 'expo-image';
import { createContext, useContext } from 'react';
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

/**
 * Where an Avatar with a user id finds its photo. The AvatarProvider fills
 * this from one society-wide lookup; without a provider it answers nothing
 * and every avatar is initials, as before.
 */
export const AvatarLookupContext = createContext<{ lookup: (userId: string) => string | undefined }>({ lookup: () => undefined });

/**
 * A person. The photo when there is one, two initials on a colour keyed off
 * the name when there is not — so a society of strangers still has stable
 * faces before anyone has uploaded anything.
 */
export function Avatar({ name, size = 36, userId, uri }: {
  name: string;
  size?: number;
  /** Looks the photo up from the society map. */
  userId?: string | null;
  /** A photo you already have (a just-picked one, say). Wins over the lookup. */
  uri?: string | null;
}) {
  const { lookup } = useContext(AvatarLookupContext);
  const photo = uri ?? (userId ? lookup(userId) : undefined);
  const c = colorFor(name);
  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
        accessibilityLabel={name}
      />
    );
  }
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg }}
      className="items-center justify-center"
      accessibilityLabel={name}
    >
      <Text style={{ color: c.fg, fontSize: size * 0.36 }} className="font-sans-bold">
        {initials(name)}
      </Text>
    </View>
  );
}
