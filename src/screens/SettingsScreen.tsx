import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  TouchableOpacity, SafeAreaView, TextInput, Alert, Platform, Switch, Image, StatusBar, RefreshControl, KeyboardAvoidingView 
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme'; 
import GlobalAppBar from '../components/GlobalAppBar'; 
import ImagePicker from 'react-native-image-crop-picker';
// 🚀 FIXED: Retained the import of the centralized API configuration
import { API_BASE } from '../api/api';



const safeDecodeJWT = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) { base64 += '='; }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = base64.replace(/=+$/, '');
    let output = '';
    for (let bc = 0, bs = 0, buffer, i = 0; buffer = str.charAt(i++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
    }
    return JSON.parse(decodeURIComponent(output.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  } catch (e) {
    return null;
  }
};

const isMongoId = (id: string) => /^[a-f\d]{24}$/i.test(id);

// 🚀 FIXED: Encodes spaces (e.g. "AMAN RAJ" -> "AMAN%20RAJ") so React Native can load it
const getCleanAvatarUrl = (url: string) => {
    if (!url) return '';
    let clean = url.replace(/\\/g, '/'); // Convert windows slashes to forward slashes
    let fullUrl = clean;
    if (!clean.startsWith('http')) {
        // 🚀 FIXED: Substituted the absolute static domain origin with the dynamic API_BASE pointer mapping
        fullUrl = clean.startsWith('/') ? `${API_BASE.replace('/api', '')}${clean}` : `${API_BASE.replace('/api', '')}/${clean}`;
    }
    return encodeURI(fullUrl); // This is the magic fix for spaces!
};

export default function SettingsScreen({ navigation }: any) {
  const { colors, isLightMode, toggleTheme } = useTheme(); 
  
  const [activeTab, setActiveTab] = useState<'Profile' | 'Password' | 'Appearance' | 'Notifications'>('Profile');
  const allTabs = ['Profile', 'Password', 'Appearance', 'Notifications'];
  
  const [loading, setLoading] = useState<boolean>(true);
  const [saveLoading, setSaveLoading] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [empId, setEmpId] = useState<string>(''); 
  const [userId, setUserId] = useState<string>(''); 
  const [userRole, setUserRole] = useState<string>('Loading...');
  const [userInitials, setUserInitials] = useState('U');

  const [fullEmployeeData, setFullEmployeeData] = useState<any>({});

  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    avatar: '',
    department: 'Loading...'
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const [notifications, setNotifications] = useState({
    leaveStatus: true, payslip: true, announcements: true, attendance: false
  });

  const fetchExactRoleName = async (roleData: any, token: string) => {
      if (!roleData) return '';
      if (typeof roleData === 'object' && roleData.name) return roleData.name; 
      
      if (typeof roleData === 'string' && isMongoId(roleData)) {
          try {
              const res = await axios.get(`${API_BASE}/role/${roleData}`, { headers: { Authorization: `Bearer ${token}` } });
              return res.data?.data?.name || res.data?.name || '';
          } catch (e) {
              return '';
          }
      }
      return typeof roleData === 'string' ? roleData : '';
  };

  const fetchUserData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      
      const token = await AsyncStorage.getItem('userToken');
      let storedEmpId = await AsyncStorage.getItem('employeeId') || '';
      let storedUserId = await AsyncStorage.getItem('userId') || '';
      let localRoleName = await AsyncStorage.getItem('userRole') || 'User';

      if (!token) {
         Alert.alert("Session Expired", "Please login again.");
         handleLogout();
         return;
      }

      let decodedId = storedUserId;
      let decodedRoleId = '';
      let finalFName = 'User';
      let finalLName = '';
      let finalEmail = await AsyncStorage.getItem('userEmail') || '';
      let finalAvatar = await AsyncStorage.getItem('userAvatar') || '';

      const userName = await AsyncStorage.getItem('userName');
      if (userName) {
          const parts = userName.split(' ');
          finalFName = parts[0];
          finalLName = parts.slice(1).join(' ');
      }

      const decoded = safeDecodeJWT(token);
      if (decoded) {
          decodedId = decodedId || decoded.id || decoded._id || decoded.userId;
          decodedRoleId = decoded.role || decoded.roleId || '';
          finalFName = decoded.firstName || finalFName;
          finalLName = decoded.lastName || finalLName;
          finalEmail = decoded.email || finalEmail;
      }

      setUserId(decodedId);
      setEmpId(storedEmpId);

      const isAdmin = String(localRoleName).toUpperCase().includes('ADMIN');

      if (decodedId && isMongoId(decodedId)) {
          const config = { headers: { Authorization: `Bearer ${token}` } };
          let fetchedUserObj: any = {};
          let fetchedEmpObj: any = {};

          try {
             const userRes = await axios.get(`${API_BASE}/users/${decodedId}?_t=${Date.now()}`, config);
             fetchedUserObj = userRes.data?.data || userRes.data || {};
          } catch(e) {}

          if (storedEmpId && isMongoId(storedEmpId)) {
              try {
                  const empRes = await axios.get(`${API_BASE}/employees/${storedEmpId}?_t=${Date.now()}`, config);
                  fetchedEmpObj = empRes.data?.data || empRes.data || {};
              } catch(e) {}
          } else {
              try {
                  const empListRes = await axios.get(`${API_BASE}/employees?userId=${decodedId}&limit=1`, config);
                  const empList = empListRes.data?.data?.data || empListRes.data?.data || [];
                  if(empList.length > 0) fetchedEmpObj = empList[0];
              } catch(e) {}
          }

          setFullEmployeeData(fetchedEmpObj);

          finalFName = fetchedEmpObj.firstName || fetchedUserObj.firstName || finalFName;
          finalLName = fetchedEmpObj.lastName || fetchedUserObj.lastName || finalLName;
          finalEmail = fetchedEmpObj.email || fetchedUserObj.email || finalEmail;
          
          let rawAvatar = fetchedEmpObj.avatarUrl || fetchedEmpObj.avatar || fetchedUserObj.avatar || finalAvatar;
          finalAvatar = getCleanAvatarUrl(rawAvatar);
          
          let finalDept = fetchedEmpObj.department || '';
          if (!finalDept) finalDept = isAdmin ? 'Administration' : 'Not Assigned';

          let finalRole = localRoleName;
          const roleSource = fetchedUserObj.role || fetchedEmpObj.designation || decodedRoleId;
          
          if (isAdmin && !fetchedEmpObj._id) {
              finalRole = 'Super Admin';
          } else {
              const exactRole = await fetchExactRoleName(roleSource, token);
              if (exactRole) finalRole = exactRole;
          }

          setProfileData({
              firstName: finalFName,
              lastName: finalLName,
              email: finalEmail,
              avatar: finalAvatar,
              department: finalDept
          });

          setUserRole(finalRole);
          setUserInitials(`${finalFName.charAt(0) || ''}${finalLName.charAt(0) || ''}`.toUpperCase() || 'U');
      }

    } catch (error) {
      console.log("Settings Fetch logic error", error);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchUserData(); }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUserData(true);
  }, []);

  const handleImageUpload = (image: any) => {
      if (!image || !image.path) return;

      const formData = new FormData();
      formData.append('file', {
          uri: image.path,
          type: image.mime || 'image/jpeg',
          name: image.filename || `profile_${Date.now()}.jpg`
      } as any);

      setUploadingImage(true);
      
      AsyncStorage.getItem('userToken').then(token => {
          axios.post(`${API_BASE}/upload`, formData, {
              headers: { 
                  'Content-Type': 'multipart/form-data', 
                  Authorization: `Bearer ${token}` 
              }
          }).then(res => {
              if (res.data?.success && res.data?.fileUrl) {
                  let newAvatarUrl = getCleanAvatarUrl(res.data.fileUrl);
                  
                  setProfileData({ ...profileData, avatar: newAvatarUrl });
                  Alert.alert("Uploaded", "Image uploaded. Click 'Save Changes' to update profile.");
              } else {
                  Alert.alert("Upload Rejected", "Server rejected the upload. Please try a different image.");
              }
          }).catch(err => {
              // 🚀 FIXED: Clean user-friendly error message
              const errorMsg = err.response?.data?.message || "Image upload failed. Please try again.";
              Alert.alert("Upload Failed", errorMsg);
          }).finally(() => {
              setUploadingImage(false);
          });
      });
  };

  const openGalleryAndCrop = () => {
      ImagePicker.openPicker({
          width: 300,
          height: 300,
          cropping: true,
          cropperCircleOverlay: true, 
          compressImageQuality: 0.7,
          mediaType: 'photo'
      }).then(image => {
          handleImageUpload(image);
      }).catch(e => console.log('Gallery error or cancelled'));
  };

  const handleUpdateProfile = async () => {
    if (!profileData.firstName) return Alert.alert("Required", "First Name is required.");

    setSaveLoading(true);
    
    if (profileData.avatar) {
        await AsyncStorage.setItem('userAvatar', profileData.avatar);
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const payload = { 
          ...fullEmployeeData,
          firstName: profileData.firstName, 
          lastName: profileData.lastName, 
          avatar: profileData.avatar 
      };

      let endpoint = '';
      if (empId && isMongoId(empId)) {
          endpoint = `${API_BASE}/employees/${empId}`;
      } else if (userId && isMongoId(userId)) {
          endpoint = `${API_BASE}/users/${userId}`;
      }

      if (endpoint) {
          await axios.put(endpoint, payload, config);
          
          await AsyncStorage.setItem('userName', `${profileData.firstName} ${profileData.lastName}`.trim());
          setUserInitials(`${profileData.firstName.charAt(0)}${profileData.lastName.charAt(0)}`.toUpperCase());
          
          Alert.alert("Success", "Profile updated successfully!"); 
      } else {
          Alert.alert("Error", "User details missing. Cannot update.");
      }
    } catch (err: any) {
      // 🚀 FIXED: Clean user-friendly error message
      const errorMsg = err.response?.data?.message || "Failed to save changes. Please try again.";
      Alert.alert("Sync Error", errorMsg);
    } finally {
      setSaveLoading(false);
      fetchUserData(true); 
    }
  };

  const handleUpdatePassword = async () => {
      if (!passwordData.newPassword || !passwordData.confirmPassword) return Alert.alert("Required", "Fill all password fields.");
      if (passwordData.newPassword.length < 6) return Alert.alert("Error", "Password must be at least 6 characters.");
      if (passwordData.newPassword !== passwordData.confirmPassword) return Alert.alert("Error", "Passwords do not match.");

      try {
        setSaveLoading(true);
        const token = await AsyncStorage.getItem('userToken');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        
        let endpoint = '';
        let payload: any = {};

        if (empId && isMongoId(empId)) {
            endpoint = `${API_BASE}/employees/${empId}`;
            payload = { ...fullEmployeeData, password: passwordData.newPassword };
        } else if (userId && isMongoId(userId)) {
            endpoint = `${API_BASE}/users/${userId}`;
            payload = { password: passwordData.newPassword };
        } else {
            Alert.alert("Error", "Invalid User ID.");
            setSaveLoading(false);
            return;
        }

        await axios.put(endpoint, payload, config);
        Alert.alert("Success", "Password updated successfully!");
        setPasswordData({ newPassword: '', confirmPassword: '' });
      } catch (error: any) {
        // 🚀 FIXED: Clean user-friendly error message
        const errorMsg = error.response?.data?.message || "Failed to update password. Please try again.";
        Alert.alert("Update Failed", errorMsg);
      } finally {
        setSaveLoading(false);
      }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to exit your session?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Logout", 
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.clear(); 
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); 
          }
        }
      ]
    );
  };

  const renderContent = () => {
      if (activeTab === 'Profile') {
          return (
              <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="account-edit-outline" size={22} color={colors.primary} style={{ marginRight: 8 }} />
                    <Text style={[styles.cardTitle, { color: colors.textMain }]}>Profile Information</Text>
                  </View>
                  
                  <View style={styles.formRow}>
                      <View style={styles.inputGroup}>
                          <Text style={[styles.label, {color:colors.textMain}]}>First Name</Text>
                          <TextInput style={[styles.input, {color:colors.textMain, borderColor:colors.border}]} value={profileData.firstName} onChangeText={(t)=>setProfileData({...profileData, firstName:t})} />
                      </View>
                      <View style={styles.inputGroup}>
                          <Text style={[styles.label, {color:colors.textMain}]}>Last Name</Text>
                          <TextInput style={[styles.input, {color:colors.textMain, borderColor:colors.border}]} value={profileData.lastName} onChangeText={(t)=>setProfileData({...profileData, lastName:t})} />
                      </View>
                  </View>

                  <View style={styles.fullWidthContainer}>
                      <Text style={[styles.label, {color:colors.textMain}]}>Email <Text style={{fontSize:10, color:colors.textSub}}>(Read-only)</Text></Text>
                      <View style={[styles.input, {justifyContent: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#1e293b', borderColor: colors.border}]}>
                          <Text style={{color: colors.textSub, fontSize: 14}} numberOfLines={1}>{profileData.email}</Text>
                      </View>
                  </View>

                  <View style={styles.warningBanner}>
                    <MaterialCommunityIcons name="information" size={16} color="#D97706" style={{ marginRight: 8 }} />
                    <Text style={styles.warningText}>Role, department, and designation modifications are restricted by system policies.</Text>
                  </View>

                  <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateProfile} disabled={saveLoading || uploadingImage}>
                      {saveLoading ? <ActivityIndicator color="#fff" /> : (
                          <>
                             <MaterialCommunityIcons name="content-save-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                             <Text style={styles.saveBtnText}>Save Changes</Text>
                          </>
                      )}
                  </TouchableOpacity>
              </View>
          );
      }

      if (activeTab === 'Password') {
          return (
              <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="lock-reset" size={22} color={colors.primary} style={{ marginRight: 8 }} />
                    <Text style={[styles.cardTitle, { color: colors.textMain }]}>Change Password</Text>
                  </View>
                  
                  <View style={{marginBottom: 15}}>
                      <Text style={[styles.label, {color:colors.textMain}]}>New Password</Text>
                      <TextInput 
                        style={[styles.input, {color:colors.textMain, borderColor:colors.border}]} 
                        secureTextEntry 
                        value={passwordData.newPassword} 
                        onChangeText={(t)=>setPasswordData({...passwordData, newPassword:t})} 
                        placeholder="Min 6 characters"
                        placeholderTextColor={colors.textSub}
                      />
                      {passwordData.newPassword.length > 0 && (
                        <Text style={[styles.helperText, { color: passwordData.newPassword.length >= 6 ? '#10B981' : '#EF4444' }]}>
                          {passwordData.newPassword.length >= 6 ? 'Strong' : 'Weak'}
                        </Text>
                      )}
                  </View>

                  <View style={{marginBottom: 20}}>
                      <Text style={[styles.label, {color:colors.textMain}]}>Confirm Password</Text>
                      <TextInput 
                        style={[styles.input, {color:colors.textMain, borderColor:colors.border}]} 
                        secureTextEntry 
                        value={passwordData.confirmPassword} 
                        onChangeText={(t)=>setPasswordData({...passwordData, confirmPassword:t})} 
                        placeholder="Repeat new password"
                        placeholderTextColor={colors.textSub}
                      />
                      {passwordData.confirmPassword.length > 0 && (
                        <Text style={[styles.helperText, { color: passwordData.newPassword === passwordData.confirmPassword ? '#10B981' : '#EF4444' }]}>
                          {passwordData.newPassword === passwordData.confirmPassword ? 'Passwords match' : "Passwords don't match"}
                        </Text>
                      )}
                  </View>

                  <TouchableOpacity style={styles.saveBtn} onPress={handleUpdatePassword} disabled={saveLoading}>
                      {saveLoading ? <ActivityIndicator color="#fff" /> : (
                          <>
                             <MaterialCommunityIcons name="key-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                             <Text style={styles.saveBtnText}>Update Password</Text>
                          </>
                      )}
                  </TouchableOpacity>
              </View>
          );
      }

      if (activeTab === 'Appearance') {
          return (
              <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="palette-outline" size={22} color={colors.primary} style={{ marginRight: 8 }} />
                    <Text style={[styles.cardTitle, { color: colors.textMain }]}>Appearance</Text>
                  </View>

                  <View style={[styles.switchRowCard, { borderColor: colors.border, backgroundColor: isLightMode ? '#f8fafc' : '#1e293b' }]}>
                    <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                      <Feather name={isLightMode ? "sun" : "moon"} size={22} color={isLightMode ? "#f59e0b" : "#8b5cf6"} style={{marginRight: 12}} />
                      <View>
                        <Text style={{fontWeight: '800', fontSize: 15, color: colors.textMain}}>{isLightMode ? "Light Mode" : "Dark Mode"}</Text>
                        <Text style={{color: colors.textSub, fontSize: 11, marginTop: 2}}>Currently using {isLightMode ? "light" : "dark"} theme</Text>
                      </View>
                    </View>
                    <Switch value={!isLightMode} onValueChange={toggleTheme} trackColor={{ false: "#cbd5e1", true: "#8b5cf6" }} thumbColor={"#ffffff"} />
                  </View>

                  <View style={[styles.infoBanner, { backgroundColor: isLightMode ? '#EFF6FF' : 'rgba(59, 130, 246, 0.1)', borderColor: isLightMode ? '#BFDBFE' : colors.primary }]}>
                    <MaterialCommunityIcons name="information" size={16} color={colors.primary} style={{ marginRight: 8 }} />
                    <Text style={[styles.infoText, { color: isLightMode ? colors.primary : '#60A5FA' }]}>Theme preference is saved automatically across sessions.</Text>
                  </View>
              </View>
          );
      }

      if (activeTab === 'Notifications') {
        return (
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="bell-outline" size={22} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: colors.textMain }]}>Notification Preferences</Text>
            </View>

            <View style={[styles.switchRowCard, {borderColor: colors.border}]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.switchLabel, {color: colors.textMain}]}>Leave Status Updates</Text>
                <Text style={styles.switchSubLabel}>Notified when your leave is approved or rejected</Text>
              </View>
              <Switch trackColor={{ false: '#475569', true: '#BFDBFE' }} thumbColor={notifications.leaveStatus ? colors.primary : '#94A3B8'} value={notifications.leaveStatus} onValueChange={(val) => setNotifications({...notifications, leaveStatus: val})} />
            </View>

            <View style={[styles.switchRowCard, {borderColor: colors.border}]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.switchLabel, {color: colors.textMain}]}>Payslip Available</Text>
                <Text style={styles.switchSubLabel}>Notified when your monthly payslip is generated</Text>
              </View>
              <Switch trackColor={{ false: '#475569', true: '#BFDBFE' }} thumbColor={notifications.payslip ? colors.primary : '#94A3B8'} value={notifications.payslip} onValueChange={(val) => setNotifications({...notifications, payslip: val})} />
            </View>

            <View style={[styles.switchRowCard, {borderColor: colors.border}]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.switchLabel, {color: colors.textMain}]}>Company Announcements</Text>
                <Text style={styles.switchSubLabel}>Receive important company-wide notices</Text>
              </View>
              <Switch trackColor={{ false: '#475569', true: '#BFDBFE' }} thumbColor={notifications.announcements ? colors.primary : '#94A3B8'} value={notifications.announcements} onValueChange={(val) => setNotifications({...notifications, announcements: val})} />
            </View>

            <View style={[styles.infoBanner, { backgroundColor: isLightMode ? '#EFF6FF' : 'rgba(59, 130, 246, 0.1)', borderColor: isLightMode ? '#BFDBFE' : colors.primary }]}>
              <MaterialCommunityIcons name="information" size={16} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.infoText, { color: isLightMode ? colors.primary : '#60A5FA' }]}>These are in-app notifications. Email alerts require Admin configuration.</Text>
            </View>
          </View>
        );
      }
  };

  const hasValidAvatar = profileData.avatar && profileData.avatar.length > 5 && !profileData.avatar.includes('ui-avatars');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} backgroundColor="transparent" translucent={true} />
      <View style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg }}>
        <GlobalAppBar navigation={navigation} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />}
        >
          
          <View style={styles.pageHeader}>
            <View style={styles.headerTitleRow}>
              <Feather name="settings" size={24} color="#3b82f6" />
              <Text style={[styles.pageTitle, { color: colors.textMain }]}>Settings</Text>
            </View>
            <Text style={[styles.pageSubtitle, { color: colors.textSub }]}>Manage your account and preferences</Text>
          </View>

          {loading && !refreshing ? (
             <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
          ) : (
            <>
              <TouchableOpacity style={[styles.topProfileCard, { backgroundColor: isLightMode ? '#eff6ff' : '#1e3a8a' }]} onPress={openGalleryAndCrop} disabled={uploadingImage}>
                  <View style={[styles.avatarBig, { backgroundColor: '#3b82f6' }]}>
                      {uploadingImage ? (
                          <ActivityIndicator size="large" color="#fff" />
                      ) : hasValidAvatar ? (
                         <Image source={{ uri: profileData.avatar }} style={{ width: 100, height: 100, borderRadius: 50 }} resizeMode="cover" />
                      ) : (
                         <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#fff', letterSpacing: 1 }}>{userInitials}</Text>
                      )}
                      
                      {!uploadingImage && (
                          <View style={[styles.editIconOverlayBig, {backgroundColor: isLightMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.2)'}]}>
                              <MaterialCommunityIcons name="camera-outline" size={20} color="#FFF" />
                          </View>
                      )}
                  </View>
                  <Text style={[styles.profileName, { color: colors.textMain }]}>{profileData.firstName} {profileData.lastName}</Text>
                  
                  <Text style={[styles.profileRole, { color: '#3b82f6' }]}>{userRole}</Text>
                  <Text style={[styles.profileDept, { color: colors.textSub }]}>{profileData.department}</Text>
              </TouchableOpacity>

              <View style={styles.tabsContainerWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
                  {allTabs.map(tab => {
                    const isActive = activeTab === tab;
                    let icon = tab === 'Profile' ? 'account-outline' : (tab === 'Password' ? 'lock-outline' : (tab === 'Appearance' ? 'palette-outline' : 'bell-outline'));
                    return (
                      <TouchableOpacity key={tab} style={[styles.modernTabBtn, isActive ? { backgroundColor: '#3b82f6' } : { backgroundColor: isLightMode ? '#E2E8F0' : '#334155' }]} onPress={() => setActiveTab(tab as any)}>
                        <MaterialCommunityIcons name={icon} size={16} color={isActive ? '#fff' : (isLightMode ? '#475569' : '#CBD5E1')} style={{marginRight: 6}} />
                        <Text style={[styles.modernTabText, { color: isActive ? '#fff' : (isLightMode ? '#475569' : '#CBD5E1') }]}>{tab}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>

              {renderContent()}

              <TouchableOpacity style={[styles.logoutBtn, { borderColor: isLightMode ? '#fee2e2' : '#7f1d1d', backgroundColor: isLightMode ? '#fef2f2' : '#450a0a' }]} onPress={handleLogout}>
                  <Feather name="log-out" size={18} color="#ef4444" style={{marginRight: 8}} />
                  <Text style={styles.logoutBtnText}>Log Out from Device</Text>
              </TouchableOpacity>

            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  
  pageHeader: { marginBottom: 20 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  pageTitle: { fontSize: 24, fontWeight: 'bold', marginLeft: 10 },
  pageSubtitle: { fontSize: 13, marginLeft: 34 },
  
  topProfileCard: { alignItems: 'center', paddingVertical: 35, borderRadius: 20, marginBottom: 25, elevation: 2 },
  avatarBig: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 2, borderColor: '#fff', overflow: 'hidden', position: 'relative' },
  editIconOverlayBig: { position: 'absolute', bottom: 0, right: 0, left: 0, height: 30, justifyContent: 'center', alignItems: 'center' },
  profileName: { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  profileRole: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  profileDept: { fontSize: 11, fontWeight: '700', marginTop: 4, letterSpacing: 0.5 },

  tabsContainerWrapper: { marginBottom: 20 },
  modernTabBtn: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 20, marginRight: 10 },
  modernTabText: { fontSize: 13, fontWeight: '800' },

  card: { borderRadius: 20, borderWidth: 1, padding: 22, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingBottom: 15, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: '900' },
  
  formRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  inputGroup: { flex: 1, marginHorizontal: 4 },
  fullWidthContainer: { marginHorizontal: 4, marginBottom: 15 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 8 },
  input: { borderWidth: 1, height: 48, borderRadius: 12, paddingHorizontal: 15, fontSize: 14 },
  
  saveBtn: { flexDirection: 'row', backgroundColor: '#3b82f6', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  
  helperText: { fontSize: 11, fontWeight: '700', marginTop: -10, marginBottom: 10, marginLeft: 5 },
  
  switchRowCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12 },
  switchLabel: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  switchSubLabel: { fontSize: 11, color: '#64748B' },

  warningBanner: { flexDirection: 'row', padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 5, marginBottom: 10, backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  warningText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#D97706' },

  infoBanner: { flexDirection: 'row', padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 10 },
  infoText: { flex: 1, fontSize: 12, fontWeight: '600' },

  logoutBtn: { flexDirection: 'row', height: 52, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  logoutBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '800' }
});