import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  TouchableOpacity, SafeAreaView, TextInput, Alert, Platform, Switch, Image, StatusBar, RefreshControl, KeyboardAvoidingView, Modal, PermissionsAndroid 
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme'; 
import GlobalAppBar from '../components/GlobalAppBar'; 
import ImagePicker from 'react-native-image-crop-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Geolocation from 'react-native-geolocation-service';
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

const getCleanAvatarUrl = (url: string) => {
    if (!url) return '';
    let clean = url.replace(/\\/g, '/'); 
    let fullUrl = clean;
    if (!clean.startsWith('http')) {
        fullUrl = clean.startsWith('/') ? `${API_BASE.replace('/api', '')}${clean}` : `${API_BASE.replace('/api', '')}/${clean}`;
    }
    return encodeURI(fullUrl); 
};

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SettingsScreen({ navigation }: any) {
  const { colors, isLightMode, toggleTheme } = useTheme(); 
  
  const [activeTab, setActiveTab] = useState<'Profile' | 'Password' | 'Appearance' | 'Notifications' | 'Attendance' | 'Holidays'>('Profile');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const allTabs = isAdmin 
    ? ['Profile', 'Password', 'Appearance', 'Notifications', 'Attendance', 'Holidays']
    : ['Profile', 'Password', 'Appearance', 'Notifications'];
  
  const [loading, setLoading] = useState<boolean>(true);
  const [saveLoading, setSaveLoading] = useState<boolean>(false);
  const [saveLocLoading, setSaveLocLoading] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [empId, setEmpId] = useState<string>(''); 
  const [userId, setUserId] = useState<string>(''); 
  const [userRole, setUserRole] = useState<string>('Loading...');
  const [userInitials, setUserInitials] = useState('U');

  const [fullEmployeeData, setFullEmployeeData] = useState<any>({});

  const [profileData, setProfileData] = useState({
    firstName: '', lastName: '', email: '', avatar: '', department: 'Loading...'
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '', confirmPassword: ''
  });

  const [notifications, setNotifications] = useState({
    leaveStatus: true, payslip: true, announcements: true, attendance: false
  });

  const [attSettings, setAttSettings] = useState({
    checkinEnabled: true,
    weeklyOffDays: ['Sun'] as string[],
    saturdayOffPattern: 'second_fourth', 
    locationEnabled: false,
    locations: [] as any[]
  });
  const [logSyncCount, setLogSyncCount] = useState<string>('');
  const [syncLoading, setSyncLoading] = useState<boolean>(false);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationForm, setLocationForm] = useState({
    name: '', latitude: '', longitude: '', radiusMeters: '100'
  });

  const [holidays, setHolidays] = useState<any[]>([]);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showHolidayDatePicker, setShowHolidayDatePicker] = useState(false);
  const [isEditingHoliday, setIsEditingHoliday] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    id: '', name: '', date: new Date(), type: 'public', recurring: false, applicableShift: 'All', description: ''
  });
  const HOLIDAY_TYPES = [
    { label: 'Public', value: 'public' },
    { label: 'Company', value: 'company' },
    { label: 'Optional', value: 'optional' },
    { label: 'National', value: 'national' },
  ];

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

      const adminCheck = String(localRoleName).toUpperCase().includes('ADMIN');
      setIsAdmin(adminCheck);

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
          if (!finalDept) finalDept = adminCheck ? 'Administration' : 'Not Assigned';

          let finalRole = localRoleName;
          const roleSource = fetchedUserObj.role || fetchedEmpObj.designation || decodedRoleId;
          
          if (adminCheck && !fetchedEmpObj._id) {
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

  useFocusEffect(useCallback(() => { 
      fetchUserData(); 
  }, []));

  useEffect(() => {
    if (activeTab === 'Attendance' && isAdmin) fetchAttendanceSettings();
    if (activeTab === 'Holidays' && isAdmin) fetchHolidays();
  }, [activeTab, isAdmin]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUserData(true);
    if (activeTab === 'Attendance' && isAdmin) await fetchAttendanceSettings();
    if (activeTab === 'Holidays' && isAdmin) await fetchHolidays();
  }, [activeTab, isAdmin]);

  const fetchAttendanceSettings = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(`${API_BASE}/settings/attendance`, { headers: { Authorization: `Bearer ${token}` } });
      
      if (res.data?.data) {
        const d = res.data.data;
        setAttSettings({
          checkinEnabled: d.checkinEnabled ?? true,
          weeklyOffDays: Array.isArray(d.weeklyOffDays) ? d.weeklyOffDays : ['Sun'],
          saturdayOffPattern: d.saturdayOffPattern || 'second_fourth',
          locationEnabled: d.locationEnabled ?? false,
          locations: Array.isArray(d.locations) ? d.locations : []
        });
      }
    } catch(e) { 
      console.log('Attendance settings fetch error', e); 
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCheckIn = async (val: boolean) => {
    setAttSettings(prev => ({ ...prev, checkinEnabled: val }));
    try {
      const token = await AsyncStorage.getItem('userToken');
      const payload = {
          checkinEnabled: val,
          locationEnabled: attSettings.locationEnabled,
          weeklyOffDays: attSettings.weeklyOffDays,
          saturdayOffPattern: attSettings.saturdayOffPattern
      };
      await axios.patch(`${API_BASE}/settings/attendance`, payload, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e: any) {
      setAttSettings(prev => ({ ...prev, checkinEnabled: !val }));
      Alert.alert("Error", e.response?.data?.message || "Failed to update settings.");
    }
  };

  const handleToggleLocationEnabled = async (val: boolean) => {
    setAttSettings(prev => ({ ...prev, locationEnabled: val }));
    try {
      const token = await AsyncStorage.getItem('userToken');
      const payload = {
          checkinEnabled: attSettings.checkinEnabled,
          locationEnabled: val,
          weeklyOffDays: attSettings.weeklyOffDays,
          saturdayOffPattern: attSettings.saturdayOffPattern
      };
      await axios.patch(`${API_BASE}/settings/attendance`, payload, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e: any) {
      setAttSettings(prev => ({ ...prev, locationEnabled: !val }));
      Alert.alert("Error", e.response?.data?.message || "Failed to update settings.");
    }
  };

  const handleSaveWeeklyOffDays = async () => {
    try {
      setSaveLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const payload = {
        checkinEnabled: attSettings.checkinEnabled,
        locationEnabled: attSettings.locationEnabled,
        weeklyOffDays: attSettings.weeklyOffDays,
        saturdayOffPattern: attSettings.saturdayOffPattern
      };
      await axios.patch(`${API_BASE}/settings/attendance`, payload, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert("Success", "Weekly off days updated successfully.");
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.message || "Failed to update weekly off days.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleUpdateLogSync = async () => {
    if (!logSyncCount || !String(logSyncCount).trim()) return Alert.alert("Required", "Please enter a valid count.");
    try {
      setSyncLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      await axios.put(`${API_BASE}/settings/logsync`, { count: Number(logSyncCount) }, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert("Success", "Log sync count updated successfully.");
      setLogSyncCount('');
    } catch(e: any) {
      Alert.alert("Error", e.response?.data?.message || "Failed to update log sync count.");
    } finally {
      setSyncLoading(false);
    }
  };

  const toggleDayOfWeek = (day: string) => {
    let updated = [...attSettings.weeklyOffDays];
    if (updated.includes(day)) {
      updated = updated.filter(d => d !== day);
    } else {
      updated.push(day);
    }
    setAttSettings({ ...attSettings, weeklyOffDays: updated });
  };

  const fetchCurrentLocation = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert("Permission Denied", "Location permission is required to fetch coordinates.");
          return;
        }
      } catch (err) {
        console.warn(err);
      }
    }

    Geolocation.getCurrentPosition(
      (position: any) => {
        setLocationForm(prev => ({
          ...prev,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude)
        }));
      },
      (error: any) => {
        Alert.alert("Location Error", error.message || "Could not fetch current location. Make sure GPS is enabled.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  // 🚀 FIXED: Specific POST API call to add Geo-fence Location
  const handleAddLocation = async () => {
    if (!locationForm.name.trim() || !locationForm.latitude || !locationForm.longitude) {
      return Alert.alert("Validation Error", "Please fill Name, Latitude, and Longitude.");
    }

    try {
      setSaveLocLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      
      const payload = {
        name: locationForm.name.trim(),
        latitude: Number(locationForm.latitude),
        longitude: Number(locationForm.longitude),
        radiusMeters: Number(locationForm.radiusMeters) || 100
      };

      const res = await axios.post(`${API_BASE}/settings/attendance/locations`, payload, { 
        headers: { Authorization: `Bearer ${token}` } 
      });

      if (res.data?.success) {
        Alert.alert("Success", "Location added successfully.");
        setShowLocationModal(false);
        setLocationForm({ name: '', latitude: '', longitude: '', radiusMeters: '100' });
        fetchAttendanceSettings(); // Refresh list to get real _id from database
      }
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.message || "Failed to add location.");
    } finally {
      setSaveLocLoading(false);
    }
  };

  // 🚀 FIXED: Specific DELETE API call to remove Geo-fence Location
  const handleRemoveLocation = async (locationId: string) => {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this location?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive", 
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('userToken');
            await axios.delete(`${API_BASE}/settings/attendance/locations/${locationId}`, { 
              headers: { Authorization: `Bearer ${token}` } 
            });
            fetchAttendanceSettings(); // Refresh list
          } catch (e: any) {
            Alert.alert("Error", e.response?.data?.message || "Failed to delete location.");
          }
        }
      }
    ]);
  };

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const year = new Date().getFullYear();
      const res = await axios.get(`${API_BASE}/holidays?year=${year}`, { headers: { Authorization: `Bearer ${token}` } });
      setHolidays(res.data?.data || []);
    } catch(e) { 
      console.log('Holidays fetch error', e); 
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHoliday = async () => {
    if (!holidayForm.name.trim() || !holidayForm.date) {
      return Alert.alert("Validation Error", "Holiday Name and Date are required.");
    }
    
    const dateStr = holidayForm.date.toISOString().split('T')[0];
    const duplicate = holidays.find(h => h.date.split('T')[0] === dateStr && h._id !== holidayForm.id);
    if (duplicate) return Alert.alert("Validation Error", "A holiday already exists on this date.");

    try {
      setSaveLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const payload = {
        name: holidayForm.name.trim(),
        date: dateStr,
        type: holidayForm.type.toLowerCase(),
        recurring: holidayForm.recurring,
        applicableShift: holidayForm.applicableShift,
        description: holidayForm.description
      };

      if (isEditingHoliday) {
        await axios.put(`${API_BASE}/holidays/${holidayForm.id}`, payload, config);
        Alert.alert("Success", "Holiday updated successfully.");
      } else {
        await axios.post(`${API_BASE}/holidays`, payload, config);
        Alert.alert("Success", "Holiday created successfully.");
      }
      setShowHolidayModal(false);
      fetchHolidays();
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.message || "Failed to save holiday.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteHoliday = (id: string) => {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this holiday?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('userToken');
            await axios.delete(`${API_BASE}/holidays/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchHolidays();
          } catch(e) { Alert.alert("Error", "Failed to delete holiday."); }
      }}
    ]);
  };

  const openAddHoliday = () => {
    setIsEditingHoliday(false);
    setHolidayForm({ id: '', name: '', date: new Date(), type: 'public', recurring: false, applicableShift: 'All', description: '' });
    setShowHolidayModal(true);
  };

  const openEditHoliday = (h: any) => {
    setIsEditingHoliday(true);
    setHolidayForm({
      id: h._id, name: h.name, date: new Date(h.date), type: (h.type || 'public').toLowerCase(), 
      recurring: h.recurring || false, applicableShift: h.applicableShift || 'All', description: h.description || ''
    });
    setShowHolidayModal(true);
  };

  const formatDateUI = (d: Date | string) => {
    if (!d) return '--/--/----';
    const dateObj = new Date(d);
    return `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
  };

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
              headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
          }).then(res => {
              if (res.data?.success && res.data?.fileUrl) {
                  let newAvatarUrl = getCleanAvatarUrl(res.data.fileUrl);
                  setProfileData({ ...profileData, avatar: newAvatarUrl });
                  Alert.alert("Uploaded", "Image uploaded. Click 'Save Changes' to update profile.");
              } else {
                  Alert.alert("Upload Rejected", "Server rejected the upload. Please try a different image.");
              }
          }).catch(err => {
              const errorMsg = err.response?.data?.message || "Image upload failed. Please try again.";
              Alert.alert("Upload Failed", errorMsg);
          }).finally(() => {
              setUploadingImage(false);
          });
      });
  };

  const openGalleryAndCrop = () => {
      ImagePicker.openPicker({
          width: 300, height: 300, cropping: true, cropperCircleOverlay: true, compressImageQuality: 0.7, mediaType: 'photo'
      }).then(image => { handleImageUpload(image); }).catch(e => console.log('Gallery error or cancelled'));
  };

  const handleUpdateProfile = async () => {
    if (!profileData.firstName) return Alert.alert("Required", "First Name is required.");

    setSaveLoading(true);
    if (profileData.avatar) await AsyncStorage.setItem('userAvatar', profileData.avatar);

    try {
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const payload = { ...fullEmployeeData, firstName: profileData.firstName, lastName: profileData.lastName, avatar: profileData.avatar };

      let endpoint = '';
      if (empId && isMongoId(empId)) endpoint = `${API_BASE}/employees/${empId}`;
      else if (userId && isMongoId(userId)) endpoint = `${API_BASE}/users/${userId}`;

      if (endpoint) {
          await axios.put(endpoint, payload, config);
          await AsyncStorage.setItem('userName', `${profileData.firstName} ${profileData.lastName}`.trim());
          setUserInitials(`${profileData.firstName.charAt(0)}${profileData.lastName.charAt(0)}`.toUpperCase());
          Alert.alert("Success", "Profile updated successfully!"); 
      } else {
          Alert.alert("Error", "User details missing. Cannot update.");
      }
    } catch (err: any) {
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
        const errorMsg = error.response?.data?.message || "Failed to update password. Please try again.";
        Alert.alert("Update Failed", errorMsg);
      } finally {
        setSaveLoading(false);
      }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to exit your session?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: async () => {
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
                      <TextInput style={[styles.input, {color:colors.textMain, borderColor:colors.border}]} secureTextEntry value={passwordData.newPassword} onChangeText={(t)=>setPasswordData({...passwordData, newPassword:t})} placeholder="Min 6 characters" placeholderTextColor={colors.textSub} />
                      {passwordData.newPassword.length > 0 && (<Text style={[styles.helperText, { color: passwordData.newPassword.length >= 6 ? '#10B981' : '#EF4444' }]}>{passwordData.newPassword.length >= 6 ? 'Strong' : 'Weak'}</Text>)}
                  </View>
                  <View style={{marginBottom: 20}}>
                      <Text style={[styles.label, {color:colors.textMain}]}>Confirm Password</Text>
                      <TextInput style={[styles.input, {color:colors.textMain, borderColor:colors.border}]} secureTextEntry value={passwordData.confirmPassword} onChangeText={(t)=>setPasswordData({...passwordData, confirmPassword:t})} placeholder="Repeat new password" placeholderTextColor={colors.textSub} />
                      {passwordData.confirmPassword.length > 0 && (<Text style={[styles.helperText, { color: passwordData.newPassword === passwordData.confirmPassword ? '#10B981' : '#EF4444' }]}>{passwordData.newPassword === passwordData.confirmPassword ? 'Passwords match' : "Passwords don't match"}</Text>)}
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
          </View>
        );
      }

      if (activeTab === 'Attendance') {
        return (
          <>
            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="cog-outline" size={22} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.cardTitle, { color: colors.textMain }]}>Attendance Settings</Text>
                </View>

                <View style={[styles.switchRowCard, {borderColor: colors.border}]}>
                   <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[styles.switchLabel, {color: colors.textMain}]}>Self Check-in / Check-out</Text>
                      <Text style={styles.switchSubLabel}>Employees can check in/out themselves from the dashboard.</Text>
                   </View>
                   <Switch 
                     trackColor={{ false: '#475569', true: '#BFDBFE' }} 
                     thumbColor={attSettings.checkinEnabled ? colors.primary : '#94A3B8'} 
                     value={attSettings.checkinEnabled} 
                     onValueChange={handleToggleCheckIn} 
                   />
                </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="sync" size={22} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.cardTitle, { color: colors.textMain }]}>Log Sync Count</Text>
                </View>

                <Text style={[styles.label, {color: colors.textMain}]}>Log sync count</Text>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                   <TextInput 
                     style={[styles.input, {color: colors.textMain, borderColor: colors.border, flex: 1, marginRight: 10}]} 
                     value={logSyncCount} 
                     placeholder="e.g. 4007"
                     placeholderTextColor={colors.textSub}
                     onChangeText={setLogSyncCount} 
                     keyboardType="numeric" 
                   />
                   <TouchableOpacity style={styles.updateInlineBtn} onPress={handleUpdateLogSync} disabled={syncLoading}>
                      {syncLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{color: '#fff', fontWeight: 'bold'}}>Update</Text>}
                   </TouchableOpacity>
                </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="calendar-range" size={22} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.cardTitle, { color: colors.textMain }]}>Weekly Off Days</Text>
                </View>
                <Text style={{color: colors.textSub, fontSize: 12, marginBottom: 15}}>Both mobile app and website attendance will be marked as "holiday" for these days (default: Sat + Sun).</Text>

                <View style={{flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20}}>
                   {DAYS_OF_WEEK.map(day => {
                     const isSelected = attSettings.weeklyOffDays.includes(day);
                     return (
                       <TouchableOpacity 
                         key={day} 
                         style={[styles.dayPill, isSelected ? {backgroundColor: colors.primary, borderColor: colors.primary} : {borderColor: colors.border}]}
                         onPress={() => toggleDayOfWeek(day)}
                       >
                         <Text style={{color: isSelected ? '#fff' : colors.textMain, fontWeight: 'bold', fontSize: 12}}>{day}</Text>
                       </TouchableOpacity>
                     );
                   })}
                </View>

                <Text style={[styles.label, {color: colors.textMain}]}>Saturday Pattern</Text>
                <View style={{flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20}}>
                    {[
                      { label: 'Every Saturday off', value: 'all' },
                      { label: 'No Saturday off', value: 'none' },
                      { label: 'Only 1st & 3rd Saturday off', value: 'first_third' }, 
                      { label: 'Only 2nd & 4th Saturday off', value: 'second_fourth' }
                    ].map(opt => (
                      <TouchableOpacity 
                        key={opt.value} 
                        style={[styles.patternBtn, attSettings.saturdayOffPattern === opt.value ? {backgroundColor: colors.primary, borderColor: colors.primary} : {borderColor: colors.border}]}
                        onPress={() => setAttSettings({...attSettings, saturdayOffPattern: opt.value})}
                      >
                         <Text style={{color: attSettings.saturdayOffPattern === opt.value ? '#fff' : colors.textSub, fontSize: 12, fontWeight: 'bold'}}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveWeeklyOffDays} disabled={saveLoading}>
                   {saveLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Off Days</Text>}
                </TouchableOpacity>
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={[styles.cardHeader, {justifyContent: 'space-between'}]}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <MaterialCommunityIcons name="map-marker-radius" size={22} color={colors.primary} style={{ marginRight: 8 }} />
                    <Text style={[styles.cardTitle, { color: colors.textMain }]}>Geo-fence Locations</Text>
                  </View>
                  <TouchableOpacity style={styles.addBtnSmall} onPress={() => setShowLocationModal(true)}>
                    <Feather name="plus" size={14} color="#fff" />
                    <Text style={styles.addBtnSmallText}>Add</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.switchRowCard, {borderColor: colors.border, marginBottom: 20}]}>
                   <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[styles.switchLabel, {color: colors.textMain}]}>Location restriction enabled</Text>
                      <Text style={styles.switchSubLabel}>Employees must be within range to punch.</Text>
                   </View>
                   <Switch 
                     trackColor={{ false: '#475569', true: '#BFDBFE' }} 
                     thumbColor={attSettings.locationEnabled ? colors.primary : '#94A3B8'} 
                     value={attSettings.locationEnabled} 
                     onValueChange={handleToggleLocationEnabled} 
                   />
                </View>

                {attSettings.locations.length === 0 ? (
                   <Text style={{color: colors.textSub, fontSize: 12, fontStyle: 'italic', marginBottom: 10}}>No geo-fence locations added yet.</Text>
                ) : (
                   attSettings.locations.map((loc, idx) => (
                      <View key={loc._id || idx} style={[styles.locationItem, {borderColor: colors.border}]}>
                         <View style={{flex: 1}}>
                            <Text style={{fontWeight: 'bold', fontSize: 14, color: colors.textMain}}>{loc.name}</Text>
                            <Text style={{fontSize: 11, color: colors.textSub}}>Lat: {loc.latitude}, Long: {loc.longitude}</Text>
                            <Text style={{fontSize: 11, color: colors.primary, fontWeight: '600'}}>Radius: {loc.radiusMeters}m</Text>
                         </View>
                         {/* 🚀 FIXED: Delete specific location by ID */}
                         <TouchableOpacity onPress={() => handleRemoveLocation(loc._id)}>
                            <Feather name="trash-2" size={18} color="#EF4444" />
                         </TouchableOpacity>
                      </View>
                   ))
                )}
            </View>

            <Modal visible={showLocationModal} transparent animationType="slide">
               <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                  <View style={[styles.modalContent, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                     <View style={styles.modalHeader}>
                        <Text style={[styles.cardTitle, {color: colors.textMain}]}>Add Geo-fence Location</Text>
                        <TouchableOpacity onPress={() => setShowLocationModal(false)}><Feather name="x" size={24} color={colors.textMain} /></TouchableOpacity>
                     </View>
                     <ScrollView style={{padding: 20}}>
                        
                        <TouchableOpacity style={styles.fetchLocBtn} onPress={fetchCurrentLocation}>
                            <MaterialCommunityIcons name="crosshairs-gps" size={18} color="#FFF" style={{marginRight: 8}}/>
                            <Text style={{color: '#FFF', fontWeight: 'bold'}}>Fetch Current Location</Text>
                        </TouchableOpacity>

                        <Text style={[styles.label, {color:colors.textMain}]}>Location Name *</Text>
                        <TextInput style={[styles.input, {color:colors.textMain, borderColor:colors.border, marginBottom: 12}]} value={locationForm.name} onChangeText={t => setLocationForm({...locationForm, name: t})} placeholder="e.g. Head Office" placeholderTextColor={colors.textSub} />

                        <Text style={[styles.label, {color:colors.textMain}]}>Latitude *</Text>
                        <TextInput style={[styles.input, {color:colors.textMain, borderColor:colors.border, marginBottom: 12}]} value={locationForm.latitude} onChangeText={t => setLocationForm({...locationForm, latitude: t})} placeholder="e.g. 26.875299" keyboardType="numeric" placeholderTextColor={colors.textSub} />

                        <Text style={[styles.label, {color:colors.textMain}]}>Longitude *</Text>
                        <TextInput style={[styles.input, {color:colors.textMain, borderColor:colors.border, marginBottom: 12}]} value={locationForm.longitude} onChangeText={t => setLocationForm({...locationForm, longitude: t})} placeholder="e.g. 75.737108" keyboardType="numeric" placeholderTextColor={colors.textSub} />

                        <Text style={[styles.label, {color:colors.textMain}]}>Radius (Meters)</Text>
                        <TextInput style={[styles.input, {color:colors.textMain, borderColor:colors.border, marginBottom: 20}]} value={locationForm.radiusMeters} onChangeText={t => setLocationForm({...locationForm, radiusMeters: t})} placeholder="100" keyboardType="numeric" placeholderTextColor={colors.textSub} />

                        {/* 🚀 FIXED: Specific POST Trigger */}
                        <TouchableOpacity style={[styles.saveBtn, {marginTop: 0, marginBottom: 30}]} onPress={handleAddLocation} disabled={saveLocLoading}>
                            {saveLocLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Add Location</Text>}
                        </TouchableOpacity>
                     </ScrollView>
                  </View>
               </KeyboardAvoidingView>
            </Modal>
          </>
        );
      }

      if (activeTab === 'Holidays') {
        return (
          <>
            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border, padding: 15 }]}>
              <View style={[styles.cardHeader, { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0, justifyContent: 'space-between' }]}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <MaterialCommunityIcons name="calendar-star" size={22} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.cardTitle, { color: colors.textMain }]}>Holiday Calendar</Text>
                </View>
                <TouchableOpacity style={styles.addBtnSmall} onPress={openAddHoliday}>
                  <Feather name="plus" size={14} color="#fff" />
                  <Text style={styles.addBtnSmallText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {loading ? <ActivityIndicator size="large" color={colors.primary} style={{marginTop: 20}} /> : 
              holidays.length === 0 ? (
                <Text style={{textAlign: 'center', marginTop: 30, color: colors.textSub}}>No holidays found for this year.</Text>
              ) : (
                holidays.map(h => (
                  <View key={h._id} style={[styles.holidayCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                    <View style={{flex: 1}}>
                      <Text style={[styles.holidayName, {color: colors.textMain}]}>{h.name}</Text>
                      <Text style={[styles.holidayDate, {color: colors.primary}]}>{formatDateUI(h.date)}</Text>
                      <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 6}}>
                         <Text style={[styles.typeBadge, {backgroundColor: isLightMode ? '#EFF6FF' : '#1e3a8a', color: colors.primary}]}>{String(h.type || 'public').toUpperCase()}</Text>
                         {h.recurring && <Text style={[styles.typeBadge, {marginLeft: 8, backgroundColor: '#DCFCE7', color: '#16A34A'}]}>Recurring</Text>}
                      </View>
                    </View>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                       <TouchableOpacity style={styles.iconBtn} onPress={() => openEditHoliday(h)}>
                          <Feather name="edit-2" size={18} color={colors.textSub} />
                       </TouchableOpacity>
                       <TouchableOpacity style={[styles.iconBtn, {marginLeft: 10}]} onPress={() => handleDeleteHoliday(h._id)}>
                          <Feather name="trash-2" size={18} color="#EF4444" />
                       </TouchableOpacity>
                    </View>
                  </View>
                ))
              )
            }

            <Modal visible={showHolidayModal} transparent animationType="slide">
               <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                  <View style={[styles.modalContent, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                     <View style={styles.modalHeader}>
                        <Text style={[styles.cardTitle, {color: colors.textMain}]}>{isEditingHoliday ? 'Edit' : 'Add'} Holiday</Text>
                        <TouchableOpacity onPress={() => setShowHolidayModal(false)}><Feather name="x" size={24} color={colors.textMain} /></TouchableOpacity>
                     </View>
                     <ScrollView style={{padding: 20}}>
                        <Text style={[styles.label, {color:colors.textMain}]}>Holiday Name *</Text>
                        <TextInput style={[styles.input, {color:colors.textMain, borderColor:colors.border, marginBottom: 15}]} value={holidayForm.name} onChangeText={t => setHolidayForm({...holidayForm, name: t})} placeholder="e.g. Diwali" placeholderTextColor={colors.textSub} />
                        
                        <Text style={[styles.label, {color:colors.textMain}]}>Date *</Text>
                        <TouchableOpacity style={[styles.input, {borderColor: colors.border, justifyContent: 'center', marginBottom: 15}]} onPress={() => setShowHolidayDatePicker(true)}>
                           <Text style={{color: colors.textMain}}>{formatDateUI(holidayForm.date)}</Text>
                        </TouchableOpacity>

                        <Text style={[styles.label, {color:colors.textMain}]}>Type</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15}}>
                           {HOLIDAY_TYPES.map(typeObj => (
                              <TouchableOpacity 
                                key={typeObj.value} 
                                style={[styles.typeSelectBtn, holidayForm.type.toLowerCase() === typeObj.value ? {backgroundColor: colors.primary, borderColor: colors.primary} : {borderColor: colors.border}]} 
                                onPress={() => setHolidayForm({...holidayForm, type: typeObj.value})}
                              >
                                 <Text style={{color: holidayForm.type.toLowerCase() === typeObj.value ? '#fff' : colors.textSub, fontSize: 12, fontWeight: 'bold'}}>{typeObj.label}</Text>
                              </TouchableOpacity>
                           ))}
                        </ScrollView>

                        <View style={[styles.switchRowCard, {borderColor: colors.border, padding: 12}]}>
                           <Text style={[styles.switchLabel, {color: colors.textMain}]}>Recurring Yearly</Text>
                           <Switch trackColor={{ false: '#475569', true: '#BFDBFE' }} thumbColor={holidayForm.recurring ? colors.primary : '#94A3B8'} value={holidayForm.recurring} onValueChange={(val) => setHolidayForm({...holidayForm, recurring: val})} />
                        </View>

                        <Text style={[styles.label, {color:colors.textMain}]}>Applicable Shift</Text>
                        <TextInput style={[styles.input, {color:colors.textMain, borderColor:colors.border, marginBottom: 15}]} value={holidayForm.applicableShift} onChangeText={t => setHolidayForm({...holidayForm, applicableShift: t})} placeholder="e.g. All" placeholderTextColor={colors.textSub} />

                        <Text style={[styles.label, {color:colors.textMain}]}>Description</Text>
                        <TextInput style={[styles.input, {color:colors.textMain, borderColor:colors.border, marginBottom: 20, height: 80}]} value={holidayForm.description} onChangeText={t => setHolidayForm({...holidayForm, description: t})} placeholder="Optional details..." placeholderTextColor={colors.textSub} multiline textAlignVertical="top" />

                        <TouchableOpacity style={[styles.saveBtn, {marginTop: 0, marginBottom: 30}]} onPress={handleSaveHoliday} disabled={saveLoading}>
                            {saveLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Holiday</Text>}
                        </TouchableOpacity>
                     </ScrollView>
                  </View>
               </KeyboardAvoidingView>
            </Modal>

            {showHolidayDatePicker && (
               <DateTimePicker value={holidayForm.date} mode="date" display="default" onChange={(e, d) => { setShowHolidayDatePicker(false); if(e.type === 'set' && d) setHolidayForm({...holidayForm, date: d}); }} />
            )}
          </>
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
                    let icon = 'settings-outline';
                    if(tab === 'Profile') icon = 'account-outline';
                    else if(tab === 'Password') icon = 'lock-outline';
                    else if(tab === 'Appearance') icon = 'palette-outline';
                    else if(tab === 'Notifications') icon = 'bell-outline';
                    else if(tab === 'Attendance') icon = 'clock-check-outline';
                    else if(tab === 'Holidays') icon = 'calendar-star';

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

  card: { borderRadius: 20, borderWidth: 1, padding: 22, elevation: 1, marginBottom: 15 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingBottom: 15, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: '900' },
  
  formRow: { flexDirection: 'row', justifyContent: 'space-between' },
  inputGroup: { flex: 1, marginHorizontal: 4 },
  fullWidthContainer: { marginHorizontal: 4, marginBottom: 15 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 8 },
  input: { borderWidth: 1, height: 48, borderRadius: 12, paddingHorizontal: 15, fontSize: 14 },
  
  saveBtn: { flexDirection: 'row', backgroundColor: '#3b82f6', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  
  helperText: { fontSize: 11, fontWeight: '700', marginTop: -10, marginBottom: 10, marginLeft: 5 },
  
  switchRowCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12 },
  switchLabel: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  switchSubLabel: { fontSize: 11, color: '#64748B' },

  warningBanner: { flexDirection: 'row', padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 5, marginBottom: 10, backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  warningText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#D97706' },

  infoBanner: { flexDirection: 'row', padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 10 },
  infoText: { flex: 1, fontSize: 12, fontWeight: '600' },

  logoutBtn: { flexDirection: 'row', height: 52, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  logoutBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '800' },

  addBtnSmall: { flexDirection: 'row', backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  addBtnSmallText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  holidayCard: { padding: 15, borderRadius: 12, borderWidth: 1, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  holidayName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  holidayDate: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 10, fontWeight: 'bold', overflow: 'hidden', textTransform: 'capitalize' },
  iconBtn: { padding: 6 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', borderRadius: 20, borderWidth: 1, maxHeight: '80%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, alignItems: 'center', borderColor: '#e2e8f0' },
  typeSelectBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },

  updateInlineBtn: { backgroundColor: '#3b82f6', height: 48, paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  dayPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, marginRight: 8, marginBottom: 8 },
  patternBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, marginRight: 8, marginBottom: 8 },
  locationItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  fetchLocBtn: { flexDirection: 'row', backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }
});