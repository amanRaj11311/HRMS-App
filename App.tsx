import 'react-native-gesture-handler'; // 1. First line always
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from "./src/navigation/AppNavigator";

// Custom Theme Provider
import { ThemeProvider } from "./src/constants/theme";

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState("LoginScreen"); // Default to Login

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const keepLoggedIn = await AsyncStorage.getItem('keepLoggedIn');

        if (token) {
          if (keepLoggedIn === 'false') {
            // User did NOT check "Keep me logged in", so clear session on fresh start
            await AsyncStorage.removeItem('userToken');
            setInitialRoute("Login"); // Go to Login
          } else {
            // User checked it, and token exists, so bypass login
            setInitialRoute("DrawerRoot"); // Go to Dashboard
          }
        } else {
          // No token found, go to Login
          setInitialRoute("Login");
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        // Stop the loading spinner once checking is done
        setIsReady(true);
      }
    };

    checkAuthStatus();
  }, []);

  // Show a loading spinner while checking AsyncStorage
  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <NavigationContainer>
        {/* Pass the calculated starting screen to your Navigator */}
        <AppNavigator initialRoute={initialRoute} />
      </NavigationContainer>
    </ThemeProvider>
  );
}