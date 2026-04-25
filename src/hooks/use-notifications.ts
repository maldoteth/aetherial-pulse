/**
 * Notifications Hooks
 * ===================
 * React Query hooks for managing user notifications.
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useRef, useEffect } from 'react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type DeHubNotification,
  type NotificationCategory,
  type UnreadNotificationCount,
} from '@/lib/api/dehub';
import { useBrowserNotifications, getLastSeenTimestamp, setLastSeenTimestamp } from '@/hooks/use-browser-notifications';

// Query keys for cache management
export const notificationKeys = {
  all: ['notifications'] as const,
  list: (category?: NotificationCategory) => [...notificationKeys.all, 'list', category] as const,
  unreadCount: () => [...notificationKeys.all, 'unreadCount'] as const,
};

/**
 * Hook to fetch notifications with infinite scroll
 * @param category - Optional category filter (engagement, social, monetization, content, system)
 */
export function useNotifications(category?: NotificationCategory) {
  const { isAuthenticated } = useAuth();
  const { showNotification } = useBrowserNotifications();
  const prevIdsRef = useRef<Set<string>>(new Set());

  const query = useInfiniteQuery({
    queryKey: notificationKeys.list(category),
    queryFn: async ({ pageParam = 1 }) => {
      return getNotifications(pageParam, 30, category, false);
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.hasMore) {
        return allPages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Flatten pages into single array, filtering out any undefined items
  const notifications = query.data?.pages
    .flatMap((page) => page?.items || [])
    .filter((item): item is DeHubNotification => Boolean(item && item.id)) || [];

  // Trigger browser notifications for newly arrived unread items
  useEffect(() => {
    if (!notifications.length) return;
    const lastSeen = getLastSeenTimestamp();
    const isFirstLoad = prevIdsRef.current.size === 0;

    for (const n of notifications) {
      if (prevIdsRef.current.has(n.id)) continue;
      // On first load, just populate the set without showing notifications
      if (!isFirstLoad && !n.read) {
        const createdAt = new Date(n.createdAt || 0).getTime();
        if (createdAt > lastSeen) {
          const title = n.actorUsername || 'DeHub';
          showNotification(title, getNotificationText(n), n.actorAvatar, n.id);
        }
      }
    }

    // Update refs
    prevIdsRef.current = new Set(notifications.map(n => n.id));
    // Update last seen to now
    setLastSeenTimestamp(Date.now());
  }, [notifications, showNotification]);

  return {
    notifications,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    refetch: query.refetch,
  };
}

/**
 * Hook to get unread notification count with category breakdown
 */
export function useUnreadNotificationCount() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: getUnreadNotificationCount,
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes
  });
}

/**
 * Hook for marking a single notification as read
 */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * Hook for marking all notifications as read
 * @param category - Optional: Only mark notifications in this category as read
 */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (category?: NotificationCategory) => markAllNotificationsAsRead(category),
    onMutate: async () => {
      // Optimistically set unread count to 0
      await queryClient.cancelQueries({ queryKey: notificationKeys.unreadCount() });
      const previousCount = queryClient.getQueryData<UnreadNotificationCount>(notificationKeys.unreadCount());
      queryClient.setQueryData<UnreadNotificationCount>(notificationKeys.unreadCount(), {
        total: 0,
        byCategory: { engagement: 0, social: 0, monetization: 0, content: 0, system: 0 },
      });
      return { previousCount };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(notificationKeys.unreadCount(), context.previousCount);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/** Derive a plain-text notification body from the notification type and actor. */
function getNotificationText(n: DeHubNotification): string {
  const actor = n.actorUsername || 'Someone';
  switch (n.type as string) {
    case 'like':
    case 'post_like':
      return `${actor} liked your post`;
    case 'comment':
    case 'post_comment':
      return `${actor} commented on your post`;
    case 'comment_reply':
      return `${actor} replied to your comment`;
    case 'comment_like':
      return `${actor} liked your comment`;
    case 'mention':
      return `${actor} mentioned you in a comment`;
    case 'tip': {
      const amount = n.amount ? ` ${n.amount} ${n.currency || 'Coins'}` : '';
      return `${actor} sent you a tip${amount}`;
    }
    case 'subscription':
      return `${actor} subscribed to your plan`;
    case 'ppv_purchase':
      return `${actor} purchased your content`;
    case 'follow':
    case 'following':
      return `${actor} started following you`;
    case 'follow_request':
      return `${actor} requested to follow you`;
    case 'video_milestone':
      return 'Your post reached a milestone';
    case 'livestream_start':
      return `${actor} started a livestream`;
    case 'video_removal':
      return 'One of your posts was removed';
    case 'feature_request_like':
      return `${actor} liked your feature request`;
    case 'feature_request_comment':
      return `${actor} commented on your feature request`;
    case 'governance_vote':
      return `${actor} voted on your proposal`;
    case 'governance_comment':
      return `${actor} commented on your proposal`;
    default:
      return n.content || 'New notification';
  }
}

// Re-export types for convenience
export type { DeHubNotification, NotificationCategory, UnreadNotificationCount };
