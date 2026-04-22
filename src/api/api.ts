import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const apiClient = axios.create({
  // ⚠️ Check karo backend ka base URL yehi hai na? 
  // Website link ke hisaab se shayad: 'https://hrms.dcstechnosis.com/api'
  baseURL: 'https://hrms.dcstechnosis.com/api', 
  timeout: 15000, // Mobile network thoda slow ho sakta hai isliye 15s safe hai
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Interceptor: Har request se pehle check karega ki token hai ya nahi
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Token fetch error", error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;