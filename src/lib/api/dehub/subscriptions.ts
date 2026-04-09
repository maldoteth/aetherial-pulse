/**
 * Fansite Subscriptions — Stub
 */

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

export async function getPlan(planId: string): Promise<SubscriptionPlan> { return { name: '', duration: 30 }; }
export async function getPlans(creatorAddress?: string): Promise<SubscriptionPlan[]> { return []; }
export async function getMyPlans(): Promise<SubscriptionPlan[]> { return []; }
export async function getMySubscriptions(): Promise<Subscription[]> { return []; }
export async function getSubscription(subscriptionId: string): Promise<Subscription> {
  return { planId: '', subscriberAddress: '', creatorAddress: '', startDate: '', endDate: '', isActive: false };
}
export async function createPlan(planData: any): Promise<SubscriptionPlan> { throw new Error('Subscriptions not yet migrated'); }
export async function updatePlan(planId: string, planData: any): Promise<SubscriptionPlan> { throw new Error('Subscriptions not yet migrated'); }
export async function buyPlan(planId: string): Promise<{ subscription: Subscription; transactionHash?: string }> { throw new Error('Subscriptions not yet migrated'); }
export async function isSubscribedToCreator(creatorAddress: string): Promise<boolean> { return false; }
