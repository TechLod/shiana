import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatEventTime, labelFor } from '../lib/format';
import { colors } from '../lib/theme';
import type { AppEvent } from '../types';
import { EVENT_CATEGORIES } from '../types';

export function EventCard({ event, onPress }: { event: AppEvent; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {event.cover_url ? <Image source={{ uri: event.cover_url }} style={styles.cover} /> : null}
      <View style={styles.body}>
        <Text style={styles.category}>{labelFor(EVENT_CATEGORIES, event.category ?? "")}</Text>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.line}>{formatEventTime(event.starts_at ?? "")}</Text>
        {event.address ? <Text style={styles.line}>{event.address}</Text> : null}
        <Text style={styles.line}>{event.interested_count} interested</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 14, overflow: 'hidden' },
  cover: { width: '100%', height: 140, backgroundColor: colors.bg },
  body: { padding: 12 },
  category: { fontSize: 12, fontWeight: '700', color: colors.accent },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 2 },
  line: { fontSize: 14, color: colors.sub, marginTop: 2 },
});