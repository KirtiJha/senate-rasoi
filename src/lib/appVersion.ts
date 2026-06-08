import { Platform } from 'react-native';
import { supabase } from './supabase';

export interface AppVersion {
  version: string;
  build_number: number;
  force_update: boolean;
  release_notes: string | null;
}

export async function fetchLatestVersion(): Promise<AppVersion | null> {
  const platform = Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android';
  const { data, error } = await supabase
    .from('app_versions')
    .select('version, build_number, force_update, release_notes')
    .in('platform', [platform, 'all'])
    .order('build_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data as AppVersion | null;
}

export function isNewer(fetched: string, current: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const [fa, fb, fc] = parse(fetched);
  const [ca, cb, cc] = parse(current);
  if (fa !== ca) return fa > ca;
  if (fb !== cb) return fb > cb;
  return fc > cc;
}
