import { supabase } from '@/lib/supabase';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Keep splash visible until we are ready
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments() as any;
  const navigationState = useRootNavigationState();
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const hasSession = !!data.session;
        const inAuth = segments[0] === '(auth)';

        // Only navigate when navigation is ready
        if (navigationState?.key) {
          if (!hasSession && !inAuth) {
            router.replace('/(auth)/login' as any);
          } else if (hasSession && inAuth) {
            router.replace('/(tabs)' as any);
          }
        }
      } catch {
        // Don't crash if supabase fails - just go to login
        if (mounted && navigationState?.key) {
          router.replace('/(auth)/login' as any);
        }
      } finally {
        if (mounted) {
          setCheckedAuth(true);
          setReady(true);
        }
      }
    }

    // Safety timeout - never stay stuck on white screen
    const timeout = setTimeout(() => {
      if (mounted) {
        setCheckedAuth(true);
        setReady(true);
      }
    }, 3000);

    checkAuth();

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [navigationState?.key]);

  useEffect(() => {
    if (ready && checkedAuth) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready, checkedAuth]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#208AEF' }}>
        <ActivityIndicator color="white" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}