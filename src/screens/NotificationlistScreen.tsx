import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList, SafeAreaView,
  StatusBar, Platform, RefreshControl, TouchableOpacity, Pressable
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme';
import GlobalAppBar from '../components/GlobalAppBar';
import { API_BASE } from '../api/api';

const NOTIFICATIONS_LIST_ENDPOINT = `${API_BASE}/notifications`;
const NOTIFICATIONS_READ_ENDPOINT = (id: string) => `${API_BASE}/notifications/${id}/read`;
const NOTIFICATIONS_READ_ALL_ENDPOINT = `${API_BASE}/notifications/read-all`;

type NotificationType = 'order' | 'payment' | 'promo' | 'alert' | 'system' | 'message';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string; // ISO date string
}

interface Section {
  title: string;
  data: NotificationItem[];
}

// ---------- helpers ----------

const TYPE_META: Record<NotificationType, { icon: string; bg: string; darkBg: string; color: string }> = {
  order:   { icon: 'package',        bg: '#EEF2FF', darkBg: '#1E223B', color: '#6366F1' },
  payment: { icon: 'credit-card',    bg: '#ECFDF5', darkBg: '#12291F', color: '#10B981' },
  promo:   { icon: 'tag',            bg: '#FFF7ED', darkBg: '#332212', color: '#F59E0B' },
  alert:   { icon: 'alert-triangle', bg: '#FEF2F2', darkBg: '#331616', color: '#EF4444' },
  system:  { icon: 'settings',       bg: '#F3F4F6', darkBg: '#1F2430', color: '#6B7280' },
  message: { icon: 'message-circle', bg: '#EFF6FF', darkBg: '#16233B', color: '#3B82F6' },
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function sectionLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This week';
  return 'Earlier';
}

function groupIntoSections(items: NotificationItem[]): Section[] {
  const order = ['Today', 'Yesterday', 'This week', 'Earlier'];
  const map: Record<string, NotificationItem[]> = {};
  items.forEach((n) => {
    const label = sectionLabel(n.createdAt);
    if (!map[label]) map[label] = [];
    map[label].push(n);
  });
  return order.filter((k) => map[k]?.length).map((k) => ({ title: k, data: map[k] }));
}

// ---------- component ----------

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
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      const raw = res.data?.data?.notifications ?? res.data?.data ?? res.data ?? [];
      const list: any[] = Array.isArray(raw) ? raw : [];

      const normalized: NotificationItem[] = list
        .map((item, index) => ({
          id: String(item?._id ?? item?.id ?? index),
          title: item?.title ?? item?.heading ?? 'Notification',
          message: item?.message ?? item?.msg ?? item?.text ?? '',
          type: (item?.type as NotificationType) ?? 'system',
          isRead: Boolean(item?.isRead ?? item?.read ?? false),
          createdAt: item?.createdAt ?? item?.created_at ?? new Date().toISOString(),
        }))
        .filter((n) => n.message.trim().length > 0)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

  const totalCount = notifications.length;
  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);
  const sections = useMemo(() => groupIntoSections(notifications), [notifications]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.patch(NOTIFICATIONS_READ_ENDPOINT(id), {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      console.log('Mark read failed:', e);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.patch(NOTIFICATIONS_READ_ALL_ENDPOINT, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      console.log('Mark all read failed:', e);
    }
  }, []);

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const meta = TYPE_META[item.type] ?? TYPE_META.system;
    return (
      <Pressable
        onPress={() => !item.isRead && markAsRead(item.id)}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.cardBg,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
          !item.isRead && { borderColor: meta.color + '55', borderWidth: 1.5 },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: isLightMode ? meta.bg : meta.darkBg }]}>
          <Feather name={meta.icon} size={17} color={meta.color} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.rowBetween}>
            <Text
              numberOfLines={1}
              style={[
                styles.titleText,
                { color: colors.textMain },
                !item.isRead && { fontWeight: '700' },
              ]}
            >
              {item.title}
            </Text>
            <Text style={[styles.timeText, { color: colors.textSub }]}>{timeAgo(item.createdAt)}</Text>
          </View>
          <Text numberOfLines={2} style={[styles.messageText, { color: colors.textSub }]}>
            {item.message}
          </Text>
        </View>

        {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: meta.color }]} />}
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <Text style={[styles.sectionHeader, { color: colors.textSub, backgroundColor: colors.background }]}>
      {section.title}
    </Text>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isLightMode ? 'dark-content' : 'light-content'} translucent backgroundColor="transparent" />

      <View style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg }}>
        <GlobalAppBar navigation={navigation} title="Notifications" />
      </View>

      {!loading && totalCount > 0 && (
        <View style={[styles.summaryBar, { borderBottomColor: colors.border }]}>
          <Text style={[styles.summaryText, { color: colors.textSub }]}>
            {totalCount} total{unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
          </Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} hitSlop={10}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <SkeletonList colors={colors} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={notifications.length === 0 ? styles.emptyListContent : styles.listContent}
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

function SkeletonList({ colors }: { colors: any }) {
  return (
    <View style={{ padding: 16 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            styles.card,
            { backgroundColor: colors.cardBg, borderColor: colors.border, opacity: 0.5 },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.border }]} />
          <View style={{ flex: 1 }}>
            <View style={{ height: 12, width: '50%', backgroundColor: colors.border, borderRadius: 4, marginBottom: 8 }} />
            <View style={{ height: 10, width: '90%', backgroundColor: colors.border, borderRadius: 4 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },

  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryText: { fontSize: 13, fontWeight: '500' },

  listContent: { padding: 16, paddingBottom: 100 },
  emptyListContent: { flexGrow: 1, padding: 16 },

  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 8,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleText: { fontSize: 14, fontWeight: '600', flexShrink: 1, marginRight: 8 },
  timeText: { fontSize: 11 },
  messageText: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8, marginTop: 4 },
});