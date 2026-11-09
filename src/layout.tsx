import { supabase } from '@/lib/supabase';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments() as any;

  useEffect(() => {
    const forceReady = setTimeout(() => setReady(true), 800);
    
    supabase.auth.getSession().then(({ data }) => {
      clearTimeout(forceReady);
      setReady(true);
      const hasSession = !!data.session;
      const inAuth = segments[0] === '(auth)';
      if (!hasSession && !inAuth) router.replace('/(auth)/login' as any);
      else if (hasSession && inAuth) router.replace('/(tabs)' as any);
    }).catch(() => {
      setReady(true);
      router.replace('/(auth)/login' as any);
    });

    return () => clearTimeout(forceReady);
  }, []);

  if (!ready) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}><ActivityIndicator /></View>;
  return <Stack screenOptions={{ headerShown: false }} />;
}