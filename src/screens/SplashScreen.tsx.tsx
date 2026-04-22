import React, { useEffect } from "react";
import { View, Image, StyleSheet, StatusBar } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SplashScreen({ navigation }: any) {

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const keepLoggedIn = await AsyncStorage.getItem('keepLoggedIn');
      const token = await AsyncStorage.getItem('userToken');
      const role = await AsyncStorage.getItem('userRole');

      setTimeout(async () => {
        if (token && keepLoggedIn === 'true') {
          const userRole = role ? role.toUpperCase() : 'EMPLOYEE';
          if (userRole === 'ADMIN') {
            navigation.replace('DrawerRoot', { screen: 'AdminDashboard' });
          } else if (userRole === 'HR') {
            navigation.replace('DrawerRoot', { screen: 'HRDashboard' });
          } else {
            navigation.replace('DrawerRoot'); 
          }
        } else {
          await AsyncStorage.removeItem('userToken'); 
          navigation.replace('Login'); // Redirect to Login if not logged in
        }
      }, 1000);

    } catch (error) {
      navigation.replace('Login');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      
      <Image
        source={require("../assets/icon.png")} 
        style={styles.logo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff" 
  },
  logo: {
    width: 200, 
    height: 200,
    resizeMode: "contain"
  }
});