import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateTimeField } from '../components/DateTimeField';
import { Button, Chip, Field } from '../components/ui';
import { useAuth } from '../context/Authcontext';
import { createEvent } from '../lib/api';
import { cityFromCoords, resolveCoords, useLocation } from '../lib/geo';
import { colors } from '../lib/theme';
import { pickImage, uploadMedia } from '../lib/upload';
import { EVENT_CATEGORIES } from '../types';

const HOUR = 60 * 60 * 1000;

export default function CreateEventScreen(): React.JSX.Element {
  const { user } = useAuth();
  const router = useRouter();
  const { coords } = useLocation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('party');
  const [startsAt, setStartsAt] = useState(() => new Date(Date.now() + 2 * HOUR));
  const [endsAt, setEndsAt] = useState(() => new Date(Date.now() + 5 * HOUR));
  const [address, setAddress] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [contact, setContact] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const changeStart = (date: Date) => {
    setStartsAt(date);
    if (endsAt.getTime() <= date.getTime()) setEndsAt(new Date(date.getTime() + 3 * HOUR));
  };

  const choosePhoto = async () => {
    const uri = await pickImage(false);
    if (uri) setCover(uri);
  };

  const submit = async () => {
    if (!user) return;
    if (!title.trim()) {
      Alert.alert('Add a title', 'Give your event a name.');
      return;
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      Alert.alert('Check the times', 'The event must end after it starts.');
      return;
    }

    setSaving(true);
    try {
      const point = await resolveCoords(address, coords);
      if (!point) {
        Alert.alert('Add a location', 'Enter an address, or allow location access so we can place the event on the map.');
        setSaving(false);
        return;
      }
      const city = await cityFromCoords(point);
      const coverUrl = cover ? await uploadMedia(user.id, cover, 'photo', 'events') : null;

      const id = await createEvent(user.id, {
        title: title.trim(),
        description: description.trim() || null,
        category,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        address: address.trim() || null,
        city,
        latitude: point.latitude,
        longitude: point.longitude,
        cover_url: coverUrl,
        ticket_url: ticketUrl.trim() || null,
        ticket_price: ticketPrice.trim() || null,
        contact: contact.trim() || null,
      });
      router.replace(`/event/${id}` as any);
    } catch (e) {
      Alert.alert('Could not create the event', e instanceof Error ? e.message : 'Please try again.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={choosePhoto} style={styles.cover} accessibilityRole="button">
          {cover ? (
            <Image source={{ uri: cover }} style={styles.coverImage} />
          ) : (
            <Text style={styles.coverText}>Add a cover photo</Text>
          )}
        </Pressable>

        <Field label="Event name" value={title} onChangeText={setTitle} maxLength={80} placeholder="New club launch" />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {EVENT_CATEGORIES.map((c) => (
            <Chip key={c.key} label={c.label} selected={category === c.key} onPress={() => setCategory(c.key)} />
          ))}
        </View>

        <DateTimeField label="Starts" value={startsAt} onChange={changeStart} minimumDate={new Date()} />
        <DateTimeField label="Ends" value={endsAt} onChange={setEndsAt} minimumDate={startsAt} />

        <Field label="Address" value={address} onChangeText={setAddress} placeholder="Street, city" />
        <Field label="Description" value={description} onChangeText={setDescription} multiline maxLength={1000} />
        <Field label="Ticket price (optional)" value={ticketPrice} onChangeText={setTicketPrice} placeholder="Free, or 15 GBP" />
        <Field label="Ticket link (optional)" value={ticketUrl} onChangeText={setTicketUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <Field label="Contact phone or email (optional)" value={contact} onChangeText={setContact} autoCapitalize="none" />

        <Button title="Publish event" onPress={submit} loading={saving} style={styles.submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48 },
  cover: {
    height: 170,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  coverImage: { width: '100%', height: '100%' },
  coverText: { color: colors.sub, fontSize: 15 },
  label: { fontSize: 13, color: colors.sub, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  submit: { marginTop: 8 },
});
