/**
 * src/app/_layout.tsx  (root layout)
 *
 * 1. Waits until we know whether someone is logged in.
 * 2. Sends logged-out users to the login screen and logged-in users to the tabs.
 * 3. Declares every screen that sits on top of the tabs.
 *
 * The tab bar itself is drawn in src/app/(tabs)/_layout.tsx.
 */

import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from '../context/Authcontext';
import { colors } from '../lib/theme';

function Gate(): React.JSX.Element {
  const { session, ready } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!ready) return;
    const firstSegment = segments[0] as string | undefined;
    const inAuthGroup = firstSegment === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login' as any);
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)' as any);
    }
  }, [ready, session, segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          // FIX: Header OFF by default - this kills the "tabs" text at the top
          headerShown: false,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '' }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false, title: '' }} />
        {/* These detail screens DO need a header, so turn it ON just for them */}
        <Stack.Screen name="create-post" options={{ headerShown: true, title: 'New post' }} />
        <Stack.Screen name="create-event" options={{ headerShown: true, title: 'Create event' }} />
        <Stack.Screen name="create-business" options={{ headerShown: true, title: 'Add your business' }} />
        <Stack.Screen name="event/[id]" options={{ headerShown: true, title: 'Event' }} />
        <Stack.Screen name="business/[id]" options={{ headerShown: true, title: 'Business' }} />
        <Stack.Screen name="comments/[postId]" options={{ headerShown: true, title: 'Comments', presentation: 'modal' }} />
        <Stack.Screen name="user/[id]" options={{ headerShown: true, title: 'Profile' }} />
        <Stack.Screen name="post/[id]" options={{ headerShown: true, title: 'Post' }} />
        <Stack.Screen name="story/[userId]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout(): React.JSX.Element {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}