import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// Device-token ownership (PLAN.md §4): each device holds one random secret
// token. When you post a dish we store only the SHA-256 hash of token+dishId
// server-side. "Remove" is offered only for dishes this device created, and
// the delete RPC re-checks the hash — so nobody else can delete your post and
// there's no PIN to remember.

const TOKEN_KEY = 'senate-chef:owner-token';
const MY_DISHES_KEY = 'senate-chef:my-dish-ids';

let cachedToken: string | null = null;

/** Returns this device's owner token, generating + persisting one on first use. */
export async function getOwnerToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  let token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = Crypto.randomUUID() + '.' + Crypto.randomUUID();
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }
  cachedToken = token;
  return token;
}

/**
 * The secret presented to the delete RPC for a given dish. Bound to the dish id
 * so leaking one dish's secret can't delete another. The server stores the hash
 * of exactly this string in `owner_token_hash`.
 */
export async function getDishSecret(dishId: string): Promise<string> {
  const token = await getOwnerToken();
  return `${token}:${dishId}`;
}

/** SHA-256 hex of the dish secret — what we send at insert time. */
export async function hashDishSecret(dishId: string): Promise<string> {
  const secret = await getDishSecret(dishId);
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, secret);
}

/** Record that this device owns `dishId` (so we can show "Remove" for it). */
export async function rememberMyDish(dishId: string): Promise<void> {
  const ids = await getMyDishIds();
  if (!ids.includes(dishId)) {
    ids.push(dishId);
    await AsyncStorage.setItem(MY_DISHES_KEY, JSON.stringify(ids));
  }
}

export async function forgetMyDish(dishId: string): Promise<void> {
  const ids = (await getMyDishIds()).filter((id) => id !== dishId);
  await AsyncStorage.setItem(MY_DISHES_KEY, JSON.stringify(ids));
}

export async function getMyDishIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(MY_DISHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
