/**
 * Fansite Payments — Stub (on-chain interactions remain client-side)
 */

export interface DPayToken { symbol: string; name: string; address?: string; chainId?: number; decimals?: number; logoUrl?: string; balance?: number; }
export interface DPayTransaction { id: string; type: string; amount: number; currency: string; from: string; to: string; chainId: number; txHash?: string; status: string; createdAt: string; }
export interface DPayTotal { totalVolume?: number; totalTransactions?: number; [key: string]: unknown; }
export interface CheckoutSession { sessionId?: string; url?: string; [key: string]: unknown; }
export interface DHBPriceResponse { price: number; tokenSymbol?: string; currency?: string; change_24h?: number; }
export interface PaginatedTransactions { transactions: DPayTransaction[]; total: number; page: number; hasMore: boolean; }

export async function getDHBPrice(): Promise<DHBPriceResponse> {
  return { price: 0, tokenSymbol: 'DHB', currency: 'USD' };
}
export async function getDHBPriceByChain(chainId: number): Promise<DHBPriceResponse> {
  return { price: 0, tokenSymbol: 'DHB', currency: 'USD' };
}
export async function getAvailableTokens(): Promise<DPayToken[]> { return []; }
export async function getAvailableGas(): Promise<Record<string, unknown>> { return {}; }
export async function getDPayTransactions(params?: any): Promise<PaginatedTransactions> {
  return { transactions: [], total: 0, page: 1, hasMore: false };
}
export async function getAllDPayTransactions(params?: any): Promise<PaginatedTransactions> {
  return { transactions: [], total: 0, page: 1, hasMore: false };
}
export async function getDPayTotal(): Promise<DPayTotal> { return {}; }
export async function createCheckout(body: Record<string, unknown>): Promise<CheckoutSession> { return {}; }
export async function createDPayTicket(body: Record<string, unknown>): Promise<{ result: unknown }> { return { result: null }; }
export async function createOnrampSession(body: Record<string, unknown>): Promise<{ result: unknown }> { return { result: null }; }
