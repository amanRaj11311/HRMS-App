import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Alert, Image,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput, // 🚀 v5: capture methods now live on the Output, not the Camera ref
} from 'react-native-vision-camera';
import ViewShot from 'react-native-view-shot';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCapture: (fileUri: string) => void; // fires with the FINAL geo-tagged image path
  latitude: number;
  longitude: number;
  address: string; // pre-fetched reverse-geocoded address (pass '' if unavailable)
  accuracy?: number | null;                 // meters, from Geolocation
  distanceFromAllowed?: number | null;       // meters, only set when locationBased is true
  allowedLocationName?: string | null;       // nearest configured office name
  locationBased?: boolean;                   // Case A (false) vs Case B (true)
};

export default function GeoTagAttendanceCamera({
  visible,
  onClose,
  onCapture,
  latitude,
  longitude,
  address,
  accuracy = null,
  distanceFromAllowed = null,
  allowedLocationName = null,
  locationBased = false,
}: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const camera = useRef<Camera>(null);
  const shotRef = useRef<ViewShot>(null);

  // 🚀 v5: create the photo output up-front and attach it to the Camera via `outputs`.
  // capturePhoto() now lives on this object — camera.current.takePhoto() no longer exists in v5.
  const photoOutput = usePhotoOutput();

  const [capturedPath, setCapturedPath] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (visible && !hasPermission) requestPermission();
  }, [visible]);

  useEffect(() => {
    // reset when modal reopens
    if (visible) setCapturedPath(null);
  }, [visible]);

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
      // captureRef of the ViewShot wraps the captured <Image> + overlay panel
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

  const fmtCoord = (v: number) => (typeof v === 'number' ? v.toFixed(6) : '--');
  const fmtMeters = (v: number | null | undefined) =>
    typeof v === 'number' ? `${Math.round(v)} m` : '--';
  const statusLabel = locationBased ? 'Location Verified' : 'Location Recorded';

  // ── DCS Geo Location panel — same UI used elsewhere, ported in here ──
  const GeoPanel = () => (
    <View style={styles.geoPanel}>
      <View style={styles.geoPanelHeaderRow}>
        <MaterialCommunityIcons name="map-marker-radius" size={16} color="#60A5FA" />
        <Text style={styles.geoPanelTitle}>DCS Geo Location</Text>
        <View style={styles.geoStatusPill}>
          <View style={styles.geoStatusDot} />
          <Text style={styles.geoStatusText}>{statusLabel}</Text>
        </View>
      </View>

      <Text style={styles.geoAddress} numberOfLines={2}>{address || 'Resolving address…'}</Text>

      <View style={styles.geoGrid}>
        <View style={styles.geoGridItem}>
          <Text style={styles.geoGridLabel}>LATITUDE</Text>
          <Text style={styles.geoGridValue}>{fmtCoord(latitude)}</Text>
        </View>
        <View style={styles.geoGridItem}>
          <Text style={styles.geoGridLabel}>LONGITUDE</Text>
          <Text style={styles.geoGridValue}>{fmtCoord(longitude)}</Text>
        </View>
        <View style={styles.geoGridItem}>
          <Text style={styles.geoGridLabel}>ACCURACY</Text>
          <Text style={styles.geoGridValue}>{accuracy != null ? `± ${Math.round(accuracy)}m` : '--'}</Text>
        </View>
        {/* Distance is only meaningful when the permission is location-based (Case B) */}
        {locationBased && (
          <View style={styles.geoGridItem}>
            <Text style={styles.geoGridLabel}>
              {allowedLocationName ? `DIST. FROM ${allowedLocationName.toUpperCase()}` : 'DISTANCE'}
            </Text>
            <Text style={styles.geoGridValue}>{fmtMeters(distanceFromAllowed)}</Text>
          </View>
        )}
      </View>
    </View>
  );

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
              <Image source={{ uri: capturedPath }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <GeoPanel />
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
            <GeoPanel />
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  permText: { color: '#fff', marginTop: 12, fontSize: 14 },
  permBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 16 },

  // ── DCS Geo Location panel ──
  geoPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 110,
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  geoPanelHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  geoPanelTitle: { color: '#fff', fontSize: 13, fontWeight: '900', marginLeft: 6, flex: 1, letterSpacing: 0.2 },
  geoStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  geoStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 5 },
  geoStatusText: { color: '#34D399', fontSize: 10, fontWeight: '800' },

  geoAddress: { color: '#CBD5E1', fontSize: 11, marginBottom: 10, lineHeight: 15 },

  geoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  geoGridItem: { width: '50%', marginBottom: 8 },
  geoGridLabel: { color: '#64748B', fontSize: 9, fontWeight: '800', letterSpacing: 0.4, marginBottom: 2 },
  geoGridValue: { color: '#F1F5F9', fontSize: 12, fontWeight: '700' },

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