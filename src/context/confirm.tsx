import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { useThemeColors } from '../theme';

/**
 * App-wide confirm dialog — one themed, branded modal that replaces the raw
 * `window.confirm` (ugly on web) and native `Alert.alert`, so confirmations look
 * the same on desktop and mobile. Usage:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Delete?', message: '…', confirmLabel: 'Delete', destructive: true })) { … }
 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const c = useThemeColors();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => { resolver.current = resolve; setOpts(o); }),
    [],
  );

  const close = (v: boolean) => { resolver.current?.(v); resolver.current = null; setOpts(null); };

  const danger = '#DC2626';
  const confirmColor = opts?.destructive ? danger : c.accent;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal visible={!!opts} transparent animationType="fade" onRequestClose={() => close(false)}>
        <Pressable className="flex-1 items-center justify-center px-6" style={{ backgroundColor: '#0008' }} onPress={() => close(false)}>
          <Pressable
            onPress={() => {}}
            style={{ width: '100%', maxWidth: 360, borderRadius: 22, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, padding: 22 }}
          >
            <Text className="font-display-x text-[19px] text-ink">{opts?.title}</Text>
            {opts?.message ? <Text className="mt-2 text-[14px] leading-[20px] text-muted">{opts.message}</Text> : null}
            <View className="mt-5 flex-row justify-end gap-2.5">
              <Pressable onPress={() => close(false)} className="rounded-xl border border-line bg-inset px-4 py-2.5 active:opacity-80">
                <Text className="font-sans-sb text-[14px] text-muted">{opts?.cancelLabel ?? 'Cancel'}</Text>
              </Pressable>
              <Pressable onPress={() => close(true)} className="rounded-xl px-4 py-2.5 active:opacity-85" style={{ backgroundColor: confirmColor }}>
                <Text className="font-sans-sb text-[14px] text-white">{opts?.confirmLabel ?? 'Confirm'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
