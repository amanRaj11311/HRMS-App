import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Alert,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput, // 🚀 v5: capture methods now live on the Output, not the Camera ref
} from 'react-native-vision-camera';
import ViewShot from 'react-native-view-shot';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import RNFS from 'react-native-fs';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCapture: (fileUri: string) => void; // fires with the FINAL geo-tagged image path
  latitude: number;
  longitude: number;
  address: string; // pre-fetched reverse-geocoded address (pass '' if unavailable)
};

export default function GeoTagAttendanceCamera({ visible, onClose, onCapture, latitude, longitude, address }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const camera = useRef<Camera>(null);
  const shotRef = useRef<ViewShot>(null);

  // 🚀 v5: create the photo output up-front and attach it to the Camera via `outputs`.
  // capturePhoto() now lives on this object — camera.current.takePhoto() no longer exists in v5.
  const photoOutput = usePhotoOutput();

  const [capturedPath, setCapturedPath] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (visible && !hasPermission) requestPermission();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  useEffect(() => {
    // reset when modal reopens
    if (visible) setCapturedPath(null);
  }, [visible]);

  const stampLines = () => {
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    return {
      line1: address || 'Address unavailable',
      line2: `Lat: ${latitude.toFixed(6)}, Long: ${longitude.toFixed(6)}`,
      line3: `${dateStr}  •  ${timeStr}`,
    };
  };

  const takePhoto = async () => {
    if (!photoOutput) return;
    try {
      // 🚀 v5 capture API: capturePhoto(settings, callbacks) → returns an in-memory Photo object.
      const photo = await photoOutput.capturePhoto(
        { enableShutterSound: false, flashMode: 'off' },
        {}
      );

      // v5 photos are in-memory by default (faster, no disk write) — write it to a temp
      // file here since the rest of this flow (ViewShot compositing, RNFS upload) needs a file path.
      const rawPath = await photo.saveToTemporaryFileAsync();
      photo.dispose(); // 🚀 important in v5 — releases the in-memory buffer, prevents leaks

      const finalPath = rawPath.startsWith('file://') ? rawPath : `file://${rawPath}`;
      setCapturedPath(finalPath);
    } catch (e: any) {
      Alert.alert('Camera Error', e?.message || 'Failed to capture photo.');
    }
  };

  const confirmPhoto = async () => {
    if (!shotRef.current) return;
    try {
      setProcessing(true);
      // captureRef of the ViewShot wraps the captured <Image> + overlay text
      // and rasterizes both into one merged PNG — this is what bakes the
      // location/date stamp permanently into the photo.
      // @ts-ignore - capture() exists on the ref instance
      const uri: string = await shotRef.current.capture();
      const finalPath = uri.startsWith('file://') ? uri : `file://${uri}`;
      onCapture(finalPath);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to process photo. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const retake = () => setCapturedPath(null);

  const { line1, line2, line3 } = stampLines();

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {!hasPermission ? (
          <View style={styles.center}>
            <MaterialCommunityIcons name="camera-off" size={48} color="#94A3B8" />
            <Text style={styles.permText}>Camera permission required.</Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ marginTop: 16 }}>
              <Text style={{ color: '#EF4444' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : !device ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.permText}>Initializing camera...</Text>
          </View>
        ) : capturedPath ? (
          // ── REVIEW STATE: composite preview + overlay, captured via ViewShot ──
          <ViewShot ref={shotRef} options={{ format: 'jpg', quality: 0.9 }} style={styles.flex}>
            <View style={styles.flex}>
              <FastImageFallback uri={capturedPath} />
              <View style={styles.overlayBox}>
                <Text style={styles.overlayText} numberOfLines={2}>{line1}</Text>
                <Text style={styles.overlayText}>{line2}</Text>
                <Text style={styles.overlayText}>{line3}</Text>
              </View>
            </View>
          </ViewShot>
        ) : (
          // ── LIVE CAMERA STATE ──
          <View style={styles.flex}>
            <Camera
              ref={camera}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={visible && !capturedPath}
              outputs={[photoOutput]} // 🚀 v5: replaces the old `photo={true}` boolean prop
            />
            <View style={styles.overlayBox}>
              <Text style={styles.overlayText} numberOfLines={2}>{line1}</Text>
              <Text style={styles.overlayText}>{line2}</Text>
              <Text style={styles.overlayText}>{line3}</Text>
            </View>
          </View>
        )}

        {hasPermission && device && (
          <View style={styles.controlBar}>
            <TouchableOpacity onPress={onClose} style={styles.controlSide}>
              <MaterialCommunityIcons name="close" size={28} color="#fff" />
            </TouchableOpacity>

            {capturedPath ? (
              <>
                <TouchableOpacity onPress={retake} style={styles.controlSide} disabled={processing}>
                  <MaterialCommunityIcons name="camera-retake" size={28} color="#fff" />
                  <Text style={styles.controlLabel}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmPhoto} style={styles.captureBtn} disabled={processing}>
                  {processing ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="check" size={30} color="#fff" />}
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={takePhoto} style={styles.captureBtn}>
                <View style={styles.captureBtnInner} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

// Plain <Image> wrapper kept separate so it's obvious this is swappable
// for FastImage if the project already uses it elsewhere.
import { Image } from 'react-native';
const FastImageFallback = ({ uri }: { uri: string }) => (
  <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  permText: { color: '#fff', marginTop: 12, fontSize: 14 },
  permBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 16 },
  overlayBox: {
    position: 'absolute', left: 12, right: 12, bottom: 110,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: 10,
  },
  overlayText: { color: '#fff', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  controlBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  controlSide: { alignItems: 'center' },
  controlLabel: { color: '#fff', fontSize: 10, marginTop: 4 },
  captureBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff',
  },
  captureBtnInner: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff' },
});