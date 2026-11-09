import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Chip, Empty, Field } from '../components/ui';
import { useAuth } from '../context/Authcontext';
import type { TagResult } from '../lib/api';
import { createPost, createStory, searchTags } from '../lib/api';
import { colors } from '../lib/theme';
import { uploadMedia } from '../lib/upload';
import type { MediaType } from '../types';

function VideoPreview({ uri }: { uri: string }): React.JSX.Element {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={styles.preview} contentFit="cover" nativeControls={false} />;
}

export default function CreatePostScreen(): React.JSX.Element {
  const { uri, type } = useLocalSearchParams<{ uri: string; type: string }>();
  const { user } = useAuth();
  const router = useRouter();

const mediaType: MediaType = type === 'video' ? 'video' : 'image';
  const [destination, setDestination] = useState<'post' | 'story'>('post');
  const [caption, setCaption] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [results, setResults] = useState<TagResult[]>([]);
  const [tag, setTag] = useState<TagResult | null>(null);
  const [posting, setPosting] = useState(false);

  // Search businesses and events to tag, once the user stops typing.
  useEffect(() => {
    if (tag) return;
    const id = setTimeout(() => {
      searchTags(tagQuery)
        .then(setResults)
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(id);
  }, [tagQuery, tag]);

  if (!uri) return <Empty title="Nothing to post" body="Go back and take a photo or video first." />;

  const submit = async () => {
    if (!user) return;
    setPosting(true);
    try {
      const mediaUrl = await uploadMedia(
        user.id,
        uri,
        mediaType as any,
        destination === 'story' ? 'stories' : 'posts',
      );
      if (destination === 'story') {
        await createStory(user.id, mediaUrl, mediaType);
      } else {
        await createPost(user.id, {
          mediaUrl,
          mediaType,
          caption,
          placeName: tag ? tag.label : placeName.trim() || null,
          businessId: tag?.kind === 'business' ? tag.id : null,
          eventId: tag?.kind === 'event' ? tag.id : null,
        });
      }
      router.replace((destination === 'story' ? '/(tabs)' : '/(tabs)/feed') as any);
    } catch (e) {
      Alert.alert('Could not post', e instanceof Error ? e.message : 'Please try again.');
      setPosting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {mediaType === 'video' ? (
          <VideoPreview uri={uri} />
        ) : (
          <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
        )}

        <View style={styles.chipRow}>
          <Chip label="Post to feed" selected={destination === 'post'} onPress={() => setDestination('post')} />
          <Chip label="Add to story" selected={destination === 'story'} onPress={() => setDestination('story')} />
        </View>

        {destination === 'post' ? (
          <>
            <Field label="Caption" value={caption} onChangeText={setCaption} multiline maxLength={300} placeholder="Say something about this moment" />

            {tag ? (
              <View style={styles.tagSelected}>
                <Text style={styles.tagSelectedText} numberOfLines={1}>
                  {tag.kind === 'business' ? 'Business' : 'Event'}: {tag.label}
                </Text>
                <Pressable onPress={() => { setTag(null); setTagQuery(''); }} accessibilityRole="button" accessibilityLabel="Remove tag">
                  <Text style={styles.tagRemove}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Field
                  label="Tag a business or event"
                  value={tagQuery}
                  onChangeText={setTagQuery}
                  placeholder="Search by name"
                  autoCorrect={false}
                />
                {results.map((r) => (
                  <Pressable
                    key={`${r.kind}-${r.id}`}
                    onPress={() => { setTag(r); setResults([]); }}
                    style={styles.result}
                    accessibilityRole="button"
                  >
                    <Text style={styles.resultKind}>{r.kind === 'business' ? 'Business' : 'Event'}</Text>
                    <Text style={styles.resultLabel} numberOfLines={1}>{r.label}</Text>
                  </Pressable>
                ))}
                <Field label="Or add a location name" value={placeName} onChangeText={setPlaceName} placeholder="For example: Hyde Park" maxLength={80} />
              </>
            )}
          </>
        ) : (
          <Text style={styles.note}>Stories disappear after 24 hours.</Text>
        )}

        <Button title={destination === 'story' ? 'Share story' : 'Post'} onPress={submit} loading={posting} style={styles.submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48 },
  preview: { width: '100%', height: 320, borderRadius: 14, backgroundColor: colors.card, marginBottom: 16 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  note: { color: colors.sub, fontSize: 14, marginBottom: 12 },
  tagSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    marginBottom: 14,
    gap: 12,
  },
  tagSelectedText: { flex: 1, color: colors.text, fontSize: 15 },
  tagRemove: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.card,
    marginBottom: 6,
  },
  resultKind: { fontSize: 12, fontWeight: '700', color: colors.accent, width: 64 },
  resultLabel: { flex: 1, color: colors.text, fontSize: 15 },
  submit: { marginTop: 8 },
});
