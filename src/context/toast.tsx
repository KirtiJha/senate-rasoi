import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Text } from 'react-native';

interface ToastContextValue {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setMessage(msg);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(
          () => setMessage(null)
        );
      }, 2800);
    },
    [opacity]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {message && (
        <Animated.View
          pointerEvents="none"
          style={{ opacity, transform: [{ translateX: -0.5 }] }}
          className="absolute bottom-24 left-0 right-0 items-center"
        >
          <Text className="overflow-hidden rounded-full bg-ink px-5 py-2.5 text-center text-[13px] font-sans-sb text-bg shadow-card">
            {message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}
