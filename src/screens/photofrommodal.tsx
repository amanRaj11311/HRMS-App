import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Image, ActivityIndicator, Dimensions,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';

const { width } = Dimensions.get('window');

type Props = {
  visible: boolean;
  onClose: () => void;
  checkInPhoto?: string | null;
  checkOutPhoto?: string | null;
  employeeName?: string;
};

export default function PhotoProofModal({ visible, onClose, checkInPhoto, checkOutPhoto, employeeName }: Props) {
  const [activeTab, setActiveTab] = useState<'in' | 'out'>('in');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      setActiveTab(checkInPhoto ? 'in' : 'out');
      setLoading(true);
    }
  }, [visible, checkInPhoto, checkOutPhoto]);

  const activeUri = activeTab === 'in' ? checkInPhoto : checkOutPhoto;
  const hasBoth = !!checkInPhoto && !!checkOutPhoto;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.headerText} numberOfLines={1}>{employeeName ? `${employeeName} — Photo Proof` : 'Photo Proof'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {hasBoth && (
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'in' && styles.tabActive]}
              onPress={() => { setActiveTab('in'); setLoading(true); }}
            >
              <Text style={[styles.tabText, activeTab === 'in' && styles.tabTextActive]}>Check In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'out' && styles.tabActive]}
              onPress={() => { setActiveTab('out'); setLoading(true); }}
            >
              <Text style={[styles.tabText, activeTab === 'out' && styles.tabTextActive]}>Check Out</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.imageWrap}>
          {activeUri ? (
            <>
              {loading && <ActivityIndicator size="large" color="#fff" style={StyleSheet.absoluteFill} />}
              <Image
                source={{ uri: activeUri }}
                style={styles.image}
                resizeMode="contain"
                onLoadEnd={() => setLoading(false)}
              />
            </>
          ) : (
            <View style={styles.noPhotoBox}>
              <Feather name="camera-off" size={40} color="#64748B" />
              <Text style={styles.noPhotoText}>No photo available for this punch.</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12,
  },
  headerText: { color: '#fff', fontSize: 15, fontWeight: 'bold', flex: 1, marginRight: 10 },
  closeBtn: { padding: 6 },
  tabRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12 },
  tab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 6 },
  tabActive: { backgroundColor: '#3B82F6' },
  tabText: { color: '#94A3B8', fontSize: 12, fontWeight: 'bold' },
  tabTextActive: { color: '#fff' },
  imageWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: { width: width, height: '90%' },
  noPhotoBox: { alignItems: 'center' },
  noPhotoText: { color: '#64748B', marginTop: 11, fontSize: 13 },
});