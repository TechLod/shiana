/**
 * camera.tsx
 *
 * Camera screen with:
 *  - live skin filters (skin tone, clear skin, spotless) that are active as soon
 *    as the camera loads and are also recorded into videos
 *  - photo capture
 *  - video recording up to 10 minutes
 *  - a gallery button at the bottom to pick a photo or video from the phone
 *  - a review step with Retake and Post
 *
 * Install:
 *   npx expo install react-native-vision-camera @shopify/react-native-skia \
 *     react-native-worklets-core react-native-reanimated expo-image-picker expo-video
 *
 * Setup:
 *   - Vision Camera and Skia are native modules, so this does NOT run in Expo Go.
 *     Use a development build: npx expo prebuild && npx expo run:android (or ios).
 *   - app.json: add the "react-native-vision-camera" plugin with camera and
 *     microphone permission messages, and the "expo-image-picker" plugin.
 *   - Add 'react-native-worklets-core/plugin' (and the reanimated plugin) to
 *     babel.config.js, as the Vision Camera docs describe for frame processors.
 *   - expo-image-picker "mediaTypes" array syntax needs Expo SDK 52 or newer.
 *
 * Usage:
 *   <CameraScreen
 *     onClose={() => navigation.goBack()}
 *     onPost={(media) => uploadToYourBackend(media)}
 *   />
 */

import { Skia } from '@shopify/react-native-skia';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CameraPosition } from 'react-native-vision-camera';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useMicrophonePermission,
  useSkiaFrameProcessor,
} from 'react-native-vision-camera';

/* ----------------------------- Configuration ----------------------------- */

const MAX_VIDEO_SECONDS = 10 * 60;
const ACCENT = '#4CC2CC';

/* -------------------------------- Types ---------------------------------- */

export interface PostMedia {
  type: 'photo' | 'video';
  /** Local file URI. Upload this to your backend when the user taps Post. */
  uri: string;
  width?: number;
  height?: number;
  /** Video length in seconds. */
  duration?: number;
  /** True when the user picked it from the phone instead of the camera. */
  fromLibrary: boolean;
}

interface CameraScreenProps {
  onPost?: (media: PostMedia) => void;
  onClose?: () => void;
}

type CaptureMode = 'photo' | 'video';
type FilterKey = 'none' | 'skinTone' | 'clearSkin' | 'spotless';

interface SkinParams {
  /** Distance in pixels between smoothing samples. Bigger removes bigger blemishes. */
  radius: number;
  /** How different two colors can be and still be blended. Bigger smooths more. */
  sigmaColor: number;
  /** How much fine skin texture to keep, 0 (none) to 1 (all). */
  retain: number;
  /** Overall strength of the effect, 0 to 1. */
  amount: number;
  /** Small brightness lift on skin. */
  brighten: number;
  /** Small warm tint on skin. */
  warmth: number;
}

interface FilterPreset {
  key: FilterKey;
  label: string;
  params: SkinParams | null;
}

/* --------------------------------- Filters -------------------------------- */

const FILTERS: FilterPreset[] = [
  { key: 'none', label: 'Original', params: null },
  {
    key: 'skinTone',
    label: 'Skin tone',
    params: { radius: 2.0, sigmaColor: 0.08, retain: 0.55, amount: 0.85, brighten: 0.02, warmth: 0.03 },
  },
  {
    key: 'clearSkin',
    label: 'Clear skin',
    params: { radius: 2.8, sigmaColor: 0.13, retain: 0.32, amount: 0.92, brighten: 0.03, warmth: 0.02 },
  },
  {
    key: 'spotless',
    label: 'Spotless',
    params: { radius: 3.8, sigmaColor: 0.22, retain: 0.1, amount: 1.0, brighten: 0.04, warmth: 0.02 },
  },
];

const num = (n: number): string => n.toFixed(4);

/**
 * GPU shader that runs on every camera frame.
 *  1. Finds skin-colored pixels (YCbCr range), softly masked.
 *  2. On those pixels only, applies an edge-preserving (bilateral) blur, which
 *     flattens pimples, redness and uneven patches while keeping edges sharp.
 *  3. Adds back a little fine texture so skin does not look plastic.
 *  4. Evens out the tone with a slight brightness and warmth lift.
 * Eyes, lips, hair and most of the background are not skin colored, so they
 * stay sharp.
 */
function buildSkinShader(p: SkinParams): string {
  return `
uniform shader image;

float skinMask(float3 c) {
  float cb = 0.5 - 0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b;
  float cr = 0.5 + 0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b;
  float maskCb = smoothstep(0.28, 0.32, cb) * (1.0 - smoothstep(0.49, 0.53, cb));
  float maskCr = smoothstep(0.50, 0.54, cr) * (1.0 - smoothstep(0.66, 0.70, cr));
  return maskCb * maskCr;
}

half4 main(float2 pos) {
  half4 centerPixel = image.eval(pos);
  float3 center = float3(centerPixel.rgb);
  float mask = skinMask(center);
  if (mask < 0.01) {
    return centerPixel;
  }

  float radius = ${num(p.radius)};
  float sigmaColor = ${num(p.sigmaColor)};
  float3 sum = float3(0.0);
  float weightSum = 0.0;

  for (int iy = -2; iy <= 2; iy++) {
    for (int ix = -2; ix <= 2; ix++) {
      float fx = float(ix);
      float fy = float(iy);
      float3 s = float3(image.eval(pos + float2(fx, fy) * radius).rgb);
      float colorDist = distance(s, center);
      float spatial = exp(-(fx * fx + fy * fy) / 8.0);
      float range = exp(-(colorDist * colorDist) / (2.0 * sigmaColor * sigmaColor));
      float w = spatial * range;
      sum += s * w;
      weightSum += w;
    }
  }

  float3 smoothed = sum / max(weightSum, 0.0001);
  float3 detail = center - smoothed;
  float3 result = smoothed + detail * ${num(p.retain)};
  result = result * float3(1.0 + ${num(p.warmth)}, 1.0, 1.0 - ${num(p.warmth)}) + ${num(p.brighten)};

  float3 outColor = mix(center, clamp(result, 0.0, 1.0), mask * ${num(p.amount)});
  return half4(half3(outColor), centerPixel.a);
}
`;
}

/** Builds a Skia paint for a filter, or null if it is Original or fails to compile. */
function makeFilterPaint(preset: FilterPreset) {
  if (!preset.params) return null;
  const effect = Skia.RuntimeEffect.Make(buildSkinShader(preset.params));
  if (!effect) {
    console.warn(`Skin filter "${preset.label}" failed to compile.`);
    return null;
  }
  const builder = Skia.RuntimeShaderBuilder(effect);
  const imageFilter = Skia.ImageFilter.MakeRuntimeShader(builder, null, null);
  const paint = Skia.Paint();
  paint.setImageFilter(imageFilter);
  return paint;
}

/* -------------------------------- Helpers -------------------------------- */

function formatTime(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function useAppIsActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/* ------------------------------ Video preview ----------------------------- */

function VideoPreview({ uri }: { uri: string }): React.JSX.Element {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

/* --------------------------------- Screen --------------------------------- */

// FIXED: removed "export default" here - this is now the inner screen, not the tab itself.
// The tab wrapper at the bottom is the default export.
function CameraScreen({ onPost, onClose }: CameraScreenProps): React.JSX.Element {
  const cameraRef = useRef<Camera>(null);
  const appIsActive = useAppIsActive();

  const { hasPermission: hasCamera, requestPermission: requestCamera } = useCameraPermission();
  const { hasPermission: hasMic, requestPermission: requestMic } = useMicrophonePermission();

  const [position, setPosition] = useState<CameraPosition>('front');
  const [mode, setMode] = useState<CaptureMode>('photo');
  const [filterKey, setFilterKey] = useState<FilterKey>('clearSkin');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [captured, setCaptured] = useState<PostMedia | null>(null);

  const device = useCameraDevice(position);
  const format = useCameraFormat(device, [
    { videoResolution: { width: 1920, height: 1080 } },
    { photoResolution: 'max' },
    { fps: 30 },
  ]);
  const fps = format && format.minFps <= 30 && format.maxFps >= 30 ? 30 : undefined;

  /* Ask for permissions as soon as the screen opens. */
  useEffect(() => {
    if (!hasCamera) requestCamera();
    if (!hasMic) requestMic();
  }, [hasCamera, hasMic, requestCamera, requestMic]);

  /* Live filter, applied to every frame (and recorded into videos). */
  const preset = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const paint = useMemo(() => makeFilterPaint(preset), [preset]);

  const frameProcessor = useSkiaFrameProcessor(
    (frame) => {
      'worklet';
      if (paint) {
        frame.render(paint);
      } else {
        frame.render();
      }
    },
    [paint],
  );

  /* Photo. */
  const takePicture = useCallback(async () => {
    const camera = cameraRef.current;
    if (!camera || busy) return;
    try {
      setBusy(true);
      // takePhoto does not include the filter, so when a filter is on we take a
      // snapshot of the filtered preview stream instead.
      const file = paint
        ? await camera.takeSnapshot({ quality: 95 })
        : await camera.takePhoto({ flash: 'off' });
      setCaptured({
        type: 'photo',
        uri: `file://${file.path}`,
        width: file.width,
        height: file.height,
        fromLibrary: false,
      });
    } catch {
      Alert.alert('Could not take the photo', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }, [busy, paint]);

  /* Video, up to 10 minutes. */
  const startRecording = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera || recording) return;
    setElapsed(0);
    setRecording(true);
    camera.startRecording({
      fileType: 'mp4',
      onRecordingFinished: (video) => {
        setRecording(false);
        setCaptured({
          type: 'video',
          uri: `file://${video.path}`,
          width: video.width,
          height: video.height,
          duration: video.duration,
          fromLibrary: false,
        });
      },
      onRecordingError: () => {
        setRecording(false);
        Alert.alert('Recording stopped', 'Something went wrong while recording. Please try again.');
      },
    });
  }, [recording]);

  const stopRecording = useCallback(async () => {
    try {
      await cameraRef.current?.stopRecording();
    } catch {
      setRecording(false);
    }
  }, []);

  /* Timer, and automatic stop at 10 minutes. */
  useEffect(() => {
    if (!recording) return;
    const startedAt = Date.now();
    const id = setInterval(() => {
      const seconds = (Date.now() - startedAt) / 1000;
      setElapsed(seconds);
      if (seconds >= MAX_VIDEO_SECONDS) {
        clearInterval(id);
        stopRecording();
      }
    }, 250);
    return () => clearInterval(id);
  }, [recording, stopRecording]);

  /* Stop any recording if the screen closes. */
  useEffect(() => {
    return () => {
      cameraRef.current?.stopRecording().catch(() => undefined);
    };
  }, []);

  const onShutterPress = useCallback(() => {
    if (mode === 'photo') {
      takePicture();
    } else if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [mode, recording, takePicture, startRecording, stopRecording]);

  /* Pick a photo or video from the phone. */
  const pickFromLibrary = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 1,
      });
      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      const seconds = asset.duration ? asset.duration / 1000 : undefined;

      if (isVideo && seconds !== undefined && seconds > MAX_VIDEO_SECONDS) {
        Alert.alert('Video is too long', 'Please choose a video that is 10 minutes or shorter.');
        return;
      }

      setCaptured({
        type: isVideo ? 'video' : 'photo',
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        duration: seconds,
        fromLibrary: true,
      });
    } catch {
      Alert.alert('Could not open your gallery', 'Please check that photo access is allowed.');
    }
  }, []);

  const post = useCallback(() => {
    if (!captured) return;
    onPost?.(captured);
    setCaptured(null);
    onClose?.();
  }, [captured, onPost, onClose]);

  /* ------------------------------ Permission views ------------------------------ */

  if (!hasCamera) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Text style={styles.stateTitle}>Camera access is needed</Text>
        <Text style={styles.stateBody}>Allow camera access to take photos and videos.</Text>
        <Pressable style={styles.primaryButton} onPress={() => Linking.openSettings()}>
          <Text style={styles.primaryButtonText}>Open settings</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={requestCamera}>
          <Text style={styles.secondaryButtonText}>Ask again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <ActivityIndicator color={ACCENT} />
        <Text style={styles.stateBody}>Starting the camera</Text>
      </SafeAreaView>
    );
  }

  /* ------------------------------- Review screen ------------------------------- */

  if (captured) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" />
        {captured.type === 'video' ? (
          <VideoPreview uri={captured.uri} />
        ) : (
          <Image source={{ uri: captured.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        )}
        <SafeAreaView style={styles.reviewBar}>
          <Pressable style={styles.secondaryPill} onPress={() => setCaptured(null)}>
            <Text style={styles.pillText}>{captured.fromLibrary ? 'Choose another' : 'Retake'}</Text>
          </Pressable>
          <Pressable style={styles.postPill} onPress={post}>
            <Text style={styles.postPillText}>Post</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  /* ------------------------------- Camera screen ------------------------------- */

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        fps={fps}
        isActive={appIsActive}
        photo
        video
        audio={hasMic}
        videoBitRate="normal"
        enableZoomGesture
        frameProcessor={frameProcessor}
      />

      {/* Top bar */}
      <SafeAreaView style={styles.topBar}>
        <Pressable
          style={styles.roundButton}
          onPress={onClose}
          disabled={recording}
          accessibilityRole="button"
          accessibilityLabel="Close camera"
        >
          <Text style={styles.roundButtonText}>✕</Text>
        </Pressable>

        {recording ? (
          <View style={styles.timer}>
            <View style={styles.recordDot} />
            <Text style={styles.timerText}>
              {formatTime(elapsed)} / {formatTime(MAX_VIDEO_SECONDS)}
            </Text>
          </View>
        ) : (
          <View />
        )}

        <Pressable
          style={styles.roundButton}
          onPress={() => setPosition((p) => (p === 'front' ? 'back' : 'front'))}
          disabled={recording}
          accessibilityRole="button"
          accessibilityLabel="Switch camera"
        >
          <Text style={styles.roundButtonText}>⟲</Text>
        </Pressable>
      </SafeAreaView>

      {/* Bottom controls */}
      <SafeAreaView style={styles.bottomArea}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {FILTERS.map((f) => {
            const selected = f.key === filterKey;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilterKey(f.key)}
                disabled={recording}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.modeRow}>
          {(['photo', 'video'] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} disabled={recording} style={styles.modeButton}>
              <Text style={[styles.modeText, mode === m && styles.modeTextSelected]}>
                {m === 'photo' ? 'Photo' : 'Video'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.controlsRow}>
          <Pressable
            style={styles.galleryButton}
            onPress={pickFromLibrary}
            disabled={recording}
            accessibilityRole="button"
            accessibilityLabel="Choose from gallery"
          >
            <Text style={styles.galleryIcon}>🖼️</Text>
            <Text style={styles.galleryLabel}>Gallery</Text>
          </Pressable>

          <Pressable
            onPress={onShutterPress}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={
              mode === 'photo' ? 'Take photo' : recording ? 'Stop recording' : 'Start recording'
            }
            style={styles.shutterOuter}
          >
            <View
              style={[
                styles.shutterInner,
                mode === 'video' && styles.shutterInnerVideo,
                recording && styles.shutterInnerRecording,
              ]}
            />
          </Pressable>

          <View style={styles.controlsSpacer} />
        </View>
      </SafeAreaView>
    </View>
  );
}

/* --------------------------------- Tab Wrapper --------------------------------- */

// FIXED: This is now the default export for the tab.
// Expo Router gives tabs NO props, so this wrapper supplies onClose / onPost.
// onPost only logs for now - onClose does the navigation, so we don't navigate twice.
export default function CameraTab(): React.JSX.Element {
  const router = useRouter();
  return (
    <CameraScreen
      onClose={() => router.replace('/tabs/feed')}
      onPost={(media) => {
        console.log('POST MEDIA:', media);
      }}
    />
  );
}

/* -------------------------------- Styles ---------------------------------- */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },

  centerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
    backgroundColor: '#0E171E',
  },
  stateTitle: { fontSize: 18, fontWeight: '700', color: '#E8EFF3', textAlign: 'center' },
  stateBody: { fontSize: 15, color: '#9AABB6', textAlign: 'center', lineHeight: 21 },
  primaryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: ACCENT,
  },
  primaryButtonText: { fontSize: 15, fontWeight: '600', color: '#08242A' },
  secondaryButton: { paddingHorizontal: 20, paddingVertical: 10 },
  secondaryButtonText: { fontSize: 15, fontWeight: '600', color: ACCENT },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  roundButtonText: { fontSize: 20, color: '#FFFFFF' },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  recordDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF4D4D' },
  timerText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  filterScroll: { flexGrow: 0 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  filterChipSelected: { backgroundColor: ACCENT },
  filterText: { fontSize: 14, color: '#FFFFFF' },
  filterTextSelected: { color: '#08242A', fontWeight: '700' },

  modeRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingVertical: 4 },
  modeButton: { paddingHorizontal: 8, paddingVertical: 6 },
  modeText: { fontSize: 15, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },
  modeTextSelected: { color: '#FFFFFF' },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  controlsSpacer: { width: 56 },
  galleryButton: { width: 56, alignItems: 'center', gap: 2 },
  galleryIcon: { fontSize: 28 },
  galleryLabel: { fontSize: 12, color: '#FFFFFF' },

  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' },
  shutterInnerVideo: { backgroundColor: '#FF4D4D' },
  shutterInnerRecording: { width: 30, height: 30, borderRadius: 7 },

  reviewBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  secondaryPill: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  pillText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  postPill: {
    paddingHorizontal: 34,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  postPillText: { fontSize: 16, fontWeight: '700', color: '#08242A' },
});