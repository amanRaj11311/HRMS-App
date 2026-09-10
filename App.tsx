import 'react-native-gesture-handler'; 
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from "./src/navigation/AppNavigator";
import {
  initializeNotifications,
  requestNotificationPermission,
} from './src/services/notificationService';
import NewNotificationPopup from './src/components/NewNotificationPopup';

import { navigationRef } from './src/api/NavigationService'; 

import { ThemeProvider } from "./src/constants/theme";

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState("LoginScreen"); 

  useEffect(() => {
    initializeNotifications();
    requestNotificationPermission();

    const checkAuthStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const keepLoggedIn = await AsyncStorage.getItem('keepLoggedIn');

        if (token) {
          if (keepLoggedIn === 'false') {
            await AsyncStorage.removeItem('userToken');
            setInitialRoute("Login"); 
          } else {
            setInitialRoute("DrawerRoot"); 
          }
        } else {
          setInitialRoute("Login");
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setIsReady(true);
      }
    };

    checkAuthStatus();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <NavigationContainer ref={navigationRef}>
        <AppNavigator initialRoute={initialRoute} />
        {/* Mounted once at root so it works no matter which screen the user is on.
            Polls for new notifications only while the app is open in foreground. */}
        <NewNotificationPopup />
      </NavigationContainer>
    </ThemeProvider>
  );
}