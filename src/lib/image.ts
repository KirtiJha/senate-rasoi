// Shared image helpers for expo-image.
//
// We don't store a per-photo blurhash, so we use one neutral placeholder hash
// (the generic example from the expo-image docs) for a soft blur-up while the
// real photo decodes. Combined with the memory+disk cache, images paint once
// and reload instantly on revisits.

/** Generic neutral blurhash shown under photos while they decode. */
export const BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

/** Spread onto an <Image> for cached, smoothly-faded-in remote photos. */
export const IMAGE_CACHE_PROPS = {
  cachePolicy: 'memory-disk',
  transition: 200,
  placeholder: { blurhash: BLURHASH },
} as const;
