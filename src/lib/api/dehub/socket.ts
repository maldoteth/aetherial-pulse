/**
 * LiveChat Realtime — Supabase Realtime replacement for Socket.IO
 * Uses community_chat_messages table with realtime subscription.
 */
import { supabase } from '@/integrations/supabase/client';

// No-op socket stubs — all functionality now goes through Supabase
type AnyFn = (...args: any[]) => void;
const listeners = new Map<string, Set<AnyFn>>();
let channelActive = false;

function ensureChannel() {
  if (channelActive) return;
  channelActive = true;

  supabase
    .channel('livechat-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_chat_messages' }, (payload) => {
      listeners.get('newMessage')?.forEach(cb => cb(payload.new));
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'community_chat_messages' }, (payload) => {
      listeners.get('messageDeleted')?.forEach(cb => cb({ messageId: (payload.old as any)?.id }));
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_chat_messages' }, (payload) => {
      listeners.get('reactionUpdated')?.forEach(cb => cb(payload.new));
    })
    .subscribe();
}

function addListener(event: string, cb: AnyFn): () => void {
  ensureChannel();
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(cb);
  return () => { listeners.get(event)?.delete(cb); };
}

// Stubs for backward compat
export function getSocket(): any { return null; }
export function joinRoom(_roomId?: string) {}
export function leaveRoom(_roomId?: string) {}
export function emitSendMessage(_payload: any) {}
export function emitAddReaction(_roomId: string, _messageId: string, _emoji: string) {}
export function emitRemoveReaction(_roomId: string, _messageId: string, _emoji: string) {}
export function emitTyping(_isTyping: boolean) {}
export function emitPing() {}
export function disconnectSocket() {}
export function requestMessageHistory(_roomId: string, _limit?: number): Promise<unknown[]> { return Promise.resolve([]); }

export function onLiveChatMessage(cb: (msg: unknown) => void): () => void { return addListener('newMessage', cb); }
export function onRoomJoined(cb: (data: any) => void): () => void { return addListener('roomJoined', cb); }
export function onMessageDeleted(cb: (data: { messageId: string }) => void): () => void { return addListener('messageDeleted', cb); }
export function onReactionUpdated(cb: (data: unknown) => void): () => void { return addListener('reactionUpdated', cb); }
export function onUserBanned(cb: (data: { message: string }) => void): () => void { return addListener('userBanned', cb); }
export function onUserUnbanned(cb: (data: { message: string }) => void): () => void { return addListener('userUnbanned', cb); }
export function debugSocketEvents(): () => void { return () => {}; }

export const MSG_EVENTS = ['newMessage'] as const;
export const PRESENCE_EVENTS = ['userJoined', 'userLeft'] as const;
