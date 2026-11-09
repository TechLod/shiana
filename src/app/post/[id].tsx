import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { PostCard } from '../../components/Postcard';
import { Empty, Loading } from '../../components/ui';
import { useAuth } from '../../context/Authcontext';
import { fetchPost } from '../../lib/api';
import { usePostActions } from '../../lib/usePostActions';
import type { Post } from '../../types';

export default function PostScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [height, setHeight] = useState(0);
  const actions = usePostActions(user?.id, setPosts);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchPost(user.id, id)
      .then((post) => {
        if (alive) setPosts([post]);
      })
      .catch((e: unknown) => {
        Alert.alert('Could not load this post', e instanceof Error ? e.message : 'Please try again.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user, id]);

  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);

  return (
    <View style={styles.screen} onLayout={onLayout}>
      {loading ? (
        <Loading />
      ) : posts.length === 0 ? (
        <Empty title="Post not found" />
      ) : height > 0 ? (
        <PostCard
          post={posts[0]}
          height={height}
          active
          meId={user?.id}
          onLike={actions.onLike}
          onFollow={actions.onFollow}
          onComment={actions.onComment}
          onShare={actions.onShare}
          onAuthor={actions.onAuthor}
          onTag={actions.onTag}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
});
