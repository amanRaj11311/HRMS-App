import React, { useState, useRef, useEffect } from "react";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Animated, Easing } from "react-native";
import Feather from 'react-native-vector-icons/Feather';
// 🚀 FIXED: Imported the centralized Base API URL to maintain system DRY standards
import { API_BASE } from '../api/api';

const { width: screenWidth } = Dimensions.get('window');
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
      // 🚀 FIXED: Substituted the absolute static domain origin with the dynamic API_BASE mapping standard
      const response = await axios.post(`${API_BASE}/auth/login`, { email: email.trim().toLowerCase(), password });
      const { token, user } = response.data;
      
      if (token && user) {
        // 🚀 DYNAMIC ROLE EXTRACTION (Handles both Object and String)
        let extractedRole = 'EMPLOYEE';
        if (user.role) {
            if (typeof user.role === 'string') extractedRole = user.role;
            else if (user.role.name) extractedRole = user.role.name;
        }

        await AsyncStorage.setItem('userToken', token);
        await AsyncStorage.setItem('userId', String(user.id || user._id || ''));
        await AsyncStorage.setItem('employeeId', String(user.employeeId || user.id || ''));
        await AsyncStorage.setItem('userName', `${user.firstName || ''} ${user.lastName || ''}`.trim());
        
        // Save dynamically fetched role
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: '#fff' }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.topSection}>
            <View style={styles.shapeLeft} />
            <View style={styles.shapeRight} />
            <Animated.View style={[styles.titleWrapper, getEntranceStyle(0)]}>
                <Text style={styles.headerTitle}>My HRMS</Text>
                <View style={styles.titleUnderline} />
            </Animated.View>
        </View>
        <Animated.View style={[styles.form, { transform: [{ translateX: formTranslateX }] }]}>
          <Animated.View style={getEntranceStyle(1)}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputContainer}>
                  <Feather name="mail" size={20} color="#94A3B8" />
                  <TextInput style={styles.input} placeholder="name@company.com" value={email} onChangeText={setEmail} autoCapitalize="none" />
              </View>
          </Animated.View>
          
          <Animated.View style={getEntranceStyle(2)}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                  <Feather name="lock" size={20} color="#94A3B8" />
                  <TextInput style={styles.input} secureTextEntry={!showPassword} placeholder="••••••••" value={password} onChangeText={setPassword} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#94A3B8" />
                  </TouchableOpacity>
              </View>
            <View style={styles.rememberRow}>
                <TouchableOpacity style={[styles.checkbox, remember && styles.checked]} onPress={() => setRemember(!remember)}>
                    {remember && <Feather name="check" size={14} color="#fff" />}
                </TouchableOpacity>
                <Text style={styles.rememberText}>Keep me logged in</Text>
            </View>
          </Animated.View>
          
          <Animated.View style={[styles.btnContainer, getEntranceStyle(3)]}>
              <AnimatedTouchableOpacity style={[styles.loginBtn, { width: buttonWidth }, loginStatus === 'success' && { backgroundColor:"#3B82F6" }]} onPress={handleLogin} disabled={loginStatus !== 'idle'}>
                  {loginStatus === 'idle' ? <Text style={styles.loginText}>LOGIN</Text> : loginStatus === 'loading' ? <ActivityIndicator color="#fff" /> : <Feather name="check" size={24} color="#fff" />}
              </AnimatedTouchableOpacity>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  topSection: { height: 350, width: '100%', position: 'relative' },
  shapeRight: { position: "absolute", width: 500, height: 500, borderRadius: 250, backgroundColor: "#151965", top: -140, left: screenWidth * 0.15 },
  shapeLeft: { position: "absolute", width: 400, height: 400, borderRadius: 200, backgroundColor: "#5DADE2", top: -60, left: -160 },
  titleWrapper: { position: "absolute", top: 150, right: 35, alignItems: 'flex-end' },
  headerTitle: { fontSize: 38, fontWeight: "900", color: "#FFFFFF" },
  titleUnderline: { width: 60, height: 6, backgroundColor: '#5DADE2', marginTop: 8, borderRadius: 3 },
  form: { paddingHorizontal: 30 },
  label: { fontSize: 14, fontWeight: "700", color: "#475569", marginBottom: 8, marginTop: 15 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 14, backgroundColor: '#F8FAFC', paddingHorizontal: 15, height: 55 },
  input: { flex: 1, fontSize: 16, color: '#1E293B', marginLeft: 10 },
  rememberRow: { flexDirection: "row", alignItems: "center", marginVertical: 25 },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: "#CBD5E1", borderRadius: 6, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checked: { backgroundColor: "#1976D2", borderColor: "#1976D2" },
  rememberText: { fontSize: 14, color: "#64748B" },
  btnContainer: { alignItems: 'center', justifyContent: 'center', height: 57 },
  loginBtn: { backgroundColor: "#1976D2", height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", flexDirection: 'row' },
  loginText: { color: "#fff", fontWeight: "bold", fontSize: 18 }
});