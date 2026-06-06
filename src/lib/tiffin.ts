import { COMMUNITY_ID, supabase } from './supabase';
import type {
  Slot,
  Subscription,
  SubscriptionWithPlan,
  TiffinDayRow,
  TiffinPlan,
  TiffinPlanWithChef,
  VegType,
} from './types';

// ── Plans ───────────────────────────────────────────────────────────
export interface NewTiffinPlan {
  chefUserId: string;
  title: string;
  description: string;
  vegType: VegType;
  slot: Slot;
  price: number;
  daysOfWeek: number[];
  maxPerDay: number;
  cutoffTime: string | null;
}

export async function listTiffinPlans(): Promise<TiffinPlanWithChef[]> {
  const { data, error } = await supabase
    .from('tiffin_plans')
    .select('*, chef:profiles!tiffin_plans_chef_user_id_fkey(name,flat,whatsapp)')
    .eq('community_id', COMMUNITY_ID)
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TiffinPlanWithChef[];
}

export async function listMyTiffinPlans(userId: string): Promise<TiffinPlan[]> {
  const { data, error } = await supabase
    .from('tiffin_plans')
    .select('*')
    .eq('chef_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TiffinPlan[];
}

export async function createTiffinPlan(input: NewTiffinPlan): Promise<TiffinPlan> {
  const row = {
    community_id: COMMUNITY_ID,
    chef_user_id: input.chefUserId,
    title: input.title.trim(),
    description: input.description.trim() || null,
    veg_type: input.vegType,
    slot: input.slot,
    price: input.price,
    days_of_week: input.daysOfWeek,
    max_per_day: input.maxPerDay,
    cutoff_time: input.cutoffTime,
  };
  const { data, error } = await supabase.from('tiffin_plans').insert(row).select().single();
  if (error) throw error;
  return data as TiffinPlan;
}

export async function setPlanActive(planId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('tiffin_plans').update({ active }).eq('id', planId);
  if (error) throw error;
}

export async function deleteTiffinPlan(planId: string): Promise<void> {
  const { error } = await supabase.from('tiffin_plans').delete().eq('id', planId);
  if (error) throw error;
}

// ── Subscriptions (recurring orders) ────────────────────────────────
export async function subscribe(
  planId: string,
  userId: string,
  qty: number,
  startDate: string
): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      { plan_id: planId, subscriber_user_id: userId, qty, start_date: startDate, paused: false, end_date: null },
      { onConflict: 'plan_id,subscriber_user_id' }
    );
  if (error) throw error;
}

export async function listMySubscriptions(userId: string): Promise<SubscriptionWithPlan[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, plan:tiffin_plans(*, chef:profiles!tiffin_plans_chef_user_id_fkey(name,flat,whatsapp))')
    .eq('subscriber_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SubscriptionWithPlan[];
}

export async function setSubscriptionPaused(subId: string, paused: boolean): Promise<void> {
  const { error } = await supabase.from('subscriptions').update({ paused }).eq('id', subId);
  if (error) throw error;
}

export async function cancelSubscription(subId: string): Promise<void> {
  const { error } = await supabase.from('subscriptions').delete().eq('id', subId);
  if (error) throw error;
}

export async function myActiveSubscriptionIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan_id')
    .eq('subscriber_user_id', userId);
  return new Set((data ?? []).map((r: { plan_id: string }) => r.plan_id));
}

// ── Chef's per-day list (computed, no cron) ─────────────────────────
export async function chefTiffinForDate(dateStr: string): Promise<TiffinDayRow[]> {
  const { data, error } = await supabase.rpc('chef_tiffin_for_date', { p_date: dateStr });
  if (error) throw error;
  return (data ?? []) as TiffinDayRow[];
}

export function todayStr(): string {
  return new Date().toLocaleDateString('en-CA');
}
