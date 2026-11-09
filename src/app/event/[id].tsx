import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ReviewSection } from '../../components/ReviewSection';
import { Button, Empty, Loading } from '../../components/ui';
import { useAuth } from '../../context/Authcontext';
import { fetchEvent, isInterested, logInteraction, setInterested } from '../../lib/api';
import { formatEventTime, labelFor } from '../../lib/format';
import { openDirections } from '../../lib/geo';
import { openContact, openLink } from '../../lib/links';
import { colors } from '../../lib/theme';
import type { AppEvent } from '../../types';
import { EVENT_CATEGORIES } from '../../types';

export default function EventDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [event, setEvent] = useState<AppEvent | null>(null);
  const [interested, setInterestedState] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setEvent(await fetchEvent(id));
    } catch (e) {
      Alert.alert('Could not load this event', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    isInterested(user.id, id)
      .then(setInterestedState)
      .catch(() => undefined);
  }, [user, id]);

  // Remember that this user looked at this kind of event, to improve recommendations.
  const eventId = event?.id;
  const eventCategory = event?.category;
  useEffect(() => {
    if (user && eventId && eventCategory) logInteraction(user.id, 'view', eventCategory);
  }, [user, eventId, eventCategory]);

  const toggleInterested = async () => {
    if (!user || !event) return;
    const next = !interested;
    setInterestedState(next);
    setEvent({ ...event, interested_count: Math.max(0, event.interested_count + (next ? 1 : -1)) });
    try {
      await setInterested(user.id, event.id, next);
    } catch {
      setInterestedState(!next);
      setEvent({ ...event });
      Alert.alert('Could not update', 'Please try again.');
    }
  };

  if (loading) return <Loading />;
  if (!event) return <Empty title="Event not found" />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {event.cover_url ? <Image source={{ uri: event.cover_url }} style={styles.cover} /> : null}

      <Text style={styles.category}>{labelFor(EVENT_CATEGORIES, event.category ?? "")}</Text>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.line}>{formatEventTime(event.starts_at ?? "")}</Text>
      {event.address ? <Text style={styles.line}>{event.address}</Text> : null}
      {event.ticket_price ? <Text style={styles.line}>Tickets: {event.ticket_price}</Text> : null}
      {event.rating_count > 0 ? (
        <Text style={styles.rating}>
          ★ {Number(event.rating_avg).toFixed(1)} ({event.rating_count} reviews)
        </Text>
      ) : null}
      <Text style={styles.line}>{event.interested_count} interested</Text>

      <View style={styles.buttons}>
        <Button
          title={interested ? 'Interested' : "I'm interested"}
          variant={interested ? 'secondary' : 'primary'}
          onPress={toggleInterested}
        />
        {event.latitude !== null && event.longitude !== null ? (
          <Button
            title="Get directions"
            variant="secondary"
            onPress={() => openDirections(event.latitude as number, event.longitude as number)}
          />
        ) : null}
        {event.ticket_url ? <Button title="Get tickets" variant="secondary" onPress={() => openLink(event.ticket_url as string)} /> : null}
        {event.contact ? <Button title="Contact organizer" variant="secondary" onPress={() => openContact(event.contact as string)} /> : null}
      </View>

      {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

      <ReviewSection targetType="event" targetId={event.id} onChanged={load} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48 },
  cover: { width: '100%', height: 200, borderRadius: 14, backgroundColor: colors.card, marginBottom: 16 },
  category: { fontSize: 13, fontWeight: '700', color: colors.accent },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginTop: 2, marginBottom: 8 },
  line: { fontSize: 15, color: colors.sub, marginTop: 2 },
  rating: { fontSize: 15, color: colors.star, marginTop: 2 },
  buttons: { gap: 10, marginTop: 18 },
  description: { fontSize: 15, color: colors.text, lineHeight: 22, marginTop: 20 },
});
