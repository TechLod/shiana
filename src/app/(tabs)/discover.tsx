import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const supabase = createClient('https://shiana-proxy-gh4a.vercel.app','sb_publishable_kfSsqhkT-pCn5BV6xN5ymA_JB5K4rEB', {
  auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

const FILTERS = ['All','Restaurant','Coffee','Club','Hotel','Business'];

function getDistance(lat1:number, lon1:number, lat2:number, lon2:number){
  const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return (R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))).toFixed(1);
}

export default function Around() {
  const [places, setPlaces] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [locName, setLocName] = useState('Finding your location...');
  const [userLoc, setUserLoc] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list'|'map'>('list');

  const load = async () => {
    setLoading(true);
    console.log('LOADING AROUND YOU...');
    try{
      const { status } = await Location.requestForegroundPermissionsAsync();
      if(status!== 'granted'){ setLocName('Permission denied - enable location'); setLoading(false); return; }

      const loc=await Location.getCurrentPositionAsync({});
      const lat=loc.coords.latitude;
      const lng=loc.coords.longitude;
      console.log('YOUR LOCATION:', lat, lng);
      setUserLoc({ latitude: lat, longitude: lng });

      const rev = await Location.reverseGeocodeAsync({latitude:lat, longitude:lng});
      if(rev[0]) setLocName(`${rev[0].city||rev[0].district||rev[0].region||'Samara'} - ${rev[0].street||''}`);

      // 1. BUSINESS POSTS - Your own promos on TOP
      const { data: bizPosts } = await supabase.from('posts').select('*').eq('is_business', true).order('created_at',{ascending:false}).limit(20);
      const businessPlaces = (bizPosts||[]).map((p:any)=>({
        id: p.id, name: p.business_name || p.caption || 'Business Offer',
        description: p.caption||'Special offer nearby', category: p.category||'Business',
        lat: p.latitude||lat, lng: p.longitude||lng,
        distance: getDistance(lat,lng,p.latitude||lat,p.longitude||lng),
        isBusinessPost: true, photo_url: p.photo_url, open_now: true
      }));

      // 2. REAL LIVE PLACES FROM OPENSTREETMAP - THIS IS THE REAL LOCATION PART
      const radius = 5000; // 5km around you
      let osmQuery = '';
      if(filter==='All') osmQuery = `node(around:${radius},${lat},${lng})["amenity"~"restaurant|cafe|fast_food|bar|pub|nightclub"];node(around:${radius},${lat},${lng})["tourism"~"hotel|guest_house"];`;
      else if(filter==='Restaurant') osmQuery = `node(around:${radius},${lat},${lng})["amenity"~"restaurant|fast_food"];`;
      else if(filter==='Coffee') osmQuery = `node(around:${radius},${lat},${lng})["amenity"="cafe"];`;
      else if(filter==='Club') osmQuery = `node(around:${radius},${lat},${lng})["amenity"~"bar|pub|nightclub"];`;
      else if(filter==='Hotel') osmQuery = `node(around:${radius},${lat},${lng})["tourism"~"hotel|guest_house|hostel"];`;
      else if(filter==='Business') osmQuery = `node(around:${radius},${lat},${lng})["shop"];`;

      let realPlaces: any[] = [];
      if(osmQuery){
        try{
          const overpassQuery = `[out:json][timeout:25];(${osmQuery});out 50;`;
          console.log('Fetching OSM...');
          const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`);
          console.log('OSM status', res.status);
          if(res.ok){
            const json = await res.json();
            console.log('OSM found', json.elements?.length);
            realPlaces = (json.elements||[]).filter((el:any)=>el.tags?.name).slice(0,40).map((el:any)=>({
              id: `osm-${el.id}`,
              name: el.tags.name,
              description: `${el.tags.cuisine? el.tags.cuisine+' • ' : ''}${el.tags.amenity||el.tags.tourism||'Local place'} • ${el.tags.opening_hours||'Open now'}`,
              category: el.tags.amenity==='restaurant'||el.tags.amenity==='fast_food'?'Restaurant':el.tags.amenity==='cafe'?'Coffee':el.tags.amenity==='bar'||el.tags.amenity==='pub'||el.tags.amenity==='nightclub'?'Club':el.tags.tourism?'Hotel':'Business',
              lat: el.lat, lng: el.lon,
              distance: getDistance(lat,lng,el.lat,el.lon),
              isBusinessPost: false,
              photo_url: null,
              open_now: true
            }));
          }
        }catch(e){ console.log('OSM ERROR', e); }
      }

      // COMBINE: Business promos on TOP, then real places sorted by distance
      const all = [...businessPlaces,...realPlaces.sort((a,b)=> parseFloat(a.distance) - parseFloat(b.distance))];
      console.log('TOTAL PLACES', all.length);
      setPlaces(all);

    }catch(e){ console.log('LOCATION ERROR', e); setLocName('Could not get location - check GPS'); }
    setLoading(false);
  };

  useEffect(()=>{load();},[filter]);

  return (
    <View style={{flex:1,backgroundColor:'#f5f5f5',paddingTop:50}}>
      <View style={{paddingHorizontal:15, paddingBottom:10, backgroundColor:'white', flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
        <View style={{flex:1}}>
          <Text style={{color:'black',fontSize:20,fontWeight:'bold'}}>Around You 📍 LIVE</Text>
          <Text style={{color:'#888',fontSize:11,marginTop:2}} numberOfLines={1}>{locName} • {places.length} places • 5km radius</Text>
        </View>
        <View style={{flexDirection:'row', backgroundColor:'#eee', borderRadius:20, padding:3, marginLeft:10}}>
          <TouchableOpacity onPress={()=>setViewMode('list')} style={{backgroundColor: viewMode==='list'?'#7c3aed':'transparent', paddingHorizontal:12, paddingVertical:6, borderRadius:15}}>
            <Text style={{color: viewMode==='list'?'white':'#333', fontSize:11, fontWeight:'600'}}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>setViewMode('map')} style={{backgroundColor: viewMode==='map'?'#7c3aed':'transparent', paddingHorizontal:12, paddingVertical:6, borderRadius:15}}>
            <Text style={{color: viewMode==='map'?'white':'#333', fontSize:11, fontWeight:'600'}}>Map</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{backgroundColor:'white', maxHeight:50}} contentContainerStyle={{gap:8,paddingHorizontal:15, paddingVertical:8}}>
        {FILTERS.map(f=>(
          <TouchableOpacity key={f} onPress={()=>setFilter(f)} style={{backgroundColor:filter===f?'#7c3aed':'#eee',paddingHorizontal:16,paddingVertical:8,borderRadius:20}}>
            <Text style={{color:filter===f?'white':'#333',fontSize:12,fontWeight:'600'}}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading? <View style={{marginTop:60,alignItems:'center'}}><ActivityIndicator size="large" color="#7c3aed"/><Text style={{color:'#888',marginTop:12, fontSize:12}}>Getting your GPS... Finding real places near you in Samara</Text></View> :

      viewMode==='map' && userLoc? (
        <MapView style={{flex:1}} initialRegion={{...userLoc, latitudeDelta:0.05, longitudeDelta:0.05}} showsUserLocation showsMyLocationButton>
          {places.map(p=>(
            <Marker key={p.id} coordinate={{latitude:p.lat, longitude:p.lng}} title={p.name} description={p.description} pinColor={p.isBusinessPost? 'purple' : p.category==='Restaurant'?'red':p.category==='Coffee'?'orange':p.category==='Club'?'blue':'green'} onCalloutPress={()=>Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`)}/>
          ))}
        </MapView>
      ) : (
        <FlatList data={places} ListEmptyComponent={<View style={{padding:40, alignItems:'center'}}><Text style={{color:'#999', textAlign:'center'}}>No places found near you.{'\n'}Check internet, enable GPS, try All filter.{'\n'}We search live from OpenStreetMap.</Text><TouchableOpacity onPress={load} style={{backgroundColor:'#7c3aed', padding:12, borderRadius:20, marginTop:12}}><Text style={{color:'white'}}>🔄 Retry Live Search</Text></TouchableOpacity></View>} contentContainerStyle={{padding:12}} keyExtractor={(item)=>String(item.id)} renderItem={({item})=>(
            <TouchableOpacity onPress={()=>Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`)} style={{flexDirection:'row',backgroundColor:'white',borderRadius:14,padding:12,marginBottom:10,borderWidth:item.isBusinessPost?2:1,borderColor:item.isBusinessPost?'#7c3aed':'#eee', shadowColor:'#000', shadowOpacity:0.05, shadowRadius:5, elevation:2}}>
              <Image source={{uri: item.photo_url || `https://picsum.photos/seed/${item.id}/200/200`}} style={{width:64,height:64,borderRadius:10,backgroundColor:'#eee'}}/>
              <View style={{flex:1,marginLeft:12}}>
                <View style={{flexDirection:'row',alignItems:'center'}}>
                  <View style={{backgroundColor: item.isBusinessPost?'#7c3aed':'#111',paddingHorizontal:7,paddingVertical:2,borderRadius:6}}><Text style={{color:'white',fontSize:9,fontWeight:'bold'}}>{item.category.toUpperCase()}</Text></View>
                  {item.isBusinessPost && <View style={{backgroundColor:'#facc15',paddingHorizontal:6,paddingVertical:2,borderRadius:6,marginLeft:6}}><Text style={{color:'black',fontSize:8,fontWeight:'bold'}}>🔥 PROMOTED</Text></View>}
                  {item.open_now && <Text style={{color:'green', fontSize:9, marginLeft:6, fontWeight:'bold'}}>● OPEN</Text>}
                </View>
                <Text style={{color:'black',fontWeight:'bold',fontSize:13,marginTop:4}} numberOfLines={1}>{item.name}</Text>
                <Text style={{color:'#666',fontSize:11,marginTop:2}} numberOfLines={2}>{item.description}</Text>
                <Text style={{color:'#7c3aed',fontSize:11,marginTop:4, fontWeight:'600'}}>📍 {item.distance} km away • Tap for directions →</Text>
              </View>
            </TouchableOpacity>
          )}/>
      )}
      <TouchableOpacity onPress={load} style={{position:'absolute', bottom:20, right:20, backgroundColor:'black', paddingHorizontal:16, paddingVertical:10, borderRadius:30}}><Text style={{color:'white', fontSize:12}}>🔄 Refresh Live</Text></TouchableOpacity>
    </View>
  );
}