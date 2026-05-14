import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Image, SafeAreaView, StatusBar, ScrollView } from "react-native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useTheme } from '../constants/theme';

// --- Screens ---
import SplashScreen from "../screens/SplashScreen.tsx"; 
import WelcomeScreen from "../screens/WelcomeScreen.tsx";
import LoginScreen from "../screens/LoginScreen";
import UnifiedDashboard from "../screens/UnifiedDashboard"; 
import AttendanceModule from "../screens/AttendanceModule"; 
import LeavesModule from "../screens/LeavesModule"; 

import EmployeesScreen from "../screens/EmployeesScreen";
import PerformanceScreen from "../screens/PerformanceScreen"; 
import AdminAssetsScreen from "../screens/AssetsScreen"; 
import AnalyticsScreen from "../screens/AdminModule/AnalyticsScreen";
import RolesPermissionsScreen from "../screens/AdminModule/RolesPermissionsScreen"; 

import LeadsScreen from "../screens/LeadsScreen";
import DocumentsScreen from "../screens/DocumentsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import PayslipsScreen from "../screens/PaySlipScreen.tsx";
import AnnouncementsScreen from "../screens/announcementScreen";
// 🚀 FIXED: Retained the direct module binding to the dynamic global API configuration path
import { API_BASE } from '../api/api';


const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();


const getCleanAvatarUrl = (url: string) => {
    if (!url) return '';
    let clean = url.replace(/\\/g, '/'); 
    let fullUrl = clean;
    if (!clean.startsWith('http')) {
        // 🚀 FIXED: Substituted the absolute static domain origin with the dynamic API_BASE pointer mapping
        fullUrl = clean.startsWith('/') ? `${API_BASE.replace('/api', '')}${clean}` : `${API_BASE.replace('/api', '')}/${clean}`;
    }
    return encodeURI(fullUrl); 
};

function CustomDrawerContent(props: any) {
  const { navigation, state } = props;
  const { colors, isLightMode } = useTheme();
  
  const [userName, setUserName] = useState('User');
  const [userDesignation, setUserDesignation] = useState('EMPLOYEE');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [userInitials, setUserInitials] = useState('U');
  const [userAvatar, setUserAvatar] = useState<string | null>(null); 
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchDetails);
    fetchDetails();
    return unsubscribe;
  }, [navigation]);

  const fetchDetails = async () => {
    try {
      setImgError(false);
      const name = await AsyncStorage.getItem('userName');
      const role = await AsyncStorage.getItem('userRole');
      const perms = await AsyncStorage.getItem('userPermissions');
      const token = await AsyncStorage.getItem('userToken');
      const empId = await AsyncStorage.getItem('employeeId');
      
      const localAvatar = await AsyncStorage.getItem('userAvatar');

      if (name && name !== 'User') {
          setUserName(name);
          const parts = name.trim().split(" ");
          setUserInitials(
            parts.length > 1
              ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
              : name.substring(0, 2).toUpperCase()
          );
      }
      
      if (perms) {
          const parsedPerms = JSON.parse(perms);
          setPermissions(parsedPerms.map((p: string) => p.toUpperCase()));
      }

      if (localAvatar && localAvatar.length > 5 && !localAvatar.includes('ui-avatars')) {
          setUserAvatar(getCleanAvatarUrl(localAvatar));
      } else {
          setUserAvatar(null);
      }

      if (token && empId && empId !== 'undefined') {
          try {
              const res = await axios.get(`${API_BASE}/employees/${empId}`, { headers: { Authorization: `Bearer ${token}` } });
              const empData = res.data?.data || res.data;
              if (empData) {
                  if (empData.designation) setUserDesignation(empData.designation);
                  else if (role) setUserDesignation(role.toUpperCase());
                  
                  if (!localAvatar && (empData.avatar || empData.avatarUrl || empData.userId?.avatar)) {
                      let rawAvatar = empData.avatar || empData.avatarUrl || empData.userId?.avatar;
                      let cleanUrl = getCleanAvatarUrl(rawAvatar);
                      setUserAvatar(cleanUrl);
                      await AsyncStorage.setItem('userAvatar', cleanUrl); 
                  }
              }
          } catch(e) {
              if (role) setUserDesignation(role.toUpperCase());
          }
      } else if (role) {
          setUserDesignation(role.toUpperCase());
      }
      
    } catch (e) {
      console.log("Drawer Fetch Error", e);
    }
  };

  const hasModulePerm = (moduleKey: string) => {
    if (!moduleKey) return true; 
    return permissions.some(p => p.includes(moduleKey.toUpperCase()));
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
        { text: "Cancel", style: "cancel" }, 
        { text: "Logout", style: "destructive", onPress: async () => {
          await AsyncStorage.clear();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }}
    ]);
  };

  const menuSections = [
    { title: 'MAIN', items: [{ label: 'Dashboard', icon: 'view-dashboard-outline', activeIcon: 'view-dashboard', screen: 'Dashboard' }, { label: 'Analytics', icon: 'chart-pie', activeIcon: 'chart-pie', screen: 'Analytics', perm: 'ANALYTICS'},{ label: 'Roles & Permissions', icon: 'shield-account-outline', activeIcon: 'shield-account', screen: 'RolesPermissions', perm: 'ROLE'  }] },
    { title: 'PEOPLE', items: [{ label: 'Employees', icon: 'account-group-outline', activeIcon: 'account-group', screen: 'Employees', perm: 'EMPLOYEE' },{ label: 'Leads', icon: 'account-multiple-plus-outline', activeIcon: 'account-multiple-plus', screen: 'Leads', perm: 'LEADS' }, ] },
    { title: 'OPERATIONS', items: [{ label: 'Assets', icon: 'briefcase-outline', activeIcon: 'briefcase', screen: 'Assets', perm: 'ASSET' },{ label: 'Attendance', icon: 'calendar-check-outline', activeIcon: 'calendar-check', screen: 'Attendance', perm: 'ATTENDANCE' }, { label: 'Leaves', icon: 'calendar-blank-outline', activeIcon: 'calendar-month', screen: 'Leaves', perm: 'LEAVES' },  { label: 'Payslips', icon: 'file-document-outline', activeIcon: 'file-document', screen: 'Payslips', perm: 'SALARY-SLIP' }, { label: 'Performance', icon: 'star-outline', activeIcon: 'star', screen: 'Performance', perm: 'PERFORMANCE' }, ] },
    { title: 'COMPANY', items: [{ label: 'Announcements', icon: 'bullhorn-outline', activeIcon: 'bullhorn', screen: 'Announcements', perm: 'ANNOUNCEMENT' },{ label: 'Documents', icon: 'folder-outline', activeIcon: 'folder', screen: 'Documents' }, { label: 'Settings', icon: 'cog-outline', activeIcon: 'cog', screen: 'Settings' }] }
  ];

  return (
    <View style={styles.floatingMenuWrapper}>
      <View style={[styles.floatingMenuCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        
        {/* Header Section */}
        <View style={[styles.headerContainer, { borderBottomColor: colors.border, backgroundColor: isLightMode ? '#F8FAFC' : '#1E293B' }]}>
            <View style={styles.userProfileSection}>
                <View style={[styles.avatarBox, { borderColor: colors.primary }]}>
                    {userAvatar && !imgError ? (
                        <Image source={{ uri: userAvatar }} style={styles.avatarImage} onError={() => setImgError(true)} />
                    ) : (
                        <Text style={styles.avatarText}>{userInitials}</Text>
                    )}
                </View>
                <View style={styles.userInfo}>
                    <Text style={[styles.userName, {color: colors.textMain}]} numberOfLines={1}>{userName}</Text>
                    <View style={[styles.roleBadge, { backgroundColor: isLightMode ? '#DBEAFE' : 'rgba(59, 130, 246, 0.2)' }]}>
                        <Text style={[styles.userRole, {color: colors.primary}]} numberOfLines={1}>{userDesignation}</Text>
                    </View>
                </View>
            </View>
        </View>

        {/* 🚀 FIXED: Changed to Standard ScrollView to wrap perfectly around content without stretching */}
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingTop: 10, paddingBottom: 10}}>
          <View style={{paddingHorizontal: 12}}>
              {menuSections.map((section, idx) => {
                  const visibleItems = section.items.filter(item => !item.perm || hasModulePerm(item.perm));
                  if (visibleItems.length === 0) return null;
                  
                  return (
                    <View key={idx} style={styles.sectionBlock}>
                      <Text style={[styles.sectionLabel, {color: isLightMode ? '#94A3B8' : '#64748B'}]}>{section.title}</Text>
                      {visibleItems.map((item, i) => {
                        const isFocused = state.routes[state.index].name === item.screen;
                        return (
                          <TouchableOpacity key={i} style={[styles.menuItem, isFocused && {backgroundColor: isLightMode ? '#EFF6FF' : 'rgba(59, 130, 246, 0.15)'}]} onPress={() => navigation.navigate(item.screen)}>
                            <MaterialCommunityIcons name={isFocused ? item.activeIcon : item.icon} size={22} color={isFocused ? colors.primary : colors.textSub} />
                            <Text style={[styles.menuText, {color: isFocused ? colors.primary : colors.textMain, fontWeight: isFocused ? 'bold' : '600'}]}>{item.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
              })}
          </View>
        </ScrollView>
        
        {/* Footer Section (Logout) */}
        <View style={[styles.footer, {borderTopColor: colors.border}]}>
          <TouchableOpacity style={[styles.logoutBtn, {backgroundColor: isLightMode ? '#FEE2E2' : '#450A0A'}]} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout-variant" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
}

export function MyDrawer() {
  const { colors } = useTheme();
  return (
    <Drawer.Navigator 
        drawerContent={(props) => <CustomDrawerContent {...props} />} 
        screenOptions={{ 
            headerShown: false, 
            drawerStyle: { width: 300, backgroundColor: 'transparent' }, 
            drawerPosition: 'left',
            drawerType: 'front', 
            overlayColor: 'rgba(0,0,0,0.4)'
        }} 
        initialRouteName="Dashboard"
    >
      <Drawer.Screen name="Dashboard" component={UnifiedDashboard} />
      <Drawer.Screen name="Attendance" component={AttendanceModule} />
      <Drawer.Screen name="Leaves" component={LeavesModule} /> 
      <Drawer.Screen name="Performance" component={PerformanceScreen} />
      <Drawer.Screen name="Employees" component={EmployeesScreen} />
      <Drawer.Screen name="Announcements" component={AnnouncementsScreen} />
      <Drawer.Screen name="RolesPermissions" component={RolesPermissionsScreen} />
      <Drawer.Screen name="Analytics" component={AnalyticsScreen} />
      <Drawer.Screen name="Assets" component={AdminAssetsScreen} />
      <Drawer.Screen name="Leads" component={LeadsScreen} />
      <Drawer.Screen name="Documents" component={DocumentsScreen} /> 
      <Drawer.Screen name="Settings" component={SettingsScreen} />
      <Drawer.Screen name="Payslips" component={PayslipsScreen} />
    </Drawer.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
       <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="DrawerRoot" component={MyDrawer} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  // 🚀 FIXED: Wrapped to align top and removed flex: 1 from card to wrap content
  floatingMenuWrapper: {
      flex: 1,
      backgroundColor: 'transparent',
      paddingRight: 10, 
      paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 50,
      paddingBottom: 20, 
      justifyContent: 'flex-start', // <--- Pushes everything to the top
  },
  floatingMenuCard: {
      // 🚀 FIXED: flex: 1 removed. Now it sizes to content.
      borderRadius: 16, 
      overflow: 'hidden', 
      elevation: 15, 
      shadowColor: '#000', 
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      borderWidth: 1,
      maxHeight: '95%', // <--- Stops it from exceeding screen if there are many links
  },
  
  headerContainer: { 
      paddingVertical: 20, 
      paddingHorizontal: 20, 
      borderBottomWidth: 1 
  },
  userProfileSection: { flexDirection: 'row', alignItems: 'center' },
  avatarBox: { 
      width: 46, 
      height: 46, 
      borderRadius: 23, 
      backgroundColor: '#3B82F6', 
      justifyContent: 'center', 
      alignItems: 'center', 
      borderWidth: 2, 
      overflow: 'hidden' 
  },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  userInfo: { marginLeft: 14, flex: 1, justifyContent: 'center' },
  userName: { fontSize: 16, fontWeight: '900', marginBottom: 4, letterSpacing: -0.3 },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  userRole: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  
  sectionBlock: { marginBottom: 15 }, 
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4, paddingHorizontal: 16 },
  menuItem: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      paddingVertical: 10, 
      paddingHorizontal: 16, 
      marginHorizontal: 4, 
      borderRadius: 8, 
      marginBottom: 2 
  },
  menuText: { fontSize: 14, marginLeft: 16 },
  
  footer: { 
      borderTopWidth: 1,
      padding: 16,
  },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12 },
  logoutText: { color: '#EF4444', fontWeight: '800', marginLeft: 8, fontSize: 14 }
});