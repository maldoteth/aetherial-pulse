/**
 * Fansite Subscriptions — Supabase-backed
 */
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionPlanChain { chainId: number; token: string; price: number; isPublished?: boolean; status?: boolean; }
export interface SubscriptionPlan {
  _id?: string; id?: string; address?: string; creatorAddress?: string; name: string;
  description?: string; price?: number; currency?: string; duration: number; tier?: number;
  benefits?: string[]; chains?: SubscriptionPlanChain[]; isActive?: boolean;
  subscriberCount?: number; createdAt?: string; updatedAt?: string;
}
export interface Subscription {
  _id?: string; id?: string; planId: string; plan?: SubscriptionPlan;
  subscriberAddress: string; creatorAddress: string; startDate: string; endDate: string;
  isActive: boolean; autoRenew?: boolean; transactionHash?: string; createdAt?: string;
}

function getWallet(): string {
  return (typeof window !== 'undefined' ? localStorage.getItem('dehub_wallet') : null)?.toLowerCase() || '';
}

function rowToPlan(row: any): SubscriptionPlan {
  return {
    _id: row.id, id: row.id, creatorAddress: row.creator_address,
    name: row.name, description: row.description, price: row.price,
    currency: row.currency, duration: row.duration, tier: row.tier,
    benefits: row.benefits || [], isActive: row.is_active,
    subscriberCount: row.subscriber_count, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function rowToSub(row: any): Subscription {
  return {
    _id: row.id, id: row.id, planId: row.plan_id,
    subscriberAddress: row.subscriber_address, creatorAddress: row.creator_address,
    startDate: row.start_date, endDate: row.end_date, isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function getPlan(planId: string): Promise<SubscriptionPlan> {
  const { data, error } = await supabase.from('subscription_plans').select('*').eq('id', planId).single();
  if (error) throw error;
  return rowToPlan(data);
}

export async function getPlans(creatorAddress?: string): Promise<SubscriptionPlan[]> {
  let q = supabase.from('subscription_plans').select('*').eq('is_active', true);
  if (creatorAddress) q = q.eq('creator_address', creatorAddress.toLowerCase());
  const { data, error } = await q.order('tier', { ascending: true });
  if (error) return [];
  return (data || []).map(rowToPlan);
}

export async function getMyPlans(): Promise<SubscriptionPlan[]> {
  const myAddr = getWallet();
  if (!myAddr) return [];
  const { data } = await supabase.from('subscription_plans').select('*').eq('creator_address', myAddr).order('tier');
  return (data || []).map(rowToPlan);
}

export async function getMySubscriptions(): Promise<Subscription[]> {
  const myAddr = getWallet();
  if (!myAddr) return [];
  const { data } = await supabase.from('subscriptions').select('*').eq('subscriber_address', myAddr).eq('is_active', true);
  return (data || []).map(rowToSub);
}

export async function getSubscription(subscriptionId: string): Promise<Subscription> {
  const { data, error } = await supabase.from('subscriptions').select('*').eq('id', subscriptionId).single();
  if (error) throw error;
  return rowToSub(data);
}

export async function createPlan(planData: any): Promise<SubscriptionPlan> {
  const myAddr = getWallet();
  if (!myAddr) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('subscription_plans')
    .insert({
      creator_address: myAddr,
      name: planData.name,
      description: planData.description,
      duration: planData.duration,
      tier: planData.tier || 1,
      benefits: planData.benefits || [],
      price: planData.chains?.[0]?.price || planData.price || 0,
      currency: planData.currency || 'DHB',
    })
    .select()
    .single();

  if (error) throw error;
  return rowToPlan(data);
}

export async function updatePlan(planId: string, planData: any): Promise<SubscriptionPlan> {
  const updates: any = {};
  if (planData.name !== undefined) updates.name = planData.name;
  if (planData.description !== undefined) updates.description = planData.description;
  if (planData.price !== undefined) updates.price = planData.price;
  if (planData.currency !== undefined) updates.currency = planData.currency;
  if (planData.duration !== undefined) updates.duration = planData.duration;
  if (planData.benefits !== undefined) updates.benefits = planData.benefits;
  if (planData.isActive !== undefined) updates.is_active = planData.isActive;

  const { data, error } = await supabase
    .from('subscription_plans')
    .update(updates)
    .eq('id', planId)
    .select()
    .single();

  if (error) throw error;
  return rowToPlan(data);
}

export async function buyPlan(planId: string): Promise<{ subscription: Subscription; transactionHash?: string }> {
  const myAddr = getWallet();
  if (!myAddr) throw new Error('Not authenticated');

  // Get plan details
  const plan = await getPlan(planId);

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.duration);

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      plan_id: planId,
      subscriber_address: myAddr,
      creator_address: plan.creatorAddress || '',
      start_date: new Date().toISOString(),
      end_date: endDate.toISOString(),
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  // Increment subscriber count
  await supabase.rpc('increment_ticker_search', { p_symbol: 'STUB' }).then(() => {});
  // Update subscriber count directly
  await supabase
    .from('subscription_plans')
    .update({ subscriber_count: (plan.subscriberCount || 0) + 1 })
    .eq('id', planId);

  return { subscription: rowToSub(data) };
}

export async function isSubscribedToCreator(creatorAddress: string): Promise<boolean> {
  const myAddr = getWallet();
  if (!myAddr) return false;

  const { data } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('subscriber_address', myAddr)
    .eq('creator_address', creatorAddress.toLowerCase())
    .eq('is_active', true)
    .gte('end_date', new Date().toISOString())
    .maybeSingle();

  return !!data;
}
