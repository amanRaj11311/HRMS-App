
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Platform } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../constants/theme';
import { API_BASE } from '../api/api';

const NOTIFICATIONS_LIST_ENDPOINT = `${API_BASE}/notifications`;
const LAST_SEEN_ID_KEY = 'lastSeenNotificationId';
const POLL_INTERVAL_MS = 15000; // check every 15s while app is open

export default function NewNotificationPopup() {
  const { colors, isLightMode } = useTheme();
  const navigation = useNavigation<any>();

  const [visible, setVisible] = useState(false);
  const [latestMessage, setLatestMessage] = useState('');
  const [newCount, setNewCount] = useState(0);

  const translateY = useRef(new Animated.Value(-120)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const showBanner = useCallback((message: string, count: number) => {
    setLatestMessage(message);
    setNewCount(count);
    setVisible(true);

    if (hideTimer.current) clearTimeout(hideTimer.current);

    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 14,
      bounciness: 8,
    }).start();

    hideTimer.current = setTimeout(() => hideBanner(), 4000);
  }, []);

  const hideBanner = useCallback(() => {
    Animated.timing(translateY, {
      toValue: -120,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, []);

  const checkForNewNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(NOTIFICATIONS_LIST_ENDPOINT, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      const raw = res.data?.data?.notifications ?? res.data?.data ?? res.data ?? [];
      const list: any[] = Array.isArray(raw) ? raw : [];
      if (list.length === 0) return;

      const normalized = list
        .map((item, index) => ({
          id: String(item?._id ?? item?.id ?? index),
          message: item?.message ?? item?.msg ?? item?.text ?? '',
          createdAt: item?.createdAt ?? item?.created_at ?? new Date().toISOString(),
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const newestId = normalized[0].id;
      const lastSeenId = await AsyncStorage.getItem(LAST_SEEN_ID_KEY);

      if (lastSeenId === null) {
        // first ever run on this device — just remember the newest, don't pop up
        await AsyncStorage.setItem(LAST_SEEN_ID_KEY, newestId);
        return;
      }

      if (lastSeenId !== newestId) {
        const lastSeenIndex = normalized.findIndex((n) => n.id === lastSeenId);
        const freshOnes = lastSeenIndex === -1 ? [normalized[0]] : normalized.slice(0, lastSeenIndex);

        if (freshOnes.length > 0) {
          await AsyncStorage.setItem(LAST_SEEN_ID_KEY, newestId);
          showBanner(freshOnes[0].message, freshOnes.length);
        }
      }
    } catch (e) {
      // stay silent — this is a background check, don't disturb the user
      console.log('New-notification check failed:', e);
    }
  }, [showBanner]);

  useEffect(() => {
    checkForNewNotifications();
    pollTimer.current = setInterval(checkForNewNotifications, POLL_INTERVAL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [checkForNewNotifications]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrapper, { transform: [{ translateY }] }]}
    >
      <Pressable
        onPress={() => {
          hideBanner();
          navigation.navigate('NotificationList');
        }}
        style={[
          styles.banner,
          {
            backgroundColor: colors.cardBg,
            borderColor: colors.border,
            shadowColor: isLightMode ? '#000' : '#000',
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: isLightMode ? '#EEF2FF' : '#1E223B' }]}>
          <Feather name="bell" size={18} color={colors.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textMain }]}>
            {newCount > 1 ? `${newCount} new notifications` : 'New notification for you'}
          </Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSub }]}>
            {latestMessage}
          </Text>
        </View>

        <Pressable onPress={hideBanner} hitSlop={10}>
          <Feather name="x" size={16} color={colors.textSub} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 12,
    right: 12,
    zIndex: 999,
    elevation: 999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: { fontSize: 13, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 1 },
});