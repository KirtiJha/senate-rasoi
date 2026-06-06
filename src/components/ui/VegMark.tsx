import { View } from 'react-native';
import { fixed } from '../../theme';
import type { VegType } from '../../lib/types';

const MARK: Record<VegType, string> = {
  Veg: fixed.veg,
  'Non-veg': fixed.nonveg,
  Egg: fixed.egg,
};

/**
 * The standard Indian veg/non-veg indicator: a bordered square with a filled
 * shape inside (circle for veg/non-veg, used for egg too). A small authentic
 * detail that instantly communicates dietary type.
 */
export function VegMark({ type, size = 16 }: { type: VegType; size?: number }) {
  const color = MARK[type];
  const inner = size * 0.5;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 3,
        borderWidth: 1.5,
        borderColor: color,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: type === 'Egg' ? 2 : inner / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
