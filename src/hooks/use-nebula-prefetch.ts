/**
 * Nebula Prefetch Hook
 * ====================
 * Triggers feed data prefetch on first user interaction with the nebula hero.
 * This ensures the app content is already cached when the user clicks X to enter.
 * 
 * Listens for: mousemove, touchstart, scroll, wheel
 * Fires once per session, does not slow down initial nebula load.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { searchNFTs } from '@/lib/api/dehub';

const PREFETCH_TRIGGERED_KEY = 'nebula-prefetch-triggered';

async function fetchFeedUnified(postTypeKey: string | undefined, limit = 20) {
  const map: Record<string, string> = {
    video: 'video',
    'feed-images': 'image',
    'feed-simple': 'text',
  };
  const pt = postTypeKey ? map[postTypeKey] : undefined;
  const res = await searchNFTs({
    page: 0,
    unit: limit,
    ...(pt ? { postType: pt } : {}),
  });
  return { result: res.data, pagination: { total: res.total, page: res.page + 1 } };
}

/**
 * Prefetch the home feed's 3 interleaved queries (video, images, text)
 * to match what HomeFeed.tsx renders by default.
 */
async function prefetchHomeFeed(queryClient: ReturnType<typeof useQueryClient>) {
  try {
    const [videosRes, imagesRes, textsRes, unifiedHomeRes] = await Promise.allSettled([
      fetchFeedUnified('video', 20),
      fetchFeedUnified('feed-images', 20),
      fetchFeedUnified('feed-simple', 20),
      fetchFeedUnified(undefined, 20),
    ]);

    const baseParams = {
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
      range: undefined,
      status: 'minted' as const,
      category: undefined,
      isPPV: undefined,
      hasBounty: undefined,
      isLocked: undefined,
    };

    const cacheResult = (result: PromiseSettledResult<any>, postType: string, limit = 20) => {
      if (result.status !== 'fulfilled' || !result.value) return;
      const response = result.value;
      const params = { ...baseParams, postType };
      queryClient.setQueryData(
        ['unified-feed', params, limit],
        {
          pages: [{ items: response.result || [], pagination: response.pagination, page: 1 }],
          pageParams: [1],
        }
      );
      console.log(`[Nebula Prefetch] ${postType} cached:`, (response.result || []).length, 'items');
    };

    cacheResult(videosRes, 'video');
    cacheResult(imagesRes, 'feed-images');
    cacheResult(textsRes, 'feed-simple');
    
    // Scroll carousel: reuse the video data (same endpoint, just sliced)
    if (videosRes.status === 'fulfilled' && videosRes.value) {
      const scrollParams = {
        postType: 'video',
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
        status: 'minted' as const,
      };
      queryClient.setQueryData(
        ['unified-feed', scrollParams, 10],
        {
          pages: [{ items: (videosRes.value.result || []).slice(0, 10), pagination: videosRes.value.pagination, page: 1 }],
          pageParams: [1],
        }
      );
    }

    // Unified home feed (no postType) - matches HomeFeed "Latest" query key exactly
    if (unifiedHomeRes.status === 'fulfilled' && unifiedHomeRes.value) {
      const homeFeedParams = {
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
        range: undefined,
        isPPV: undefined,
        hasBounty: undefined,
        isLocked: undefined,
        status: 'minted' as const,
        category: undefined,
        followingOnly: undefined,
        postType: undefined,
      };
      queryClient.setQueryData(
        ['unified-feed', homeFeedParams, 20],
        {
          pages: [{ items: unifiedHomeRes.value.result || [], pagination: unifiedHomeRes.value.pagination, page: 1 }],
          pageParams: [1],
        }
      );
      console.log('[Nebula Prefetch] Unified home feed cached:', (unifiedHomeRes.value.result || []).length, 'items');
    }

    console.log('[Nebula Prefetch] Home feeds cached successfully');
  } catch (e) {
    console.warn('[Nebula Prefetch] Home feed prefetch failed:', e);
  }
}

export function useNebulaPrefetch() {
  const queryClient = useQueryClient();
  const hasFiredRef = useRef(false);

  useEffect(() => {
    // Skip if already prefetched this session
    if (sessionStorage.getItem(PREFETCH_TRIGGERED_KEY)) return;

    const triggerPrefetch = () => {
      if (hasFiredRef.current) return;
      hasFiredRef.current = true;

      // Remove listeners immediately
      cleanup();

      console.log('[Nebula Prefetch] User interaction detected, starting prefetch...');
      sessionStorage.setItem(PREFETCH_TRIGGERED_KEY, 'true');

      // Fire home feed prefetch only — no longer calling prefetchAllFeeds to avoid 429s
      prefetchHomeFeed(queryClient);
    };

    const events = ['mousemove', 'touchstart', 'scroll', 'wheel'] as const;
    
    events.forEach(evt => {
      window.addEventListener(evt, triggerPrefetch, { once: true, passive: true });
    });

    const cleanup = () => {
      events.forEach(evt => {
        window.removeEventListener(evt, triggerPrefetch);
      });
    };

    return cleanup;
  }, [queryClient]);
}
