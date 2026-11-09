import { useRouter } from 'expo-router';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback } from 'react';
import { Alert, Share } from 'react-native';

import type { Post } from '../types';
import { setFollowing, setLiked } from './api';

/**
 * Shared handlers for a list of posts (feed, single post screen).
 * Likes and follows update on screen immediately and roll back if the server fails.
 */
export function usePostActions(meId: string | undefined, setPosts: Dispatch<SetStateAction<Post[]>>) {
  const router = useRouter();

  const onLike = useCallback(
    async (post: Post) => {
      if (!meId) return;
      const next = !post.liked;
      const apply = (liked: boolean, delta: number) =>
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, liked, like_count: Math.max(0, (p.like_count ?? 0) + delta) } : p,
          ),
        );
      apply(next, next ? 1 : -1);
      try {
        await setLiked(meId, post.id, next);
      } catch {
        apply(post.liked ?? false, next ? -1 : 1);
        Alert.alert('Could not update your like', 'Please try again.');
      }
    },
    [meId, setPosts],
  );

  const onFollow = useCallback(
    async (post: Post) => {
      if (!meId || !post.user_id || post.user_id === meId) return;
      const next = !post.following;
      const apply = (following: boolean) =>
        setPosts((prev) => prev.map((p) => (p.user_id === post.user_id ? { ...p, following } : p)));
      apply(next);
      try {
        await setFollowing(meId, post.user_id as string, next);
      } catch {
        apply(post.following ?? false);
        Alert.alert('Could not update follow', 'Please try again.');
      }
    },
    [meId, setPosts],
  );

  const onShare = useCallback(async (post: Post) => {
    try {
      await Share.share({
        message: `${post.caption ? `${post.caption}\n` : ''}Posted by @${post.author?.username ?? "user"}\n${post.media_url}`,
      });
    } catch {
      // The user closed the share sheet. Nothing to do.
    }
  }, []);

  const onComment = useCallback((post: Post) => router.push(`/comments/${post.id}` as any), [router]);
  const onAuthor = useCallback((post: Post) => router.push(`/user/${post.user_id ?? ""}` as any), [router]);
  const onTag = useCallback(
    (post: Post) => {
      if (post.business) router.push(`/business/${post.business.id}` as any);
      else if (post.event) router.push(`/event/${post.event.id}` as any);
    },
    [router],
  );

  return { onLike, onFollow, onShare, onComment, onAuthor, onTag };
}
