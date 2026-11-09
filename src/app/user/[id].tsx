import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { ProfileView } from '../../components/ProfileView';

export default function UserProfileScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProfileView userId={id} />;
}
