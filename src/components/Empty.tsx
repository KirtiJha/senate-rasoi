import { ReactNode } from 'react';
import { Text, View } from 'react-native';

export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <View className="items-center px-6 py-16">
      <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-inset">
        <Text style={{ fontSize: 38 }}>{icon}</Text>
      </View>
      <Text className="mb-1.5 font-display text-xl text-ink">{title}</Text>
      {children ? (
        <Text className="mb-5 max-w-xs text-center text-[14px] leading-6 text-muted">{children}</Text>
      ) : null}
      {action}
    </View>
  );
}
