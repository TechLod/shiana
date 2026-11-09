import { useEffect, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function StoriesBar() {
  const [stories, setStories] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('stories').select('*').order('created_at', { ascending: false }).limit(20);
      setStories(data || []);
    })();
  }, []);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {/* NO + HERE - + is ONLY in feed.tsx on the For You line */}
        {stories.length === 0 ? (
          <>
            {[1, 2, 3, 4].map((s) => (
              <View key={s} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#e91e63', justifyContent: 'center', alignItems: 'center', backgroundColor: '#333' }}>
                <Text style={{ color: 'white' }}>👤</Text>
              </View>
            ))}
          </>
        ) : (
          stories.map((s: any) => (
            <TouchableOpacity key={s.id} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#e91e63', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#333' }}>
              {s.image_url || s.media_url ? (
                <Image source={{ uri: s.image_url || s.media_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
              ) : (
                <Text style={{ color: 'white' }}>👤</Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}