import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { replace } from './NavigationService'; 

export const API_BASE = 'https://hrms.dcstechnosis.com/api';

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      
      await AsyncStorage.multiRemove([
        'userToken', 'userId', 'employeeId', 'userName', 'userRole', 'userPermissions'
      ]);

      // 🚀 Naya Alert Text Design
      Alert.alert(
        "Ohh No! 🚨", 
        "Session expired.\n\nPlease click ok to log in again.",
        [
          { 
            text: "OK", 
            onPress: () => replace('Login') 
          }
        ]
      );
    }
    return Promise.reject(error);
  }
);