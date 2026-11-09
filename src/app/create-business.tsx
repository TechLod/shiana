import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Chip, Field } from '../components/ui';
import { useAuth } from '../context/Authcontext';
import { createBusiness } from '../lib/api';
import { cityFromCoords, resolveCoords, useLocation } from '../lib/geo';
import { colors } from '../lib/theme';
import { pickImage, uploadMedia } from '../lib/upload';
import { BUSINESS_CATEGORIES } from '../types';

export default function CreateBusinessScreen(): React.JSX.Element {
  const { user } = useAuth();
  const router = useRouter();
  const { coords } = useLocation();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('restaurant');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [hours, setHours] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [rooms, setRooms] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const choosePhoto = async () => {
    const uri = await pickImage(false);
    if (uri) setCover(uri);
  };

  const submit = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('Add a name', 'Enter your business name.');
      return;
    }

    setSaving(true);
    try {
      const point = await resolveCoords(address, coords);
      if (!point) {
        Alert.alert('Add a location', 'Enter an address, or allow location access so we can place your business on the map.');
        setSaving(false);
        return;
      }
      const city = await cityFromCoords(point);
      const coverUrl = cover ? await uploadMedia(user.id, cover, 'photo', 'businesses') : null;
      const roomCount = parseInt(rooms, 10);

      const id = await createBusiness(user.id, {
        name: name.trim(),
        category,
        description: description.trim() || null,
        address: address.trim() || null,
        city,
        latitude: point.latitude,
        longitude: point.longitude,
        phone: phone.trim() || null,
        website: website.trim() || null,
        booking_url: bookingUrl.trim() || null,
        opening_hours: hours.trim() || null,
        price_from: priceFrom.trim() || null,
        rooms_available: category === 'hotel' && Number.isFinite(roomCount) ? roomCount : null,
        cover_url: coverUrl,
      });
      router.replace(`/business/${id}` as any);
    } catch (e) {
      Alert.alert('Could not add your business', e instanceof Error ? e.message : 'Please try again.');
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

        <Field label="Business name" value={name} onChangeText={setName} maxLength={80} />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {BUSINESS_CATEGORIES.map((c) => (
            <Chip key={c.key} label={c.label} selected={category === c.key} onPress={() => setCategory(c.key)} />
          ))}
        </View>

        <Field label="Address" value={address} onChangeText={setAddress} placeholder="Street, city" />
        <Field label="About" value={description} onChangeText={setDescription} multiline maxLength={1000} />
        <Field label="Opening hours" value={hours} onChangeText={setHours} placeholder="Mon to Sat, 6 PM to 3 AM" />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Website" value={website} onChangeText={setWebsite} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <Field label="Booking link (optional)" value={bookingUrl} onChangeText={setBookingUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <Field label="Prices from (optional)" value={priceFrom} onChangeText={setPriceFrom} placeholder="For example: 120 GBP per night" />
        {category === 'hotel' ? (
          <Field label="Rooms available now" value={rooms} onChangeText={setRooms} keyboardType="number-pad" />
        ) : null}

        <Button title="Add business" onPress={submit} loading={saving} style={styles.submit} />
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
