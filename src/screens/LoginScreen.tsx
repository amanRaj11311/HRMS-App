import React, { useState, useRef, useEffect } from "react";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  View, Text, TextInput, StyleSheet, TouchableOpacity, StatusBar, 
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, 
  Dimensions, Animated, Easing, Image
} from "react-native";
import Feather from 'react-native-vector-icons/Feather';
import { API_BASE } from '../api/api';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenHeight < 700;
const isTallScreen = screenHeight > 820;
const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginStatus, setLoginStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  
  const buttonWidth = useRef(new Animated.Value(screenWidth - 60)).current; 
  const formTranslateX = useRef(new Animated.Value(0)).current; 
  const entranceAnims = useRef([...Array(5)].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = entranceAnims.map(anim => Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.exp) }));
    Animated.stagger(120, animations).start();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Animated.sequence([ 
          Animated.timing(formTranslateX, { toValue: -10, duration: 50, useNativeDriver: true }), 
          Animated.timing(formTranslateX, { toValue: 10, duration: 50, useNativeDriver: true }), 
          Animated.timing(formTranslateX, { toValue: 0, duration: 50, useNativeDriver: true }) 
      ]).start();
      return Alert.alert("Required", "Please enter Email and Password");
    }

    setLoginStatus('loading');
    Animated.timing(buttonWidth, { toValue: 56, duration: 300, useNativeDriver: false }).start();

    try {
      const response = await axios.post(`${API_BASE}/auth/login`, { email: email.trim().toLowerCase(), password });
      const { token, user } = response.data;
      
      if (token && user) {
        let extractedRole = 'EMPLOYEE';
        if (user.role) {
            if (typeof user.role === 'string') extractedRole = user.role;
            else if (user.role.name) extractedRole = user.role.name;
        }

        await AsyncStorage.setItem('userToken', token);
        await AsyncStorage.setItem('userId', String(user.id || user._id || ''));
        await AsyncStorage.setItem('employeeId', String(user.employeeId || user.id || ''));
        await AsyncStorage.setItem('userName', `${user.firstName || ''} ${user.lastName || ''}`.trim());
        await AsyncStorage.setItem('userRole', extractedRole.toUpperCase());
        await AsyncStorage.setItem('userPermissions', JSON.stringify(user.permissions || []));
        await AsyncStorage.setItem('keepLoggedIn', remember ? 'true' : 'false');
        await AsyncStorage.setItem('userDesignation', String(user.designation || 'N/A'));
        await AsyncStorage.setItem('userDepartment', String(user.department || 'N/A'));
        await AsyncStorage.setItem('userDoj', String(user.dateOfJoining || ''));
        
        const bank = user.bankDetails || {};
        await AsyncStorage.setItem('userBankAcc', String(bank.accountNumber || '-'));
        await AsyncStorage.setItem('userBankName', String(bank.bankName || '-'));
        await AsyncStorage.setItem('userBankIfsc', String(bank.ifscCode || '-'));

        if (user.avatar) await AsyncStorage.setItem('userAvatar', user.avatar);
        else await AsyncStorage.removeItem('userAvatar');
        
        setLoginStatus('success');
        setTimeout(() => navigation.replace("DrawerRoot"), 800);
      }
    } catch (error: any) {
      Animated.timing(buttonWidth, { toValue: screenWidth - 60, duration: 300, useNativeDriver: false }).start(() => {
        setLoginStatus('idle');
        Alert.alert("Login Failed", error.response?.data?.message || "Invalid credentials");
      });
    }
  };

  const getEntranceStyle = (index: number) => ({ opacity: entranceAnims[index], transform: [{ translateY: entranceAnims[index].interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] });

return (
  <KeyboardAvoidingView
    style={styles.container}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  >
 <StatusBar
  barStyle="dark-content"
  backgroundColor="#F3F7FB"
  translucent={false}
/>

    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heroSection}>
        <Image
          source={require('../assets/hrms_illustration.png')}
          style={styles.heroImage}
          resizeMode="contain"
        />
      </View>

      <Animated.View style={[styles.formCard, { transform: [{ translateX: formTranslateX }] }]}>
        <Animated.View style={getEntranceStyle(0)}>
          <Text style={styles.welcomeTitle}>Welcome Back!</Text>
          <Text style={styles.welcomeSub}>Login to continue</Text>
        </Animated.View>

        <Animated.View style={getEntranceStyle(1)}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputContainer}>
            <Feather name="mail" size={20} color="#94A3B8" />
            <TextInput
              style={styles.input}
              placeholder="name@company.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </Animated.View>

        <Animated.View style={getEntranceStyle(2)}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputContainer}>
            <Feather name="lock" size={20} color="#94A3B8" />
            <TextInput
              style={styles.input}
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={styles.rememberRow}>
            <TouchableOpacity
              style={[styles.checkbox, remember && styles.checked]}
              onPress={() => setRemember(!remember)}
            >
              {remember && <Feather name="check" size={14} color="#fff" />}
            </TouchableOpacity>
            <Text style={styles.rememberText}>Keep me logged in</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.btnContainer, getEntranceStyle(3)]}>
          <AnimatedTouchableOpacity
            style={[
              styles.loginBtn,
              { width: buttonWidth },
              loginStatus === 'success' && { backgroundColor: "#10B981" },
            ]}
            onPress={handleLogin}
            disabled={loginStatus !== 'idle'}
          >
            {loginStatus === 'idle' ? (
              <Text style={styles.loginText}>LOGIN</Text>
            ) : loginStatus === 'loading' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Feather name="check" size={24} color="#fff" />
            )}
          </AnimatedTouchableOpacity>
        </Animated.View>
      </Animated.View>
    </ScrollView>
  </KeyboardAvoidingView>
);
}

const styles = StyleSheet.create({
container: {
  flex: 1,
  backgroundColor: '#F3F7FB',
},

scrollContent: {
  flexGrow: 1,
  backgroundColor: '#F3F7FB',
},

heroSection: {
  height: isSmallScreen ? screenHeight * 0.42 : isTallScreen ? screenHeight * 0.43 : screenHeight * 0.44,
  backgroundColor: '#F3F7FB',
  justifyContent: 'center',
  alignItems: 'center',
  paddingTop: statusBarHeight,
  paddingBottom: 0,
},

heroImage: {
  width: isSmallScreen ? screenWidth * 0.95 : screenWidth * 1.0,
  height: isSmallScreen ? screenHeight * 0.34 : screenHeight * 0.38,
  transform: [{ translateY: isSmallScreen ? 1 : 1 }],
},

formCard: {
  flex: 1,
  minHeight: isSmallScreen ? screenHeight * 0.58 : screenHeight * 0.56,
  backgroundColor: '#ffffff',
  borderTopLeftRadius: 32,
  borderTopRightRadius: 32,
  paddingHorizontal: 32,
  paddingTop: isSmallScreen ? 30 : 38,
  paddingBottom: 20,
  marginTop: 0,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 12,
},
loginBtn: {
  backgroundColor: "#1976D2",
  height: 56,
  borderRadius: 28,
  justifyContent: "center",
  alignItems: "center",
  flexDirection: 'row',
  shadowColor: "#1976D2",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.25,
  shadowRadius: 8,
  elevation: 6,
},

  welcomeTitle: { fontSize: 26, fontWeight: "900", color: "#1E293B" },
  welcomeSub: { fontSize: 14, color: "#64748B", marginTop: 5, marginBottom: 20 },

  label: { fontSize: 14, fontWeight: "700", color: "#475569", marginBottom: 8, marginTop: 10 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 14, backgroundColor: '#F8FAFC', paddingHorizontal: 15, height: 55 },
  input: { flex: 1, fontSize: 16, color: '#1E293B', marginLeft: 10 },
  
  rememberRow: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: "#CBD5E1", borderRadius: 6, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checked: { backgroundColor: "#1976D2", borderColor: "#1976D2" },
  rememberText: { fontSize: 14, color: "#64748B", fontWeight: '500' },
  
  btnContainer: { alignItems: 'center', justifyContent: 'center', height: 57, marginTop: 10 },

  loginText: { color: "#fff", fontWeight: "bold", fontSize: 17, letterSpacing: 1 }
});