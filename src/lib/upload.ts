import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
};

/**
 * Uploads a local photo or video to the "media" bucket and returns its public URL.
 * Files are stored under the user's own folder: <userId>/<folder>/<name>.
 */
export async function uploadMedia(
  userId: string,
  uri: string,
  kind: 'photo' | 'video',
  folder: string,
): Promise<string> {
  const rawExt = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const ext = MIME[rawExt] ? rawExt : kind === 'video' ? 'mp4' : 'jpg';
  const contentType = MIME[ext];
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const response = await fetch(uri);
  const body = await response.arrayBuffer();

  const { error } = await supabase.storage.from('media').upload(path, body, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

/** Opens the phone gallery to choose one image. Returns its local URI, or null. */
export async function pickImage(square = false): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: square ? [1, 1] : [16, 9],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}
