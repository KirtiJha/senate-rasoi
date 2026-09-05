import * as Updates from 'expo-updates';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { captureException } from '../lib/crash';

/**
 * The screen a resident sees instead of a white void.
 *
 * There was no boundary anywhere, so a render error on one tile unmounted the
 * whole app — no message, no way back, the phone showing the app icon and a
 * blank page. This catches it, reports it, and offers the two honest options:
 * try that screen again, or start the app over.
 *
 * Deliberately plain React Native, no theme hooks, no NativeWind: if the
 * failure is IN the theme or the style runtime, this must still draw.
 */
type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    captureException(error, { source: 'AppErrorBoundary', componentStack: info.componentStack });
  }

  private retry = () => this.setState({ error: null });

  private restart = async () => {
    if (Platform.OS === 'web') {
      (globalThis as unknown as { location?: { reload: () => void } }).location?.reload();
      return;
    }
    try { await Updates.reloadAsync(); } catch { this.retry(); }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={{ flex: 1, backgroundColor: '#F1F3EE', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <View style={{ maxWidth: 360, width: '100%' }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#141915', marginBottom: 8 }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 22, color: '#5A6159', marginBottom: 22 }}>
            This screen hit a problem it couldn't recover from. Nothing you did caused it, and
            nothing has been lost — try again, or restart Aangan.
          </Text>
          <Pressable
            onPress={this.retry}
            accessibilityRole="button"
            style={{ backgroundColor: '#0E6B4E', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 10 }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Try again</Text>
          </Pressable>
          <Pressable
            onPress={this.restart}
            accessibilityRole="button"
            style={{ borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: '#C7CCC0' }}
          >
            <Text style={{ color: '#141915', fontSize: 15, fontWeight: '600' }}>Restart Aangan</Text>
          </Pressable>
          {__DEV__ ? (
            <Text style={{ marginTop: 18, fontSize: 11, color: '#686F66', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) }}>
              {String(this.state.error?.message ?? this.state.error)}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }
}
