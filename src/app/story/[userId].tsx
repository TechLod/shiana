import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

import { Loading } from '../../components/ui';
import { fetchProfile, fetchUserStories } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import type { Profile, Story } from '../../types';

const PHOTO_SECONDS = 5;

function StoryVideo({ uri, onEnd }: { uri: string; onEnd: () => void }): React.JSX.Element {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const subscription = player.addListener('playToEnd', onEnd);
    return () => subscription.remove();
  }, [player, onEnd]);

  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

export default function StoryViewer(): React.JSX.Element {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();

  const [stories, setStories] = useState<Story[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchUserStories(userId), fetchProfile(userId)])
      .then(([list, p]) => {
        if (!alive) return;
        if (list.length === 0) {
          router.back();
          return;
        }
        setStories(list);
        setProfile(p);
      })
      .catch(() => {
        if (alive) router.back();
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId, router]);

  const current = stories[index];

  const next = useCallback(() => {
    if (index + 1 >= stories.length) router.back();
    else setIndex(index + 1);
  }, [index, stories.length, router]);

  const previous = useCallback(() => {
    if (index > 0) setIndex(index - 1);
  }, [index]);

  // Photos move on by themselves after a few seconds. Videos move on when they finish.
  useEffect(() => {
    if (!current || current.media_type !== 'photo') return;
    const id = setTimeout(next, PHOTO_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [current, next]);

  if (loading || !current) return <Loading />;

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      {current.media_type === 'video' ? (
       <StoryVideo key={current.id} uri={current.media_url ?? ""} onEnd={next} />
      ) : (
        <Image source={{ uri: current.media_url ?? ""}} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}

      <Pressable style={styles.tapLeft} onPress={previous} accessibilityRole="button" accessibilityLabel="Previous story" />
      <Pressable style={styles.tapRight} onPress={next} accessibilityRole="button" accessibilityLabel="Next story" />

      <SafeAreaView style={styles.top} pointerEvents="box-none">
        <View style={styles.bars}>
          {stories.map((s, i) => (
            <View key={s.id} style={[styles.bar, i <= index && styles.barOn]} />
          ))}
        </View>
        <View style={styles.header}>
          <Text style={styles.name}>
            @{profile?.username ?? ''} <Text style={styles.time}>{timeAgo(current.created_at ?? "")}</Text>
          </Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  tapLeft: { position: 'absolute', left: 0, top: 80, bottom: 0, width: '30%' },
  tapRight: { position: 'absolute', right: 0, top: 80, bottom: 0, width: '70%' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 12, paddingHorizontal: 12 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  barOn: { backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  name: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  time: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.75)' },
  close: { fontSize: 22, color: '#FFFFFF', padding: 4 },
});
