import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { memo, useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCount } from '../lib/format';
import { colors } from '../lib/theme';
import type { Post } from '../types';
import { Avatar } from './ui';

interface Props {
  post: Post;
  height: number;
  /** True only for the post that is on screen, so only that video plays. */
  active: boolean;
  meId?: string;
  onLike: (post: Post) => void;
  onFollow: (post: Post) => void;
  onComment: (post: Post) => void;
  onShare: (post: Post) => void;
  onAuthor: (post: Post) => void;
  onTag: (post: Post) => void;
}

const LIKE_RED = '#FF4D6D';

export const PostCard = memo(function PostCard({
  post,
  height,
  active,
  meId,
  onLike,
  onFollow,
  onComment,
  onShare,
  onAuthor,
  onTag,
}: Props): React.ReactElement {
  const isVideo = post.media_type === 'video';
  const player = useVideoPlayer(isVideo ? post.media_url ?? "" : null, (p: any) => {
    p.loop = true;
  });

  useEffect(() => {
    if (!isVideo) return;
    if (active) player.play();
    else player.pause();
  }, [active, isVideo, player]);

  const tagLabel = post.business?.name ?? post.event?.title ?? post.place_name;
  const canOpenTag = Boolean(post.business || post.event);

  return (
    <View style={[styles.container, { height }]}>
      {isVideo ? (
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      ) : (
        <Image source={{ uri: post.media_url ?? "" }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}

      <View style={styles.rail}>
        <View style={styles.avatarWrap}>
          <Pressable onPress={() => onAuthor(post)} accessibilityRole="button" accessibilityLabel="Open profile">
            <Avatar uri={post.author?.avatar_url ?? ""} name={post.author?.username ?? ""} size={48} />
          </Pressable>
          {meId !== post.user_id && !post.following ? (
            <Pressable
              onPress={() => onFollow(post)}
              style={styles.followBadge}
              accessibilityRole="button"
              accessibilityLabel="Follow"
            >
              <Ionicons name="add" size={16} color={'#FFFFFF'} />
            </Pressable>
          ) : null}
        </View>

        <Pressable onPress={() => onLike(post)} style={styles.railButton} accessibilityRole="button" accessibilityLabel="Like">
          <Ionicons
            name={post.liked ? 'heart' : 'heart-outline'}
            size={34}
            color={post.liked ? LIKE_RED : '#FFFFFF'}
          />
          <Text style={styles.railText}>{formatCount(post.like_count ?? 0)}</Text>
        </Pressable>

        <Pressable onPress={() => onComment(post)} style={styles.railButton} accessibilityRole="button" accessibilityLabel="Comments">
          <Ionicons name="chatbubble-ellipses-outline" size={32} color="#FFFFFF" />
          <Text style={styles.railText}>{formatCount(post.comment_count ?? 0)}</Text>
        </Pressable>

        <Pressable onPress={() => onShare(post)} style={styles.railButton} accessibilityRole="button" accessibilityLabel="Share">
          <Ionicons name="arrow-redo-outline" size={32} color="#FFFFFF" />
          <Text style={styles.railText}>Share</Text>
        </Pressable>
      </View>

      <View style={styles.info}>
        <Pressable onPress={() => onAuthor(post)}>
          <Text style={styles.username}>@{post.author?.username ?? ""}</Text>
        </Pressable>
        {post.caption ? (
          <Text style={styles.caption} numberOfLines={3}>
            {post.caption}
          </Text>
        ) : null}
        {tagLabel ? (
          <Pressable
            onPress={() => onTag(post)}
            disabled={!canOpenTag}
            style={styles.tag}
            accessibilityRole={canOpenTag ? 'button' : 'text'}
          >
            <Ionicons name="location-outline" size={14} color="#FFFFFF" />
            <Text style={styles.tagText} numberOfLines={1}>
              {tagLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { width: '100%', backgroundColor: '#000000' },
  rail: { position: 'absolute', right: 12, bottom: 28, alignItems: 'center', gap: 18 },
  avatarWrap: { marginBottom: 6 },
  followBadge: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railButton: { alignItems: 'center', gap: 2 },
  railText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  info: {
    position: 'absolute',
    left: 14,
    right: 84,
    bottom: 28,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 6,
  },
  username: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  caption: { fontSize: 14, color: '#FFFFFF', lineHeight: 19 },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tagText: { fontSize: 13, color: '#FFFFFF', maxWidth: 200 },
});
