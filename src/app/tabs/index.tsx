import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BusinessCard } from '../../components/BusinessCard';
import { EventCard } from '../../components/EventCard';
import StoriesBar from '../../components/StoriesBar';
import { Button, Empty, Loading } from '../../components/ui';
import { useAuth } from '../../context/Authcontext';
import { fetchBusinesses, fetchEvents, fetchTopCategories } from '../../lib/api';
import { endOfDay, startOfDay } from '../../lib/format';
import { useLocation, withDistance } from '../../lib/geo';
import { colors } from '../../lib/theme';
import type { AppEvent, Business } from '../../types';

const NEARBY_METERS = 100_000;

export default function HomeScreen(): React.JSX.Element {
  const { user } = useAuth();
  const router = useRouter();
  const { coords, city, status, refresh } = useLocation();

  const [rawEvents, setRawEvents] = useState<AppEvent[]>([]);
  const [rawPlaces, setRawPlaces] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [todays, categories] = await Promise.all([
        fetchEvents({ from: startOfDay(), to: endOfDay() }),
        user ? fetchTopCategories(user.id) : Promise.resolve([] as string[]),
      ]);
      let places = categories.length > 0 ? await fetchBusinesses({ categories }) : [];
      if (places.length === 0) places = await fetchBusinesses({});
      setRawEvents(todays);
      setRawPlaces(places);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load what is happening near you.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const events = useMemo(
    () =>
      (withDistance(rawEvents as any, coords) as unknown as (AppEvent & { distance?: number })[])
        .filter((e) => e.distance === undefined || e.distance <= NEARBY_METERS)
        .sort((a, b) => b.interested_count - a.interested_count || (a.distance ?? 0) - (b.distance ?? 0)),
    [rawEvents, coords],
  );

  const places = useMemo(
    () =>
      (withDistance(rawPlaces as any, coords) as unknown as (Business & { distance?: number })[])
        .filter((p) => p.distance === undefined || p.distance <= NEARBY_METERS)
        .sort((a, b) => Number(b.rating_avg) - Number(a.rating_avg) || (a.distance ?? 0) - (b.distance ?? 0))
        .slice(0, 10),
    [rawPlaces, coords],
  );

  const onRefresh = () => {
    setRefreshing(true);
    refresh();
    load();
  };

  if (loading) return <Loading />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{city ? `You are in ${city}` : 'What is happening'}</Text>
        <Text style={styles.subtitle}>Top events and places near you today.</Text>
      </View>

      <StoriesBar />

      {status === 'denied' ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Turn on location to see events and places near you.</Text>
          <Button title="Open settings" variant="secondary" onPress={() => Linking.openSettings()} />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.section}>Top events today</Text>
      {events.length === 0 ? (
        <Empty title="No events today" body="Organizers can add events from the Events tab." />
      ) : (
        <FlatList
          horizontal
          data={events}
          keyExtractor={(e) => e.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hList}
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => router.push(`/event/${item.id}` as any)} />
          )}
        />
      )}

      <Text style={styles.section}>Places for you</Text>
      {places.length === 0 ? (
        <Empty title="No places yet" body="Businesses that join the app will show up here." />
      ) : (
        <FlatList
          horizontal
          data={places}
          keyExtractor={(b) => b.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hList}
          renderItem={({ item }) => (
            <BusinessCard
              business={item}
              style={styles.hCard}
              onPress={() => router.push(`/business/${item.id}` as any)}
            />
          )}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 56, paddingBottom: 32 },
  header: { paddingHorizontal: 16 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.sub, marginTop: 2 },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 16, marginBottom: 10, paddingHorizontal: 16 },
  hList: { paddingHorizontal: 16, gap: 12 },
  hCard: { width: 260 },
  notice: { margin: 16, padding: 14, borderRadius: 12, backgroundColor: colors.card, gap: 10 },
  noticeText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, paddingHorizontal: 16, marginTop: 8 },
});