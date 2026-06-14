import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';
import { TILE, tileMath, tileUrl } from '../lib/geo';

/** A small OpenStreetMap tile mosaic centred on the location with a pin. */
export function MapPreview({ lat, lon, height, pinColor = '#E8650A' }: { lat: number; lon: number; height: number; pinColor?: string }) {
  const [w, setW] = useState(0);
  const { zoom, fx, fy, cx, cy } = tileMath(lat, lon, 16);
  const originX = w / 2 - fx * TILE;
  const originY = height / 2 - fy * TILE;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height, overflow: 'hidden', backgroundColor: '#E7E0D8' }}>
      {w > 0
        ? [-1, 0, 1].flatMap((j) =>
            [-1, 0, 1].map((i) => {
              const tx = cx + i;
              const ty = cy + j;
              return (
                <Image
                  key={`${i},${j}`}
                  source={{ uri: tileUrl(zoom, tx, ty) }}
                  style={{ position: 'absolute', width: TILE, height: TILE, left: originX + tx * TILE, top: originY + ty * TILE }}
                />
              );
            }),
          )
        : null}
      <View style={{ position: 'absolute', left: w / 2 - 13, top: height / 2 - 26 }}>
        <Ionicons name="location" size={26} color={pinColor} />
      </View>
    </View>
  );
}
