import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../context/Authcontext';
import { fetchReviews, upsertReview } from '../lib/api';
import { timeAgo } from '../lib/format';
import { colors } from '../lib/theme';
import type { Review, ReviewTarget } from '../types';
import { Avatar, Button, Field } from './ui';

const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(5 - n);

/** Lets users rate and review an event or a business, and shows other reviews. */
export function ReviewSection({
  targetType,
  targetId,
  onChanged,
}: {
  targetType: ReviewTarget;
  targetId: string;
  onChanged?: () => void;
}): React.JSX.Element {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const list = await fetchReviews(targetType, targetId);
    setReviews(list);
    const mine = list.find((r) => r.user_id === user?.id);
    if (mine) {
      setRating(mine.rating);
      setComment(mine.comment ?? '');
    }
  }, [targetType, targetId, user?.id]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const save = async () => {
    if (!user || rating < 1) {
      Alert.alert('Choose a rating', 'Tap the stars to rate from 1 to 5.');
      return;
    }
    setSaving(true);
    try {
      await upsertReview(user.id, targetType, targetId, rating, comment);
      await load();
      onChanged?.();
    } catch (e) {
      Alert.alert('Could not save your review', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Ratings and reviews</Text>

      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="button" accessibilityLabel={`${n} stars`}>
            <Text style={[styles.star, n <= rating && styles.starOn]}>{n <= rating ? '★' : '☆'}</Text>
          </Pressable>
        ))}
      </View>

      <Field label="Your review (optional)" value={comment} onChangeText={setComment} multiline maxLength={400} />
      <Button title="Save review" onPress={save} loading={saving} />

      {reviews.map((r) => (
        <View key={r.id} style={styles.review}>
          <Avatar uri={r.author?.avatar_url ?? ""} name={r.author?.username ?? ""} />
          <View style={styles.reviewBody}>
            <Text style={styles.reviewName}>
             <Text>{r.author?.username ?? ""} ... {timeAgo(r.created_at ?? "")}</Text>
            </Text>
            <Text style={styles.reviewStars}>{stars(r.rating)}</Text>
            {r.comment ? <Text style={styles.reviewText}>{r.comment}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24 },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
  starRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  star: { fontSize: 34, color: colors.sub },
  starOn: { color: colors.star },
  review: { flexDirection: 'row', gap: 10, marginTop: 16 },
  reviewBody: { flex: 1, gap: 2 },
  reviewName: { fontSize: 14, fontWeight: '600', color: colors.text },
  reviewTime: { fontSize: 12, fontWeight: '400', color: colors.sub },
  reviewStars: { fontSize: 14, color: colors.star },
  reviewText: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
