import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

const CATS = ['Restaurants','Clubs','Lounges','Hotels','Events','Bars','Cafes','Shops'];

export default function BusinessDashboard() {
  const [myPlaces, setMyPlaces] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Restaurants');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('Open until 11 PM');
  const [eventTime, setEventTime] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{lat:number, lng:number} | null>(null);
  const [locating, setLocating] = useState(false);

  const fetchMyPlaces = async () => {
    const { data } = await supabase.from('business_places').select('*').order('created_at', {ascending: false});
    if (data) setMyPlaces(data);
  };
  useEffect(()=>{fetchMyPlaces()},[]);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status!== 'granted') { Alert.alert('Allow location in Settings'); setLocating(false); return; }

      let loc = await Location.getLastKnownPositionAsync({}) || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const newCoords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setCoords(newCoords);

      let finalAddr = `${newCoords.lat.toFixed(5)}, ${newCoords.lng.toFixed(5)}`;
      try {
        let reverse = await Location.reverseGeocodeAsync({ latitude: newCoords.lat, longitude: newCoords.lng });
        if (reverse[0]) {
          const r = reverse[0];
          finalAddr = `${r.street || r.name || ''} ${r.city || r.region || ''}`.trim() || finalAddr;
        }
      } catch {}

      setAddress(finalAddr);
      Alert.alert('Location captured! ✅', finalAddr);
    } catch (e: any) {
      Alert.alert('GPS off', 'Turn on GPS + Allow location for Shiana');
    }
    setLocating(false);
  };

  const pickImage = async () => {
    // FIXED - no more warning
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const addPlace = async () => {
    if (!name ||!address) { Alert.alert('Need name + address - tap USE MY LOCATION'); return; }
    setLoading(true);

    let imageUrl = image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500';

    const { error } = await supabase.from('business_places').insert({
      name, category, description: desc, price, address, phone, open_hours: hours, event_time: eventTime, image_url: imageUrl,
      latitude: coords?.lat || 53.1959, longitude: coords?.lng || 50.1008
    });
    setLoading(false);
    if (error) Alert.alert('Error', error.message);
    else {
      Alert.alert('Live Worldwide! 🌍', `${name} is now visible`);
      setName(''); setDesc(''); setPrice(''); setAddress(''); setPhone(''); setEventTime(''); setImage(null); setCoords(null);
      fetchMyPlaces();
    }
  };

  const deletePlace = async (id: string, placeName: string) => {
    Alert.alert('Delete?', `Remove "${placeName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('business_places').delete().eq('id', id);
        if (error) Alert.alert('Error', error.message);
        else fetchMyPlaces();
      }}
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8f8f8' }} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={{ backgroundColor: 'black', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 16 }}>
        <Text style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: 12 }}>BUSINESS DASHBOARD • WORLDWIDE</Text>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>Grow anywhere in world</Text>
      </View>

      <View style={{ backgroundColor: 'white', margin: 16, borderRadius: 16, padding: 16 }}>
        <Text style={{ fontWeight: 'bold', fontSize: 18 }}>Add New Place / Event</Text>

        <TouchableOpacity onPress={pickImage} style={{ backgroundColor: '#f3f3f3', height: 140, borderRadius: 12, marginTop: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {image? <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} /> : <><Ionicons name="image-outline" size={32} color="#888" /><Text style={{ color: '#888', marginTop: 6 }}>Add photo (optional)</Text></>}
        </TouchableOpacity>

        <Text style={{ marginTop: 14, fontWeight: '600', fontSize: 13 }}>BUSINESS NAME *</Text>
        <TextInput value={name} onChangeText={setName} placeholder="e.g. Trier Cafe" style={{ backgroundColor: '#f8f8f8', padding: 12, borderRadius: 10, marginTop: 6 }} />

        <Text style={{ marginTop: 12, fontWeight: '600', fontSize: 13 }}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
          {CATS.map(c => <TouchableOpacity key={c} onPress={()=>setCategory(c)} style={{ backgroundColor: category===c? 'black' : '#f3f3f3', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8 }}><Text style={{ color: category===c? 'white' : 'black', fontSize: 12, fontWeight: '600' }}>{c}</Text></TouchableOpacity>)}
        </ScrollView>

        <Text style={{ marginTop: 12, fontWeight: '600', fontSize: 13 }}>DESCRIPTION</Text>
        <TextInput value={desc} onChangeText={setDesc} placeholder="What makes it special?" style={{ backgroundColor: '#f8f8f8', padding: 12, borderRadius: 10, marginTop: 6 }} />

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Text style={{ marginTop: 12, fontWeight: '600', fontSize: 13 }}>PRICE</Text><TextInput value={price} onChangeText={setPrice} placeholder="$$" style={{ backgroundColor: '#f8f8f8', padding: 12, borderRadius: 10, marginTop: 6 }} /></View>
          <View style={{ flex: 1 }}><Text style={{ marginTop: 12, fontWeight: '600', fontSize: 13 }}>PHONE</Text><TextInput value={phone} onChangeText={setPhone} placeholder="+7..." style={{ backgroundColor: '#f8f8f8', padding: 12, borderRadius: 10, marginTop: 6 }} /></View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Text style={{ marginTop: 12, fontWeight: '600', fontSize: 13 }}>HOURS</Text><TextInput value={hours} onChangeText={setHours} placeholder="Open until 11 PM" style={{ backgroundColor: '#f8f8f8', padding: 12, borderRadius: 10, marginTop: 6 }} /></View>
          <View style={{ flex: 1 }}><Text style={{ marginTop: 12, fontWeight: '600', fontSize: 13 }}>EVENT TIME</Text><TextInput value={eventTime} onChangeText={setEventTime} placeholder="Tonight 9PM" style={{ backgroundColor: '#f8f8f8', padding: 12, borderRadius: 10, marginTop: 6 }} /></View>
        </View>

        <Text style={{ marginTop: 12, fontWeight: '600', fontSize: 13 }}>ADDRESS *</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <TextInput value={address} onChangeText={setAddress} placeholder="Tap USE MY LOCATION" style={{ flex: 1, backgroundColor: '#f8f8f8', padding: 12, borderRadius: 10 }} />
          <TouchableOpacity onPress={useMyLocation} style={{ backgroundColor: 'black', paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minWidth: 110 }}>
            {locating? <ActivityIndicator color="white" /> : <><Ionicons name="locate" size={18} color="#fbbf24" /><Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold', marginTop: 2 }}>USE MY LOCATION</Text></>}
          </TouchableOpacity>
        </View>
        {coords && <Text style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}>📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} captured</Text>}

        <TouchableOpacity onPress={addPlace} disabled={loading} style={{ backgroundColor: 'black', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 18 }}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>{loading? 'Publishing...' : '🚀 Publish Worldwide'}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 10 }}>My Places ({myPlaces.length})</Text>
        {myPlaces.map(p => (
          <View key={p.id} style={{ backgroundColor: 'white', flexDirection: 'row', padding: 12, borderRadius: 12, marginBottom: 10, alignItems: 'center' }}>
            <Image source={{ uri: p.image_url }} style={{ width: 60, height: 60, borderRadius: 10 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ fontWeight: 'bold' }}>{p.name}</Text>
              <Text style={{ color: '#666', fontSize: 12 }}>{p.category} • {p.address.slice(0,30)}</Text>
            </View>
            <TouchableOpacity onPress={()=>deletePlace(p.id, p.name)} style={{ backgroundColor: '#fee2e2', padding: 10, borderRadius: 10 }}>
              <Ionicons name="trash" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}