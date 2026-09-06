import { ReactNode } from 'react';
import { RefreshControl, RefreshControlProps } from 'react-native';
import { useThemeColors } from '../../theme';

/**
 * Pull-to-refresh, the same everywhere.
 *
 * It worked on nine screens out of the sixty-five that scroll, and on the
 * other fifty-six the gesture did nothing at all — which is worse than not
 * offering it, because a list that ignores a pull reads as frozen rather
 * than as current. Every cached list already has a `load` that invalidates
 * its query and a `fetching` flag; this turns that pair into the control.
 *
 *   <ScrollView refreshControl={<Refresher onRefresh={load} busy={fetching} />}>
 *
 * IT MUST FORWARD CHILDREN AND PROPS. On web, ScrollView renders its content
 * by cloning whatever it was handed as `refreshControl` and passing the whole
 * scroll body in as children — so a wrapper that ignores them silently drops
 * the entire screen below the header. That is exactly what happened here:
 * six list screens rendered their chrome and nothing else, with no error.
 */
export function Refresher({
  onRefresh,
  busy,
  children,
  ...rest
}: Omit<RefreshControlProps, 'refreshing' | 'onRefresh'> & {
  onRefresh: () => void;
  busy?: boolean;
  children?: ReactNode;
}) {
  const c = useThemeColors();
  return (
    <RefreshControl
      refreshing={!!busy}
      onRefresh={onRefresh}
      tintColor={c.accent}
      colors={[c.accent]}
      progressBackgroundColor={c.surface}
      {...rest}
    >
      {children}
    </RefreshControl>
  );
}
