import { Platform, Share } from 'react-native';
import type { DishRow } from './types';
import { SLOT_EMOJI } from './types';

// Share a dish to the society WhatsApp group / anywhere. On native this opens
// the OS share sheet; on web it uses the Web Share API when available.
// (Phase B will add real per-dish URLs with link previews.)
export async function shareDish(dish: DishRow): Promise<'shared' | 'unsupported'> {
  const message =
    `${SLOT_EMOJI[dish.slot]} ${dish.dish_name} — ₹${dish.price}/plate\n` +
    `by ${dish.chef_name} (Flat ${dish.flat})\n` +
    `${dish.plates_left} plates left · order on Aangan 🍽️`;

  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as Navigator | undefined;
    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({ title: dish.dish_name, text: message });
        return 'shared';
      } catch {
        return 'unsupported';
      }
    }
    return 'unsupported';
  }

  try {
    await Share.share({ message });
    return 'shared';
  } catch {
    return 'unsupported';
  }
}
