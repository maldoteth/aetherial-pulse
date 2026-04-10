/**
 * View Tracker
 * ============
 * Manages view recording for videos (single) and feed items (batch).
 * Uses Supabase Edge Function `record-post-views` (no external HTTP API).
 */

import { getAuthToken } from '@/lib/api/dehub';
import { supabase } from '@/integrations/supabase/client';

const VIEWED_STORAGE_KEY = 'dehub_viewed_posts';
const VIEW_EXPIRY_MS = 24 * 60 * 60 * 1000;

const BATCH_INTERVAL_MS = 5000;
const MIN_VISIBILITY_MS = 2000;
const MAX_BATCH_SIZE = 50;

interface ViewedRecord {
  tokenId: string;
  timestamp: number;
}

interface BatchViewResponse {
  success: boolean;
  processed: number;
  newUniqueViews?: number;
  rateLimited?: number;
}

interface SingleViewResponse {
  success: boolean;
  isNewView?: boolean;
  views?: number;
  totalImpressions?: number;
}

function getWalletAddress(): string | null {
  try {
    return localStorage.getItem('dehub_wallet');
  } catch {
    return null;
  }
}

function getViewedPosts(): ViewedRecord[] {
  try {
    const data = localStorage.getItem(VIEWED_STORAGE_KEY);
    if (!data) return [];

    const records: ViewedRecord[] = JSON.parse(data);
    const now = Date.now();

    return records.filter((r) => now - r.timestamp < VIEW_EXPIRY_MS);
  } catch {
    return [];
  }
}

function saveViewedPosts(records: ViewedRecord[]): void {
  try {
    localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* ignore */
  }
}

function hasBeenViewed(tokenId: string): boolean {
  const records = getViewedPosts();
  return records.some((r) => r.tokenId === tokenId);
}

function markAsViewed(tokenIds: string[]): void {
  const records = getViewedPosts();
  const now = Date.now();

  for (const tokenId of tokenIds) {
    if (!records.some((r) => r.tokenId === tokenId)) {
      records.push({ tokenId, timestamp: now });
    }
  }

  saveViewedPosts(records);
}

async function invokeRecordViews(tokenIds: number[]): Promise<BatchViewResponse | null> {
  const wallet = getWalletAddress();
  if (!getAuthToken() || !wallet) return null;

  try {
    const { data, error } = await supabase.functions.invoke('record-post-views', {
      body: { tokenIds },
      headers: {
        'x-wallet-address': wallet.toLowerCase(),
      },
    });

    if (error) {
      console.error('[ViewTracker] record-post-views:', error);
      return null;
    }

    return data as BatchViewResponse;
  } catch (error) {
    console.error('[ViewTracker] Batch view error:', error);
    return null;
  }
}

async function recordSingleView(tokenId: string): Promise<SingleViewResponse | null> {
  const n = parseInt(tokenId, 10);
  if (Number.isNaN(n)) return null;

  const result = await invokeRecordViews([n]);
  if (!result?.success) return null;

  return {
    success: true,
    isNewView: true,
    views: undefined,
    totalImpressions: undefined,
  };
}

async function recordBatchViews(tokenIds: number[]): Promise<BatchViewResponse | null> {
  return invokeRecordViews(tokenIds);
}

class VideoViewTracker {
  private watchedVideos = new Set<string>();
  private watchProgress = new Map<string, number>();

  private readonly WATCH_THRESHOLD_PERCENT = 0.1;
  private readonly MIN_WATCH_SECONDS = 3;

  updateProgress(tokenId: string, currentTime: number, duration: number): void {
    if (this.watchedVideos.has(tokenId)) return;

    if (hasBeenViewed(tokenId)) {
      this.watchedVideos.add(tokenId);
      return;
    }

    const previousTime = this.watchProgress.get(tokenId) || 0;
    if (currentTime > previousTime) {
      this.watchProgress.set(tokenId, currentTime);
    }

    const watchedTime = this.watchProgress.get(tokenId) || 0;
    const thresholdSeconds = Math.max(this.MIN_WATCH_SECONDS, duration * this.WATCH_THRESHOLD_PERCENT);

    if (watchedTime >= thresholdSeconds) {
      this.fireView(tokenId);
    }
  }

  private fireView(tokenId: string): void {
    this.watchedVideos.add(tokenId);
    markAsViewed([tokenId]);

    recordSingleView(tokenId).then((result) => {
      if (result?.success) {
        console.debug(`[ViewTracker] Video view recorded: ${tokenId}`, result);
      }
    });
  }

  reset(tokenId: string): void {
    this.watchProgress.delete(tokenId);
  }

  hasViewed(tokenId: string): boolean {
    return this.watchedVideos.has(tokenId) || hasBeenViewed(tokenId);
  }
}

class FeedViewTracker {
  private visibilityStart = new Map<string, number>();
  private pendingViews = new Set<string>();
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private alreadySent = new Set<string>();

  constructor() {
    this.startBatchInterval();
  }

  private startBatchInterval(): void {
    if (this.batchTimer) return;

    this.batchTimer = setInterval(() => {
      void this.flushBatch();
    }, BATCH_INTERVAL_MS);
  }

  onVisible(tokenId: string): void {
    if (this.alreadySent.has(tokenId) || hasBeenViewed(tokenId)) return;

    if (!this.visibilityStart.has(tokenId)) {
      this.visibilityStart.set(tokenId, Date.now());
    }
  }

  onHidden(tokenId: string): void {
    const startTime = this.visibilityStart.get(tokenId);
    if (startTime) {
      const visibleDuration = Date.now() - startTime;

      if (visibleDuration >= MIN_VISIBILITY_MS) {
        if (!this.alreadySent.has(tokenId) && !hasBeenViewed(tokenId)) {
          this.pendingViews.add(tokenId);
        }
      }
    }

    this.visibilityStart.delete(tokenId);
  }

  checkVisibleItems(): void {
    const now = Date.now();

    for (const [tokenId, startTime] of this.visibilityStart) {
      const visibleDuration = now - startTime;

      if (visibleDuration >= MIN_VISIBILITY_MS) {
        if (!this.alreadySent.has(tokenId) && !hasBeenViewed(tokenId)) {
          this.pendingViews.add(tokenId);
        }
      }
    }
  }

  private async flushBatch(): Promise<void> {
    this.checkVisibleItems();

    if (this.pendingViews.size === 0) return;

    if (!getAuthToken()) {
      this.pendingViews.clear();
      return;
    }

    const tokenIds = Array.from(this.pendingViews).slice(0, MAX_BATCH_SIZE);

    for (const id of tokenIds) {
      this.pendingViews.delete(id);
      this.alreadySent.add(id);
    }

    markAsViewed(tokenIds);

    const numericIds = tokenIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n));

    if (numericIds.length === 0) return;

    const result = await recordBatchViews(numericIds);
    if (result?.success) {
      console.debug(`[ViewTracker] Batch views recorded:`, result);
    }
  }

  flush(): void {
    void this.flushBatch();
  }

  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }
}

export const videoViewTracker = new VideoViewTracker();
export const feedViewTracker = new FeedViewTracker();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    feedViewTracker.flush();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      feedViewTracker.flush();
    }
  });
}
