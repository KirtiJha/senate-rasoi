import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Profile } from './types';

// Device-stored identity (PLAN.md §1): the chef types their name / flat /
// WhatsApp / UPI once; we save it and pre-fill the post form thereafter.

const PROFILE_KEY = 'senate-chef:profile';

const EMPTY: Profile = { chefName: '', flat: '', whatsapp: '', upi: '' };

export async function loadProfile(): Promise<Profile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Profile>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export async function saveProfile(profile: Profile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
