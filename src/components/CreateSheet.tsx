import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useAuth } from '../context/auth';
import { useThemeColors } from '../theme';
import { Sheet, Touchable } from './ui';

/**
 * What the centre button is for.
 *
 * It went straight to the marketplace composer — one of nine things a
 * resident might want to create, with no way back out to the other eight
 * except the system back gesture. So the tile that says "+" now asks.
 *
 * Ordered by how often the intent actually comes up in a society, not by
 * how the app is built: something to say, something wrong, food, then the
 * marketplace, then the occasional ones.
 */
type Item = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
  href: string;
  adminOnly?: boolean;
};

const ITEMS: Item[] = [
  { icon: 'chatbubbles-outline', label: 'Post to the feed', detail: 'A notice, a question, something to share', href: '/feed?compose=1' },
  { icon: 'warning-outline', label: 'Report an issue', detail: 'A leak, a light, the lift — the society sees it', href: '/feed?compose=1&category=issue' },
  { icon: 'restaurant-outline', label: 'Cook something', detail: 'A dish for today, or a tiffin plan', href: '/post?kind=dish' },
  { icon: 'pricetag-outline', label: 'Sell or offer a service', detail: 'An item, a class, a skill', href: '/post' },
  { icon: 'swap-horizontal-outline', label: 'Lend something', detail: 'A drill, a ladder, folding chairs', href: '/borrow/new?kind=offer' },
  { icon: 'hand-left-outline', label: 'Ask to borrow', detail: 'Something you need for a day', href: '/borrow/new?kind=request' },
  { icon: 'search-outline', label: 'Lost or found', detail: 'Keys, a phone, a parcel', href: '/lost-found/new?kind=lost' },
  { icon: 'stats-chart-outline', label: 'Start a poll', detail: 'Let the society decide', href: '/polls?compose=1' },
  { icon: 'car-outline', label: 'Offer a ride', detail: 'Seats you are driving anyway', href: '/rides/new' },
  { icon: 'key-outline', label: 'List a flat', detail: 'To rent or to sell', href: '/property/new' },
];

export function CreateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useThemeColors();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const items = ITEMS.filter((i) => !i.adminOnly || isAdmin);

  return (
    <Sheet visible={visible} onClose={onClose} title="What would you like to add?">
      <View style={{ gap: 8 }}>
        {items.map((it) => (
          <Touchable
            key={it.label}
            haptic={null}
            onPress={() => { onClose(); router.push(it.href as never); }}
            accessibilityRole="button"
            accessibilityLabel={it.label}
          >
            <View
              pointerEvents="none"
              className="flex-row items-center gap-3 rounded-2xl px-3.5 py-3"
              style={{ backgroundColor: c.inset }}
            >
              <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: c.accentSoft }}>
                <Ionicons name={it.icon} size={19} color={c.accent} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-sans-sb text-[14px] text-ink">{it.label}</Text>
                <Text className="font-sans text-[12px] text-muted" numberOfLines={1}>{it.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={c.faint} />
            </View>
          </Touchable>
        ))}
      </View>
    </Sheet>
  );
}
