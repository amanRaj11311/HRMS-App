import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, 
  ActivityIndicator, Alert, StatusBar, Platform, Switch
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme';
import GlobalAppBar from '../components/GlobalAppBar'; 
import { API_BASE } from '../api/api';

// ✅ FIX: backend route is /api/settings/notifications, not /api/notifications/settings.
// Confirmed against the working web app's network tab (PATCH .../api/settings/notifications -> 200 OK).
// The old path silently hit a fallback/error handler on the backend, which is why it returned
// {"success":false,"message":"Failed to update notification"} with a 500 - the request never
// reached the real update logic, so no amount of header spoofing could have fixed it.
const NOTIFICATION_SETTINGS_ENDPOINT = `${API_BASE}/settings/notifications`;

export default function NotificationScheduleModule({ navigation }: any) {
  const { colors, isLightMode } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [enabled, setEnabled] = useState(false);
  const [times, setTimes] = useState<string[]>([]);
  
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const [debugLog, setDebugLog] = useState<string>('');
  const [debugIsError, setDebugIsError] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchSettings();
  }, []));

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      
      const res = await axios.get(NOTIFICATION_SETTINGS_ENDPOINT, { 
          headers: { 
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          } 
      });
      
      const data = res.data?.data;
      if (data) {
          setEnabled(data.enabled || false);
          setTimes(data.times || []);
      }
    } catch (e) {
      console.log("Fetch Settings Error:", e);
    } finally { 
      setLoading(false); 
    }
  };

  const saveSettings = async (newEnabled?: boolean, newTimes?: string[]) => {
    try {
      setSaving(true);
      setDebugLog('');
      setDebugIsError(false);
      const token = await AsyncStorage.getItem('userToken');
      
      const payload = {
          enabled: Boolean(newEnabled !== undefined ? newEnabled : enabled),
          times: Array.isArray(newTimes) ? newTimes : times
      };

      const url = NOTIFICATION_SETTINGS_ENDPOINT;
      let logStr = `🚀 SENDING REQUEST TO:\n${url}\n\n📦 PAYLOAD:\n${JSON.stringify(payload, null, 2)}`;
      setDebugLog(logStr);

      const response = await fetch(url, {
          method: 'PATCH',
          headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
      });
      
      const status = response.status;
      const rawText = await response.text(); 

      logStr += `\n\n📥 BACKEND RESPONSE (STATUS: ${status}):\n${rawText}`;
      setDebugLog(logStr);

      if (!response.ok) {
          setDebugIsError(true);
          Alert.alert("Failed", `Backend rejected the request with Status ${status}.`);
          return false;
      }
      
      try {
          const resData = JSON.parse(rawText);
          if (resData && resData.success === false) {
             setDebugIsError(true);
             Alert.alert("Error", resData.message || "Operation failed.");
             return false;
          }
      } catch (e) {}

      return true; 
    } catch (e: any) {
      setDebugIsError(true);
      setDebugLog(prev => `${prev}\n\n❌ CRITICAL APP ERROR:\n${e.message}`);
      Alert.alert("Network/App Error", e.message || "Failed to connect to backend.");
      return false; 
    } finally {
      setSaving(false);
    }
  };

  const toggleSwitch = async (val: boolean) => {
      if (val === true && times.length === 0) {
          Alert.alert("Action Required", "Please add at least one notification time before enabling.");
          return;
      }

      setEnabled(val);
      const success = await saveSettings(val, times);
      if (!success) {
         setEnabled(!val);
      }
  };

  const handleTimeConfirm = async (event: any, selectedDate?: Date) => {
      setShowTimePicker(false);
      if (event.type === 'set' && selectedDate) {
          const hh = String(selectedDate.getHours()).padStart(2, '0');
          const mm = String(selectedDate.getMinutes()).padStart(2, '0');
          const timeStr = `${hh}:${mm}`;

          if (!times.includes(timeStr)) {
              const updatedTimes = [...times, timeStr].sort(); 
              
              const oldTimes = [...times];
              setTimes(updatedTimes);
              
              const success = await saveSettings(enabled, updatedTimes);
              if (!success) {
                  setTimes(oldTimes); 
              }
          } else {
              Alert.alert("Info", "This time is already added.");
          }
      }
  };

  const removeTime = async (timeToRemove: string) => {
      const updatedTimes = times.filter(t => t !== timeToRemove);
      
      const oldTimes = [...times];
      const oldEnabled = enabled;
      
      let newEnabled = enabled;

      if (updatedTimes.length === 0 && enabled) {
          newEnabled = false;
          setEnabled(false);
      }

      setTimes(updatedTimes);
      
      const success = await saveSettings(newEnabled, updatedTimes);
      if (!success) {
          setTimes(oldTimes); 
          setEnabled(oldEnabled);
      }
  };

  const formatDisplayTime = (timeStr: string) => {
      if (!timeStr) return '';
      const [hStr, mStr] = timeStr.split(':');
      let h = parseInt(hStr, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${String(h).padStart(2, '0')}:${mStr} ${ampm}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} translucent backgroundColor="transparent" />
      
      <View style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg }}>
        <GlobalAppBar navigation={navigation} title="Notification Schedule" />
      </View>

      {loading ? (
          <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
              <ActivityIndicator size="large" color={colors.primary} />
          </View>
      ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            
            <View style={styles.header}>
                <Text style={[styles.title, {color: colors.textMain}]}>Absent Employee Notification Schedule</Text>
                <Text style={{color: colors.textSub, fontSize: 13, marginTop: 6, lineHeight: 18}}>
                    Every employee marked absent for the day gets notified automatically at each time below. Add as many times as you like.
                </Text>
            </View>

            <View style={[styles.card, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                <View style={{flex: 1, paddingRight: 10}}>
                    <Text style={[styles.cardTitle, {color: colors.textMain}]}>Enable daily absent notifications</Text>
                    <Text style={{color: colors.textSub, fontSize: 12, marginTop: 4}}>
                        Turn off to pause without losing your saved times.
                    </Text>
                </View>
                <Switch 
                    trackColor={{ false: "#CBD5E1", true: "#A5B4FC" }}
                    thumbColor={enabled ? colors.primary : "#F8FAFC"}
                    onValueChange={toggleSwitch}
                    value={enabled}
                    disabled={saving}
                />
            </View>

            <View style={[styles.card, {backgroundColor: colors.cardBg, borderColor: colors.border, flexDirection: 'column', alignItems: 'stretch'}]}>
                <View style={styles.cardHeaderRow}>
                    <Text style={[styles.cardTitle, {color: colors.textMain}]}>Notification times</Text>
                    <TouchableOpacity 
                        style={[styles.addTimeBtn, {backgroundColor: colors.primary}]} 
                        onPress={() => setShowTimePicker(true)}
                        disabled={saving}
                    >
                        {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="plus" size={14} color="#FFF" />}
                        <Text style={{color: '#FFF', fontWeight: 'bold', fontSize: 12, marginLeft: 4}}>Add time</Text>
                    </TouchableOpacity>
                </View>

                {times.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={{color: colors.textSub, fontSize: 13}}>No times configured yet.</Text>
                    </View>
                ) : (
                    <View style={styles.timesList}>
                        {times.map((timeStr, index) => (
                            <View key={index} style={[styles.timeRow, {borderColor: colors.border, backgroundColor: isLightMode ? '#F8FAFC' : '#1E293B'}]}>
                                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                    <Feather name="clock" size={16} color={colors.textSub} style={{marginRight: 8}} />
                                    <Text style={[styles.timeText, {color: colors.textMain}]}>{formatDisplayTime(timeStr)}</Text>
                                    <Text style={[styles.timeSubText, {color: colors.textSub}]}> ({timeStr} 24H)</Text>
                                </View>
                                <TouchableOpacity onPress={() => removeTime(timeStr)} disabled={saving} style={styles.deleteBtn}>
                                    <Feather name="trash-2" size={18} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
            </View>

            {/* Dev-only: shows on ANY failed request now, not just HTTP 500s. Consider gating this
                behind __DEV__ before shipping so end users never see raw backend payloads. */}
            {__DEV__ && debugLog !== '' && debugIsError && (
                <View style={styles.debugBox}>
                    <Text style={styles.debugTitle}>Request Failed - Debug Details:</Text>
                    <Text style={styles.debugText}>{debugLog}</Text>
                </View>
            )}

          </ScrollView>
      )}

      {showTimePicker && (
          <DateTimePicker 
              value={tempDate} 
              mode="time" 
              display="default"
              onChange={handleTimeConfirm} 
          />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  header: { marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '900' },
  
  card: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16, elevation: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: 'bold' },
  
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 16 },
  addTimeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, minWidth: 80, justifyContent: 'center' },
  
  emptyState: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  
  timesList: { width: '100%' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderWidth: 1, borderRadius: 10, marginBottom: 10 },
  timeText: { fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  timeSubText: { fontSize: 11 },
  deleteBtn: { padding: 5 },

  debugBox: { marginTop: 20, backgroundColor: '#1E293B', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#EF4444' },
  debugTitle: { color: '#FCA5A5', fontWeight: 'bold', marginBottom: 8, fontSize: 13 },
  debugText: { color: '#F8FAFC', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }
});
