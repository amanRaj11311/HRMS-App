import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  ActivityIndicator, StatusBar, Platform, RefreshControl
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme';
import GlobalAppBar from '../components/GlobalAppBar';
import { API_BASE } from '../api/api';

// NOTE: Assuming the list endpoint is GET /api/notifications (mirrors the
// /api/settings/notifications fix from the schedule screen). If your backend
// uses a different path (e.g. /api/notifications/employee), update this one
// constant - nothing else in the file needs to change.
const NOTIFICATIONS_LIST_ENDPOINT = `${API_BASE}/notifications`;

interface NotificationItem {
  id: string;
  message: string;
}

export default function NotificationListScreen({ navigation }: any) {
  const { colors, isLightMode } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setErrorMsg('');

      const token = await AsyncStorage.getItem('userToken');

      const res = await axios.get(NOTIFICATIONS_LIST_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });

      // Backend has returned data under a couple of different shapes across
      // this app's endpoints (`data`, `data.notifications`, plain array) -
      // handle them all rather than assuming one.
      const raw = res.data?.data?.notifications ?? res.data?.data ?? res.data ?? [];
      const list: any[] = Array.isArray(raw) ? raw : [];

      const normalized: NotificationItem[] = list
        .map((item, index) => ({
          id: String(item?._id ?? item?.id ?? index),
          message: item?.message ?? item?.msg ?? item?.text ?? ''
        }))
        .filter(n => n.message.trim().length > 0);

      setNotifications(normalized);
    } catch (e: any) {
      console.log('Fetch Notifications Error:', e);
      setErrorMsg('Could not load notifications. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]));

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: isLightMode ? '#EEF2FF' : '#1E293B' }]}>
        <Feather name="bell" size={16} color={colors.primary} />
      </View>
      <Text style={[styles.messageText, { color: colors.textMain }]}>{item.message}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isLightMode ? 'dark-content' : 'light-content'} translucent backgroundColor="transparent" />

      <View style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg }}>
        <GlobalAppBar navigation={navigation} title="Notifications" />
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            notifications.length === 0 ? styles.emptyListContent : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotifications(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerFill}>
              <Feather name="bell-off" size={28} color={colors.textSub} />
              <Text style={{ color: colors.textSub, fontSize: 13, marginTop: 10, textAlign: 'center' }}>
                {errorMsg || 'No notifications yet.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },

  listContent: { padding: 16, paddingBottom: 100 },
  emptyListContent: { flexGrow: 1, padding: 16 },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1
  },
  messageText: { flex: 1, fontSize: 14, lineHeight: 20 }
});
