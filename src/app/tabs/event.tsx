import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EventCard } from '../../components/EventCard';
import { Chip, Empty, Loading } from '../../components/ui';
import { fetchEvents } from '../../lib/api';
import { addDays, endOfDay, startOfDay } from '../../lib/format';
import { useLocation, withDistance } from '../../lib/geo';
import { colors } from '../../lib/theme';
import type { AppEvent } from '../../types';
import { EVENT_CATEGORIES } from '../../types';

type When = 'today' | 'week' | 'all';
type Sort = 'popular' | 'rating' | 'nearest' | 'soonest';

const WHEN: { key: When; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'all', label: 'All upcoming' },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: 'popular', label: 'Popular' },
  { key: 'rating', label: 'Top rated' },
  { key: 'nearest', label: 'Nearest' },
  { key: 'soonest', label: 'Soonest' },
];

const NEAR_METERS = 100_000;
const FAR = 1e12;

const COMPARATORS: Record<Sort, (a: AppEvent, b: AppEvent) => number> = {
  popular: (a, b) => b.interested_count - a.interested_count,
  rating: (a, b) => Number(b.rating_avg) - Number(a.rating_avg),
  nearest: (a, b) => (a.distance ?? FAR) - (b.distance ?? FAR),
  soonest: (a, b) => new Date(a.starts_at ?? "").getTime() - new Date(b.starts_at ?? "").getTime(),};

export default function EventsScreen(): React.JSX.Element {
  const router = useRouter();
  const { coords } = useLocation();

  const [when, setWhen] = useState<When>('today');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<Sort>('popular');
  const [nearOnly, setNearOnly] = useState(true);
  const [raw, setRaw] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const now = new Date();
    const from = startOfDay(now);
    const to = when === 'today' ? endOfDay(now) : when === 'week' ? endOfDay(addDays(now, 6)) : undefined;
    try {
      setError(null);
      setRaw(await fetchEvents({ from, to, category: category || undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load events.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [when, category]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const events = useMemo(() => {
let list = withDistance(raw as any, coords) as unknown as (AppEvent & { distance?: number })[];    return [...list].sort(COMPARATORS[sort]);
  }, [raw, coords, sort, nearOnly]);

  const header = (
    <View style={styles.filters}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {WHEN.map((w) => (
          <Chip key={w.key} label={w.label} selected={when === w.key} onPress={() => setWhen(w.key)} />
        ))}
        <Chip label={nearOnly ? 'Near me' : 'Anywhere'} selected={nearOnly} onPress={() => setNearOnly((v) => !v)} />
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="All categories" selected={category === ''} onPress={() => setCategory('')} />
        {EVENT_CATEGORIES.map((c) => (
          <Chip key={c.key} label={c.label} selected={category === c.key} onPress={() => setCategory(c.key)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {SORTS.map((s) => (
          <Chip key={s.key} label={s.label} selected={sort === s.key} onPress={() => setSort(s.key)} />
        ))}
      </ScrollView>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Events</Text>
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <Empty title="No events found" body="Try another day or category, or create the first event." />
          }
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => router.push(`/event/${item.id}` as any)} />
          )}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/create-event' as any)}
        accessibilityRole="button"
        accessibilityLabel="Create an event"
      >
        <Text style={styles.fabText}>+ Create event</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, paddingHorizontal: 16, marginBottom: 4 },
  filters: { marginHorizontal: -16 },
  chipRow: { paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  list: { padding: 16, paddingBottom: 100 },
  separator: { height: 14 },
  error: { color: colors.danger, paddingHorizontal: 16, marginTop: 6 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  fabText: { color: colors.onAccent, fontSize: 15, fontWeight: '700' },
});
