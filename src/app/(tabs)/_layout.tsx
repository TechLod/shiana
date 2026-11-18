import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import React from 'react';

import { colors } from '../../lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  name: string;
  title: string;
  icon: IconName;
  iconActive: IconName;
}

const TABS: TabConfig[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'discover', title: 'Discover', icon: 'compass-outline', iconActive: 'compass' },
  { name: 'events', title: 'Events', icon: 'calendar-outline', iconActive: 'calendar' },
  { name: 'feed', title: 'Feed', icon: 'play-circle-outline', iconActive: 'play-circle' },
  { name: 'inbox', title: 'Inbox', icon: 'chatbubble-outline', iconActive: 'chatbubble' },
  { name: 'business', title: 'Business', icon: 'briefcase-outline', iconActive: 'briefcase' },
  { name: 'camera', title: 'Camera', icon: 'camera-outline', iconActive: 'camera' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

export default function TabsLayout(): React.JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.sub,
        tabBarLabelStyle: { fontSize: 10 },
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            headerShown: false,
            ...(tab.name === 'camera' ? { tabBarStyle: { display: 'none' as const } } : {}),
            tabBarIcon: ({ color, size, focused }) => (
             <Ionicons name={focused ? tab.iconActive : tab.icon} size={size} color={typeof color === 'string' ? color : colors.accent} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}