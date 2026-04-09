/**
 * Fansite LiveStream — Stub
 */
import type { DeHubUser } from './types';

export interface LiveStream {
  streamId: string; address: string; title: string; description?: string; category?: string;
  thumbnailUrl?: string; viewerCount: number; likeCount: number;
  status: 'scheduled' | 'live' | 'ended'; scheduledAt?: string; startedAt?: string;
  endedAt?: string; createdAt: string; updatedAt: string; streamer?: DeHubUser; playbackUrl?: string;
}
export interface StreamKeyInfo { streamKey: string; ingestUrl: string; }
export interface StreamActivity {
  id: string; type: 'join' | 'leave' | 'like' | 'gift' | 'comment'; address: string;
  username?: string; avatarUrl?: string; message?: string; giftAmount?: number;
  giftCurrency?: string; timestamp: string;
}
export interface CreateLiveStreamData { title: string; description?: string; category?: string; thumbnailUrl?: string; scheduledAt?: string; }
export interface GetLiveStreamsParams { page?: number; unit?: number; category?: string; sortMode?: 'viewers' | 'recent' | 'popular'; }
export interface StartLiveStreamData { streamId?: string; title?: string; description?: string; category?: string; thumbnailUrl?: string; }
export interface StartLiveStreamResponse { result: { streamId: string; streamKey: string; ingestUrl: string; playbackUrl: string }; }
export interface SendGiftData { amount: number; currency: string; message?: string; }

export async function createLiveStream(data: CreateLiveStreamData): Promise<{ result: LiveStream }> { throw new Error('Not yet migrated'); }
export async function getLiveStreams(params: GetLiveStreamsParams = {}): Promise<{ result: LiveStream[] }> { return { result: [] }; }
export async function getUserLiveStreams(address: string): Promise<{ result: LiveStream[] }> { return { result: [] }; }
export async function getUserScheduledStreams(address: string): Promise<{ result: LiveStream[] }> { return { result: [] }; }
export async function getLiveStream(streamId: string): Promise<{ result: LiveStream }> { throw new Error('Not found'); }
export async function getStreamKey(streamId: string): Promise<{ result: StreamKeyInfo }> { throw new Error('Not yet migrated'); }
export async function getStreamActivities(streamId: string, params?: any): Promise<{ result: StreamActivity[] }> { return { result: [] }; }
export async function getStreamIngestUrl(streamId: string): Promise<{ result: { ingestUrl: string } }> { throw new Error('Not yet migrated'); }
export async function updateStreamSettings(streamId: string, settings: Record<string, unknown>): Promise<{ result: unknown }> { return { result: true }; }
export async function startLiveStream(data: StartLiveStreamData = {}): Promise<StartLiveStreamResponse> { throw new Error('Not yet migrated'); }
export async function likeLiveStream(streamId: string): Promise<{ result: boolean }> { return { result: true }; }
export async function sendLiveStreamGift(streamId: string, data: SendGiftData): Promise<{ result: boolean }> { return { result: true }; }
export async function endLiveStream(streamId: string): Promise<{ result: boolean }> { return { result: true }; }

export const startLivestream = startLiveStream;
export const endLivestream = async () => ({ success: true });

export { getDHBPrice } from './payments';
