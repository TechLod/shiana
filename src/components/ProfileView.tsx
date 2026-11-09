import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    Modal,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';

import { useAuth } from '../context/Authcontext';
import {
    fetchProfile,
    fetchProfileStats,
    fetchUserPosts,
    isFollowing,
    setFollowing,
    updateProfile,
} from '../lib/api';
import { formatCount } from '../lib/format';
import { colors } from '../lib/theme';
import { pickImage, uploadMedia } from '../lib/upload';
import type { PostThumb, Profile } from '../types';
import { Avatar, Button, Empty, Field, Loading } from './ui';

/** Profile page for yourself or for another user. */
export function ProfileView({ userId }: { userId: string }): React.JSX.Element {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tile = (width - 4) / 3;

  const isSelf = user?.id === userId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [posts, setPosts] = useState<PostThumb[]>([]);
  const [following, setFollowingState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [newAvatar, setNewAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, s, grid, follows] = await Promise.all([
        fetchProfile(userId),
        fetchProfileStats(userId),
        fetchUserPosts(userId),
        user && user.id !== userId ? isFollowing(user.id, userId) : Promise.resolve(false),
      ]);
      setProfile(p);
      setStats(s);
      setPosts(grid);
      setFollowingState(follows);
    } catch (e) {
      Alert.alert('Could not load this profile', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleFollow = async () => {
    if (!user || isSelf) return;
    const next = !following;
    setFollowingState(next);
    setStats((s) => ({ ...s, followers: Math.max(0, s.followers + (next ? 1 : -1)) }));
    try {
      await setFollowing(user.id, userId, next);
    } catch {
      setFollowingState(!next);
      setStats((s) => ({ ...s, followers: Math.max(0, s.followers + (next ? -1 : 1)) }));
      Alert.alert('Could not update follow', 'Please try again.');
    }
  };

  const openEditor = () => {
    setFullName(profile?.full_name ?? '');
    setBio(profile?.bio ?? '');
    setNewAvatar(null);
    setEditing(true);
  };

  const chooseAvatar = async () => {
    const uri = await pickImage(true);
    if (uri) setNewAvatar(uri);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let avatarUrl = profile?.avatar_url ?? null;
      if (newAvatar) avatarUrl = await uploadMedia(user.id, newAvatar, 'photo', 'avatars');
      await updateProfile(user.id, {
        full_name: fullName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
      });
      setEditing(false);
      await load();
    } catch (e) {
      Alert.alert('Could not save your profile', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (!profile) return <Empty title="Profile not found" />;

  const header = (
    <View style={styles.header}>
      <Avatar uri={profile.avatar_url ?? ""} name={profile.username ?? ""} size={88} />
      <Text style={styles.username}>@{profile.username}</Text>
      {profile.full_name ? <Text style={styles.fullName}>{profile.full_name}</Text> : null}
      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{formatCount(stats.posts)}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{formatCount(stats.followers)}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{formatCount(stats.following)}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </View>
      </View>

      {isSelf ? (
        <View style={styles.actions}>
          <Button title="Edit profile" variant="secondary" onPress={openEditor} style={styles.actionButton} />
          <Button title="Log out" variant="secondary" onPress={signOut} style={styles.actionButton} />
        </View>
      ) : (
        <Button
          title={following ? 'Following' : 'Follow'}
          variant={following ? 'secondary' : 'primary'}
          onPress={toggleFollow}
          style={styles.followButton}
        />
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        numColumns={3}
        ListHeaderComponent={header}
        ListEmptyComponent={<Empty title="No posts yet" body={isSelf ? 'Use the camera tab to share your first post.' : undefined} />}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/post/${item.id}` as any)}
            style={{ width: tile, height: tile * 1.3 }}
            accessibilityRole="button"
          >
            {item.media_type === 'photo' ? (
              <Image source={{ uri: item.media_url ?? "" }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.videoTile]}>
                <Ionicons name="play" size={28} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
        )}
      />

      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>Edit profile</Text>
            <Pressable onPress={chooseAvatar} style={styles.avatarPicker} accessibilityRole="button">
              <Avatar uri={newAvatar ?? profile.avatar_url ?? ""} name={profile.username ?? ""} size={96} />
              <Text style={styles.changePhoto}>Change photo</Text>
            </Pressable>
            <Field label="Name" value={fullName} onChangeText={setFullName} maxLength={60} />
            <Field label="Bio" value={bio} onChangeText={setBio} multiline maxLength={160} />
            <Button title="Save" onPress={saveProfile} loading={saving} />
            <Button title="Cancel" variant="secondary" onPress={() => setEditing(false)} style={styles.cancel} />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: 'center', padding: 20, gap: 6 },
  username: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 8 },
  fullName: { fontSize: 15, color: colors.sub },
  bio: { fontSize: 14, color: colors.text, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 36, marginVertical: 16 },
  stat: { alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.sub },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  actionButton: { flex: 1 },
  followButton: { alignSelf: 'stretch' },
  gridRow: { gap: 2, marginBottom: 2 },
  thumb: { width: '100%', height: '100%', backgroundColor: colors.card },
  videoTile: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalBody: { padding: 20 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 16 },
  avatarPicker: { alignItems: 'center', marginBottom: 20, gap: 8 },
  changePhoto: { fontSize: 14, fontWeight: '600', color: colors.accent },
  cancel: { marginTop: 10 },
});
