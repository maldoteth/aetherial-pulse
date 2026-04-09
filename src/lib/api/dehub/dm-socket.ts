/**
 * DM Realtime — Supabase Realtime replacement for Socket.IO
 * Listens for postgres_changes on dm_messages table.
 */
import { supabase } from '@/integrations/supabase/client';
import type { DmMessage, DmMsgType, DmConversation } from './dm';
import { createConversation } from './dm';

// ─── Types (kept for backward compat) ─────────────────────────────────────────

export interface SendMessagePayload {
  dmId: string; content: string; type: DmMsgType;
  gif?: string; replyTo?: string; txHash?: string; tipTxHash?: string; voiceDuration?: number;
}

export interface EditedMessage { _id: string; dmId: string; content: string; editedAt: string; }
export interface DeletedMessage { _id: string; dmId: string; }
export interface ReadReceiptData { dmId: string; readBy?: string; count?: number; userId?: string; readAt?: string; }
export interface ConversationDeletedData { dmId: string; }
export interface FeeConfirmedData { dmId: string; messageId: string; txHash: string; }
export interface DmSocketError { message?: string; msg?: string; code?: string; fee?: number; }
export interface ReValidateMessageData { dmId: string; message: DmMessage; }

// ─── Realtime subscription ────────────────────────────────────────────────────

type AnyFn = (...args: any[]) => void;
const listeners = new Map<string, Set<AnyFn>>();
let channelActive = false;

function getWallet(): string {
  return (typeof window !== 'undefined' ? localStorage.getItem('dehub_wallet') : null)?.toLowerCase() || '';
}

function ensureChannel() {
  if (channelActive) return;
  channelActive = true;

  supabase
    .channel('dm-messages-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages' }, (payload) => {
      const row = payload.new as any;
      const myAddr = getWallet();
      if (!myAddr) return;

      const msg: DmMessage = {
        _id: row.id,
        conversation: row.conversation_id,
        sender: { _id: row.sender_address, username: '', address: row.sender_address, displayName: '', avatarImageUrl: '' },
        content: row.content || '',
        msgType: (row.msg_type || 'msg') as DmMsgType,
        mediaUrls: row.media_url ? [{ url: row.media_url, type: 'image' }] : [],
        voiceDuration: row.voice_duration ?? null,
        isRead: row.is_read ?? false,
        isEdited: false, editedAt: null, isForwarded: false, replyTo: null,
        paymentStatus: null, paymentTxHash: null,
        tipAmount: row.tip_amount ?? null, tipSymbol: null,
        isDeleted: row.is_deleted ?? false,
        author: row.sender_address.toLowerCase() === myAddr ? 'me' : 'other',
        createdAt: row.created_at, updatedAt: row.created_at,
      };

      listeners.get('sendMessage')?.forEach(cb => cb(msg));
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dm_messages' }, (payload) => {
      const row = payload.new as any;
      if (row.is_deleted) {
        listeners.get('deleteMessage')?.forEach(cb => cb({ _id: row.id, dmId: row.conversation_id }));
      }
      if (row.is_read) {
        listeners.get('readReceipt')?.forEach(cb => cb({ dmId: row.conversation_id }));
      }
    })
    .subscribe();
}

function addListener(event: string, cb: AnyFn): () => void {
  ensureChannel();
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(cb);
  return () => { listeners.get(event)?.delete(cb); };
}

// ─── Public API (same signatures as old socket module) ────────────────────────

export async function emitCreateAndStart(userId: string): Promise<DmConversation> {
  const conv = await createConversation(userId);
  return {
    _id: conv.id,
    participants: [],
    lastMessageAt: conv.updatedAt,
    unreadCount: 0,
    messages: [],
    tips: [],
  };
}

export function emitSendMessage(payload: SendMessagePayload): void {
  // Messages are sent via REST (sendMessageToConversation), not socket.
  // This is kept for backward compat — the hook calls sendMessageToConversation directly.
  import('./dm').then(mod => {
    mod.sendMessageToConversation(payload.dmId, payload.content, payload.type, {
      replyToId: payload.replyTo,
    }).catch(err => console.error('[DM] emitSendMessage failed:', err));
  });
}

export function emitReadReceipt(dmId: string): void {
  import('./dm').then(mod => mod.markConversationAsRead(dmId));
}

export function emitDeleteMessage(_dmId: string, _messageId: string): void {}
export function emitDownloadReceipt(_dmId: string, _messageId: string): void {}

export function onDmSendMessage(cb: (msg: DmMessage) => void): () => void { return addListener('sendMessage', cb); }
export function onEditMessage(cb: (data: EditedMessage) => void): () => void { return addListener('editMessage', cb); }
export function onDmDeleteMessage(cb: (data: DeletedMessage) => void): () => void { return addListener('deleteMessage', cb); }
export function onReadReceipt(cb: (data: ReadReceiptData) => void): () => void { return addListener('readReceipt', cb); }
export function onConversationDeleted(cb: (data: ConversationDeletedData) => void): () => void { return addListener('conversationDeleted', cb); }
export function onFeeConfirmed(cb: (data: FeeConfirmedData) => void): () => void { return addListener('feeConfirmed', cb); }
export function onReValidateMessage(cb: (data: ReValidateMessageData) => void): () => void { return addListener('ReValidateMessage', cb); }
export function onDmError(cb: (err: DmSocketError) => void): () => void { return addListener('error', cb); }

export function reconnectDmSocket(): void {}
export function disconnectDmSocket(): void {}
