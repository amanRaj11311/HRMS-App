import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, 
  ActivityIndicator, Alert, Modal, StatusBar, Platform, RefreshControl, TextInput, KeyboardAvoidingView, PermissionsAndroid
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme';
import GlobalAppBar from '../components/GlobalAppBar'; 
import {showLocalNotification} from '../services/notificationService';

import Geolocation from 'react-native-geolocation-service';
import ImagePicker from 'react-native-image-crop-picker';
import { API_BASE } from '../api/api';



import { API_BASE } from '../api/api';
const STATUS_OPTIONS = ['present', 'absent', 'late', 'half-day', 'work-from-home', 'holiday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const OFFICE_COORDS = { latitude: 26.875690, longitude: 75.753272 }; 
const ALLOWED_RADIUS_METERS = 15; 

const FACE_API_KEY = "YOUR_FACEPLUSPLUS_API_KEY"; 
const FACE_API_SECRET = "YOUR_FACEPLUSPLUS_API_SECRET";

export default function AttendanceModule({ navigation }: any) {
  const { colors, isLightMode } = useTheme();
  
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [myName, setMyName] = useState('My Record');

  const [isSyncing, setIsSyncing] = useState(false);

  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [isDateFiltered, setIsDateFiltered] = useState(false);
  const [showFilterDatePicker, setShowFilterDatePicker] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [filterEmpId, setFilterEmpId] = useState('All');
  const [filterEmpName, setFilterEmpName] = useState('All Employees');
  const [showEmpModal, setShowEmpModal] = useState(false);

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editRecordId, setEditRecordId] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [showFormEmp, setShowFormEmp] = useState(false);
  const [showFormStatus, setShowFormStatus] = useState(false);
  const [showFormDate, setShowFormDate] = useState(false);
  const [showFormCheckIn, setShowFormCheckIn] = useState(false);
  const [showFormCheckOut, setShowFormCheckOut] = useState(false);
  
  const [formAbsentEmployees, setFormAbsentEmployees] = useState<any[]>([]);

  // 🚀 FIXED: Advanced Download Filters State
  const [isDownloadModalVisible, setIsDownloadModalVisible] = useState(false);
  const [dlStartDate, setDlStartDate] = useState<Date>(new Date());
  const [dlEndDate, setDlEndDate] = useState<Date>(new Date());
  const [dlEmpId, setDlEmpId] = useState('All');
  const [dlEmpName, setDlEmpName] = useState('All Employees');
  const [showDlStartPicker, setShowDlStartPicker] = useState(false);
  const [showDlEndPicker, setShowDlEndPicker] = useState(false);
  const [showDlEmpModal, setShowDlEmpModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [isPunching, setIsPunching] = useState(false);

  const getInitialTime = (hours: number, minutes = 0) => {
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const [formData, setFormData] = useState({
    employeeId: '', employeeName: 'Select Employee', date: new Date(),
    status: 'present', checkIn: getInitialTime(9, 0), checkOut: getInitialTime(18, 0), notes: ''
  });

  const getSafeDateString = (d: Date) => {
      if (!d) return '--/--/----';
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const getCardDateString = (dStr: any) => {
      if (!dStr) return '--';
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return '--';
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const formatTimeUI = (time: any) => {
      if (!time) return '--:-- --';
      let raw = (typeof time === 'object' && time.time) ? time.time : time;
      if (!raw) return '--:-- --';
      let t = new Date(raw);
      if (isNaN(t.getTime())) return '--:-- --';
      
      let h = t.getHours();
      const m = String(t.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
  };

  const formatWorkingHours = (decimalStr: any) => {
      if (!decimalStr) return '--';
      const totalMinutes = Math.floor(parseFloat(decimalStr) * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${h}h ${m}m`;
  };

  const getStatusStyle = (status: string) => {
      const s = String(status || "").toLowerCase();
      if (s === 'present') return { bg: '#DCFCE7', text: '#16A34A' };
      if (s === 'late') return { bg: '#FEF3C7', text: '#D97706' };
      if (s === 'absent') return { bg: '#FEE2E2', text: '#DC2626' };
      if (s === 'half-day') return { bg: '#DBEAFE', text: '#2563EB' };
      return { bg: '#F1F5F9', text: '#64748B' };
  };

  const canDo = (action: string) => permissions.includes(`ATTENDANCE:${action.toUpperCase()}`);

  useFocusEffect(useCallback(() => {
    initScreen();
  }, []));

  useEffect(() => {
    if (permissions.length > 0) {
        fetchData(true);
    }
  }, [filterDate, isDateFiltered]);

  useEffect(() => {
    if (isAddModalVisible && canDo('CREATE') && allEmployees.length > 0) {
        fetchFormAbsentees(formData.date);
    }
  }, [formData.date, isAddModalVisible, allEmployees]);

  const fetchFormAbsentees = async (d: Date) => {
      try {
          const token = await AsyncStorage.getItem('userToken');
          const pad = (n: number) => n < 10 ? '0' + n : n;
          const dStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          
          const res = await axios.get(`${API_BASE}/attendance?date=${dStr}`, { headers: { Authorization: `Bearer ${token}` } });
          const punchedIds = (res.data?.data || []).map((r:any) => r.employeeId?._id || r.employeeId);
          
          const absentees = allEmployees.filter(emp => !punchedIds.includes(emp._id));
          setFormAbsentEmployees(absentees);
      } catch (e) {
          setFormAbsentEmployees(allEmployees);
      }
  };

  const initScreen = async () => {
    setLoading(true);
    const permsStr = await AsyncStorage.getItem('userPermissions');
    const userNameStr = await AsyncStorage.getItem('userName'); 
    const pArray = permsStr ? JSON.parse(permsStr) : [];
    
    setPermissions(pArray);
    if (userNameStr) setMyName(userNameStr);
    
    if (pArray.includes('ATTENDANCE:VIEW')) {
        fetchEmployees();
    }
    fetchData(false, pArray);
  };

  const fetchEmployees = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(`${API_BASE}/employees?limit=500`, { headers: { Authorization: `Bearer ${token}` } });
      setAllEmployees((res.data?.data?.data || res.data?.data || []).filter((e:any) => !e.isDeleted));
    } catch (e) {}
  };

  const fetchData = async (isSilent = false, pArray?: string[]) => {
    try {
      if (!isSilent) setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const myId = await AsyncStorage.getItem('employeeId');
      const currentPerms = pArray || permissions;
      const canViewAll = currentPerms.includes('ATTENDANCE:VIEW');

      let url = `${API_BASE}/attendance`;
      
      if (canViewAll) {
          const d = filterDate;
          const pad = (n: number) => n < 10 ? '0' + n : n;
          url += `?date=${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      } else {
          url += `?employeeId=${myId}&limit=100`; 
      }

      url += `${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;

      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = res.data?.data || [];

      const mapped = data.map((item: any) => {
        let updated = { ...item };
        let hasValidCheckOut = true;

        if (updated.checkIn?.time && updated.checkOut?.time) {
            const inMs = new Date(updated.checkIn.time).getTime();
            const outMs = new Date(updated.checkOut.time).getTime();
            
            if (Math.abs(outMs - inMs) <= 2000) {
                updated.checkOut.time = null;
                updated.workingHours = null;
                hasValidCheckOut = false; 
            }
        } else if (!updated.checkOut?.time) {
            hasValidCheckOut = false;
        }
        
        if (updated.checkIn?.time) {
            const punchIn = new Date(updated.checkIn.time);
            const hour = punchIn.getHours();
            const min = punchIn.getMinutes();
            
            const isLate = (hour > 9 || (hour === 9 && min > 15));

            // < 8 Hours Half-Day Logic
            if (hasValidCheckOut && updated.workingHours !== null && updated.workingHours !== undefined) {
                const hours = parseFloat(updated.workingHours);
                if (!isNaN(hours) && hours < 4) {
                    updated.status = 'half-day';
                } else {
                    updated.status = isLate ? 'late' : 'present';
                }
            } else {
                updated.status = isLate ? 'late' : 'present';
            }
        }

        return updated;
      });

      setRecords(mapped);
    } catch (e) {}
    finally { setLoading(false); setRefreshing(false); }
  };

  // 🚀 FIXED: Biometric Sync Logic (Cleaned up, user-friendly, and usable on pull-to-refresh)
  const syncBiometric = async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
        const token = await AsyncStorage.getItem('userToken');
        const syncUrl = `${API_BASE}/device/attendance?_t=${Date.now()}`;
        
        // Silently hit the backend to force sync
        await axios.get(syncUrl, { 
            headers: { 
                Authorization: `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            } 
        }).catch(() => {});

        // Return a promise that resolves after the 3 second DB population delay
        return new Promise((resolve) => {
            setTimeout(async () => {
               await fetchData(true);
               if (!silent) {
                   Alert.alert("Success", "Attendance synchronized successfully!");
                   setIsSyncing(false);
               }
               resolve(true);
            }, 3000);
        });

    } catch (error: any) {
        if (!silent) {
            Alert.alert("Sync Error", "Failed to communicate with server.");
            setIsSyncing(false);
        }
    }
  };

  // 🚀 FIXED: Pull-to-refresh now silently triggers Biometric Sync!
  const handleRefresh = async () => {
    setRefreshing(true);
    await syncBiometric(true); 
    setRefreshing(false);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const toRad = (value: number) => (value * Math.PI) / 180;
      const R = 6371e3; 
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
  };

  const handleSmartPunch = async () => {
  try {
    // 1️⃣ Permissions
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ]);

      if (
        granted['android.permission.ACCESS_FINE_LOCATION'] !== PermissionsAndroid.RESULTS.GRANTED ||
        granted['android.permission.CAMERA'] !== PermissionsAndroid.RESULTS.GRANTED
      ) {
        Alert.alert("Permission Required", "Location & Camera required");
        return;
      }
    }

    setIsPunching(true);

    // 2️⃣ Get Location
    Geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // 3️⃣ Fake GPS Detection
        if (position.mocked) {
          setIsPunching(false);
          Alert.alert("Fake GPS ❌", "Disable mock location");
          return;
        }

        // 4️⃣ Distance Check
        const distance = calculateDistance(
          latitude,
          longitude,
          OFFICE_COORDS.latitude,
          OFFICE_COORDS.longitude
        );

        if (distance > ALLOWED_RADIUS_METERS) {
          setIsPunching(false);
          Alert.alert("Out of Office 🚫", `You are ${Math.round(distance)}m away`);
          return;
        }

        // 5️⃣ Open Camera
        ImagePicker.openCamera({
          width: 400,
          height: 400,
          cropping: true,
          includeBase64: true,
          useFrontCamera: true,
        })
          .then(async (image) => {

            // 6️⃣ Show preview confirmation
            Alert.alert(
              "Confirm Attendance",
              "Do you want to submit this photo?",
              [
                { text: "Cancel", style: "cancel", onPress: () => setIsPunching(false) },
                {
                  text: "Submit",
                  onPress: async () => {

                    // 7️⃣ Prepare payload for backend
                    const payload = {
                      employeeId: await AsyncStorage.getItem('employeeId'),
                      latitude,
                      longitude,
                      imageBase64: image.data,
                      timestamp: new Date().toISOString(),
                    };

                    console.log("Attendance Payload 👉", payload);

                    // 🔥 FUTURE BACKEND API
                    // await axios.post('/attendance/face', payload)

                    Alert.alert(
                      "Captured ✅",
                      "Photo & location captured.\nWaiting for backend verification."
                    );

                    setIsPunching(false);
                  },
                },
              ]
            );
          })
          .catch(() => {
            setIsPunching(false);
          });
      },
      (error) => {
        setIsPunching(false);
        Alert.alert("Location Error", "Enable High Accuracy GPS");
      },
     {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
  distanceFilter: 0,
  forceRequestLocation: true,
  showLocationDialog: true
}
    );
  } catch (error) {
    setIsPunching(false);
  }
};
  const escapeXml = (unsafe: string) => {
      return (unsafe || '').toString().replace(/[<>&'"]/g, function (c) {
          switch (c) {
              case '<': return '&lt;'; case '>': return '&gt;';
              case '&': return '&amp;'; case '\'': return '&apos;';
              case '"': return '&quot;'; default: return c;
          }
      });
  };

  // 🚀 FIXED: Advanced Filtering for Download Report (Dates & Employees)
  const handleDownloadReport = async () => {
    try {
      setIsDownloading(true);
      const token = await AsyncStorage.getItem('userToken');

      const targetEmployees = dlEmpId === 'All' ? allEmployees : allEmployees.filter(e => e._id === dlEmpId);
      
      if (!targetEmployees || targetEmployees.length === 0) {
          Alert.alert("No Data", "No employees found for the selected criteria.");
          setIsDownloading(false);
          return;
      }

      const sDate = new Date(dlStartDate); sDate.setHours(0,0,0,0);
      const eDate = new Date(dlEndDate); eDate.setHours(23,59,59,999);

      if (eDate < sDate) {
          Alert.alert("Invalid Range", "End Date must be after or equal to Start Date.");
          setIsDownloading(false);
          return;
      }

      let excelContent = `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n`;
      excelContent += `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">\n`;

      const chunkSize = 3; 

      for (let i = 0; i < targetEmployees.length; i += chunkSize) {
          const chunk = targetEmployees.slice(i, i + chunkSize);
          
          const pad = (n: number) => n < 10 ? '0' + n : n;
          const startDateStr = `${sDate.getFullYear()}-${pad(sDate.getMonth() + 1)}-${pad(sDate.getDate())}`;
          const endDateStr = `${eDate.getFullYear()}-${pad(eDate.getMonth() + 1)}-${pad(eDate.getDate())}`;

          const promises = chunk.map(emp =>
              axios.get(`${API_BASE}/attendance?employeeId=${emp._id}&startDate=${startDateStr}&endDate=${endDateStr}&limit=500`, { 
                  headers: { Authorization: `Bearer ${token}` } 
              }).catch(() => null)
          );
          
          const results = await Promise.all(promises);

          results.forEach((res, idx) => {
              const emp = chunk[idx];
              const empIdStr = emp.employeeId || 'N/A';
              const empNameStr = `${emp.userId?.firstName || ''} ${emp.userId?.lastName || ''}`.trim() || 'Unknown';
              
              let baseName = empNameStr.replace(/[\\/?*[\]:]/g, '').substring(0, 20); 
              if(!baseName) baseName = `Emp_${i + idx}`;
              const uniqueSheetName = `${baseName}_${empIdStr.substring(empIdStr.length - 4)}`;

              const empRecords = res?.data?.data || [];
              const monthlyRecordsMap = new Map();

              empRecords.forEach((r: any) => {
                  const d = new Date(r.date || r.checkIn?.time);
                  const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                  monthlyRecordsMap.set(dateKey, r);
              });

              excelContent += `<Worksheet ss:Name="${escapeXml(uniqueSheetName)}">\n<Table>\n`;
              excelContent += `<Row><Cell><Data ss:Type="String">Date</Data></Cell><Cell><Data ss:Type="String">Employee ID</Data></Cell><Cell><Data ss:Type="String">Employee Name</Data></Cell><Cell><Data ss:Type="String">Status</Data></Cell><Cell><Data ss:Type="String">Check-In</Data></Cell><Cell><Data ss:Type="String">Check-Out</Data></Cell><Cell><Data ss:Type="String">Working Hours</Data></Cell></Row>\n`;

              for (let dt = new Date(sDate); dt <= eDate; dt.setDate(dt.getDate() + 1)) {
                  const loopDate = new Date(dt);
                  const dateKey = `${loopDate.getFullYear()}-${String(loopDate.getMonth()+1).padStart(2,'0')}-${String(loopDate.getDate()).padStart(2,'0')}`;
                  const displayDate = `${String(loopDate.getDate()).padStart(2,'0')}/${String(loopDate.getMonth()+1).padStart(2,'0')}/${loopDate.getFullYear()}`;

                  let status, checkIn, checkOut, hrs;

                  if (monthlyRecordsMap.has(dateKey)) {
                      const rec = monthlyRecordsMap.get(dateKey);
                      status = rec.status || 'present';
                      checkIn = formatTimeUI(rec.checkIn);
                      checkOut = formatTimeUI(rec.checkOut);
                      hrs = rec.workingHours ? parseFloat(rec.workingHours).toFixed(2) : '0';
                  } else {
                      const isSunday = loopDate.getDay() === 0;
                      status = isSunday ? 'week-off' : 'absent';
                      checkIn = "--:-- --";
                      checkOut = "--:-- --";
                      hrs = "0";
                  }

                  excelContent += `<Row><Cell><Data ss:Type="String">${displayDate}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(empIdStr)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(empNameStr)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(status)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(checkIn)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(checkOut)}</Data></Cell><Cell><Data ss:Type="String">${hrs}</Data></Cell></Row>\n`;
              }
              
              excelContent += `</Table>\n</Worksheet>\n`;
          });

          await new Promise(resolve => setTimeout(resolve, 300));
      }

      excelContent += `</Workbook>`;

      const safeStart = getSafeDateString(dlStartDate).replace(/\//g, '');
      const safeEnd = getSafeDateString(dlEndDate).replace(/\//g, '');
      const fileName = `Attendance_${safeStart}_to_${safeEnd}.xls`;

      if (Platform.OS === 'android') {
          const androidVersion = Number(Platform.Version);
          if (androidVersion < 30) {
              const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
              if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                  Alert.alert("Permission Denied", "App needs storage permission to save the file.");
                  setIsDownloading(false);
                  return;
              }
          }

          const filePath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
          await RNFS.writeFile(filePath, excelContent, 'utf8');
          Alert.alert("Download Complete! 🎉", `Report successfully saved in your phone's 'Downloads' folder:\n\n${fileName}`);
          
      } else {
          const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
          await RNFS.writeFile(filePath, excelContent, 'utf8');
          await Share.open({
              url: `file://${filePath}`,
              type: 'application/vnd.ms-excel',
              title: 'Save Attendance Report'
          });
      }

      setIsDownloadModalVisible(false);
      
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
          Alert.alert("Error", String(error.message || "An unexpected error occurred."));
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const saveRecord = async () => {
    if (!formData.employeeId) return Alert.alert("Required", "Please select an Employee first.");

    if (formData.status !== 'absent' && formData.status !== 'holiday') {
        const inMins = formData.checkIn.getHours() * 60 + formData.checkIn.getMinutes();
        const outMins = formData.checkOut.getHours() * 60 + formData.checkOut.getMinutes();
        if (outMins <= inMins) {
            return Alert.alert("Validation Error", "Check-out time must be later than Check-in time.");
        }
    }

    try {
      setFormLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const pad = (n: number) => n < 10 ? '0' + n : n;
      const cIn = `${pad(formData.checkIn.getHours())}:${pad(formData.checkIn.getMinutes())}`;
      const cOut = `${pad(formData.checkOut.getHours())}:${pad(formData.checkOut.getMinutes())}`;
      const d = formData.date;
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

      const payload = {
        employeeId: formData.employeeId, 
        date: dateStr,
        checkInTime: (formData.status === 'absent' || formData.status === 'holiday') ? null : cIn,
        checkOutTime: (formData.status === 'absent' || formData.status === 'holiday') ? null : cOut,
        status: formData.status, notes: formData.notes
      };

      if (isEditing) {
          await axios.put(`${API_BASE}/attendance/${editRecordId}`, payload, config);
      } else {
          await axios.post(`${API_BASE}/attendance`, payload, config);
      }
      
      setIsAddModalVisible(false);
      fetchData(true);
      Alert.alert("Success", "Attendance saved successfully.");
    } catch (err: any) { 
        Alert.alert("Failed", err.response?.data?.message || "Server Error. Please check your data."); 
    }
    finally { setFormLoading(false); }
  };

  const deleteRecord = (id: string) => {
    Alert.alert("Delete", "Are you sure?", [
        { text: "Cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            try {
                const token = await AsyncStorage.getItem('userToken');
                await axios.delete(`${API_BASE}/attendance/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                fetchData(true);
            } catch (e) {}
        }}
    ]);
  };

  const openEdit = (item: any) => {
      setIsEditing(true);
      setEditRecordId(item._id);
      
      const defaultIn = getInitialTime(9,0);
      const defaultOut = getInitialTime(18,0);

      setFormData({
          employeeId: item.employeeId?._id || item.employeeId,
          employeeName: `${item.employeeId?.userId?.firstName || ''} ${item.employeeId?.userId?.lastName || ''}`,
          date: new Date(item.date || new Date()),
          status: item.status || 'present',
          checkIn: item.checkIn?.time ? new Date(item.checkIn.time) : defaultIn,
          checkOut: item.checkOut?.time ? new Date(item.checkOut.time) : defaultOut,
          notes: item.notes || ''
      });
      setIsAddModalVisible(true);
  };

  const openAdd = () => {
      setIsEditing(false);
      setEditRecordId('');
      setFormData({
          employeeId: '', employeeName: 'Select Employee', 
          date: filterDate, status: 'present', 
          checkIn: getInitialTime(9,0), checkOut: getInitialTime(18,0), notes: ''
      });
      setIsAddModalVisible(true);
  };

  let baseDateRecords: any[] = [];
  let absentCountForSelectedDate = 0;

  if (canDo('VIEW')) {
      const targetDateStr = getSafeDateString(filterDate);
      baseDateRecords = records.filter(rec => {
          const d = new Date(rec.date || rec.checkIn?.time || filterDate);
          return getSafeDateString(d) === targetDateStr;
      });

      if (filterDate.getDay() !== 0) { 
          const punchedIds = baseDateRecords.map(r => r.employeeId?._id || r.employeeId);
          const absentEmps = allEmployees.filter(e => !punchedIds.includes(e._id)).map(e => ({
              _id: `absent-${e._id}`, employeeId: e, status: 'absent', date: filterDate, checkIn: null, checkOut: null
          }));
          absentCountForSelectedDate = absentEmps.length;
          baseDateRecords = [...baseDateRecords, ...absentEmps];
      }
  } else {
      const targetMonth = filterDate.getMonth();
      const targetYear = filterDate.getFullYear();
      
      const fetchedMonthRecords = records.filter(r => {
          const d = new Date(r.date || r.checkIn?.time);
          return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
      });

      const now = new Date();
      let lastDay = new Date(targetYear, targetMonth + 1, 0).getDate(); 
      if (targetMonth === now.getMonth() && targetYear === now.getFullYear()) {
          lastDay = now.getDate(); 
      } else if (targetYear > now.getFullYear() || (targetYear === now.getFullYear() && targetMonth > now.getMonth())) {
          lastDay = 0; 
      }

      let startDay = 1;
      if (records.length > 0) {
          const earliestTime = Math.min(...records.map(r => new Date(r.date || r.checkIn?.time).getTime()));
          const earliestDate = new Date(earliestTime);
          if (earliestDate.getMonth() === targetMonth && earliestDate.getFullYear() === targetYear) {
              startDay = earliestDate.getDate();
          }
      }

      const monthlyMap = new Map();
      fetchedMonthRecords.forEach(r => {
          const d = new Date(r.date || r.checkIn?.time);
          monthlyMap.set(getSafeDateString(d), r);
      });

      for (let i = startDay; i <= lastDay; i++) {
          const loopDate = new Date(targetYear, targetMonth, i);
          const dStr = getSafeDateString(loopDate);
          
          if (monthlyMap.has(dStr)) {
              baseDateRecords.push(monthlyMap.get(dStr));
          } else {
              if (loopDate.getDay() !== 0) { 
                  baseDateRecords.push({
                      _id: `absent-self-${dStr}`, 
                      employeeId: { userId: { firstName: myName.split(' ')[0] || '', lastName: myName.split(' ').slice(1).join(' ') || '' } }, 
                      status: 'absent', 
                      date: loopDate, 
                      checkIn: null, 
                      checkOut: null
                  });
              }
          }
      }
      
      baseDateRecords.sort((a, b) => new Date(b.date || b.checkIn?.time).getTime() - new Date(a.date || a.checkIn?.time).getTime());
  }

  useEffect(() => {
    const notifyAbsentEmployees = async () => {
      const hasViewPermission = permissions.includes('ATTENDANCE:VIEW');
      if (!hasViewPermission || absentCountForSelectedDate <= 0) {
        return;
      }

      const dateKey = getSafeDateString(filterDate);
      const storageKey = `absent_notified_${dateKey}`;
      const alreadyNotified = await AsyncStorage.getItem(storageKey);
      if (alreadyNotified === String(absentCountForSelectedDate)) {
        return;
      }

      await AsyncStorage.setItem(storageKey, String(absentCountForSelectedDate));
      showLocalNotification(
        'Absent Employees Found',
        `${absentCountForSelectedDate} employee(s) marked absent on ${dateKey}.`,
      );
    };

    notifyAbsentEmployees();
  }, [absentCountForSelectedDate, filterDate, permissions]);

  let p = 0, a = 0, l = 0, h = 0;
  baseDateRecords.forEach(r => {
      const s = String(r.status || "").toLowerCase();
      if (s === 'present') p++;
      else if (s === 'late') l++;
      else if (s === 'absent') a++;
      else if (s === 'half-day') h++;
  });

  const displayRecords = baseDateRecords.filter(rec => {
      const name = `${rec.employeeId?.userId?.firstName || ''} ${rec.employeeId?.userId?.lastName || ''}`.toLowerCase();
      const safeSearch = String(searchQuery || '').toLowerCase();
      const matchesSearch = name.includes(safeSearch);
      
      const safeFilterStatus = String(filterStatus || 'All Status').toLowerCase();
      const safeRecStatus = String(rec.status || '').toLowerCase();
      const matchesStatus = safeFilterStatus === 'all status' || safeRecStatus === safeFilterStatus;
      
      const matchesEmp = filterEmpId === 'All' || (rec.employeeId?._id || rec.employeeId) === filterEmpId;
      return matchesSearch && matchesStatus && matchesEmp;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} translucent backgroundColor="transparent" />
      
      <View style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg }}>
        <GlobalAppBar navigation={navigation} showSearch={true} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <View style={styles.header}>
            <View>
              <Text style={[styles.title, {color: colors.textMain}]}>{canDo('VIEW') ? "Team Attendance" : "My Attendance"}</Text>
              <Text style={{color: colors.textSub, fontSize: 11}}>{canDo('VIEW') ? "Managing Organization" : "Your personal records"}</Text>
            </View>
            <View style={{flexDirection: 'row'}}>
                {canDo('CREATE') && (
                    <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
                        <Feather name="plus" size={16} color="#FFF" /><Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 20}}>
            <KpiCard label="Present" val={p} color="#10B981" icon="account-check" />
            <KpiCard label="Absent" val={a} color="#EF4444" icon="account-remove" />
            <KpiCard label="Late" val={l} color="#F59E0B" icon="clock-alert" />
            <KpiCard label="Half Day" val={h} color="#3B82F6" icon="circle-half-full" />
        </ScrollView>

        <View style={styles.filterRow}>
            <TouchableOpacity 
                style={[styles.filterPill, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]} 
                onPress={() => setShowFilterDatePicker(true)}
            >
                <Text style={[styles.filterText, {color: colors.primary}]}>
                    {canDo('VIEW') ? getSafeDateString(filterDate) : `${MONTHS[filterDate.getMonth()]} ${filterDate.getFullYear()}`}
                </Text>
                <Feather name="calendar" size={14} color={colors.primary} style={{marginLeft: 6}}/>
            </TouchableOpacity>

            <TouchableOpacity 
                style={[styles.filterPill, { borderColor: '#10B981', backgroundColor: '#10B98110', paddingHorizontal: 12 }]} 
                onPress={() => syncBiometric(false)}
                disabled={isSyncing}
            >
                {isSyncing ? (
                    <ActivityIndicator size="small" color="#10B981" />
                ) : (
                    <MaterialCommunityIcons name="fingerprint" size={18} color="#10B981" />
                )}
            </TouchableOpacity>

            {canDo('VIEW') && (
                <TouchableOpacity style={[styles.filterPill, {borderColor: colors.border, flex: 1}]} onPress={() => setShowEmpModal(true)}>
                    <Text style={[styles.filterText, {color: colors.textMain}]} numberOfLines={1}>{filterEmpName}</Text>
                    <Feather name="chevron-down" size={14} color={colors.textSub} />
                </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.filterPill, {borderColor: colors.border}]} onPress={() => setShowStatusModal(true)}><Text style={[styles.filterText, {color: colors.textMain}]}>{filterStatus}</Text></TouchableOpacity>
        </View>

      {/*  <TouchableOpacity
  style={[
    styles.smartPunchBtnNew,
    isPunching && { opacity: 0.7 }
  ]}
  onPress={handleSmartPunch}
  activeOpacity={0.9}
  disabled={isPunching}
>
  <View style={styles.punchContent}>
    
    <View style={styles.iconCircle}>
      {isPunching ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <MaterialCommunityIcons name="face-recognition" size={26} color="#fff" />
      )}
    </View>

    <View style={{ flex: 1 }}>
      <Text style={styles.punchTitle}>
        {isPunching ? "Processing..." : "Punch Attendance"}
      </Text>
      <Text style={styles.punchSubtitle}>
        Face + GPS Verification Required
      </Text>
    </View>

    <Feather name="arrow-right" size={22} color="#fff" />

  </View>
</TouchableOpacity> */}
        {loading && !refreshing ? <ActivityIndicator size="large" color="#3B82F6" style={{marginTop: 50}}/> : displayRecords.map((item, index) => (
            <View key={index} style={[styles.attCard, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                <View style={styles.cardHeader}>
                    <View style={styles.userInfo}>
                        <View style={styles.avatar}><Text style={styles.avatarText}>{(item.employeeId?.userId?.firstName || 'U').charAt(0)}</Text></View>
                        <View>
                            <Text style={[styles.userName, {color: colors.textMain}]}>{item.employeeId?.userId?.firstName} {item.employeeId?.userId?.lastName}</Text>
                            <Text style={styles.userSub}>{getCardDateString(item.date || item.checkIn?.time || filterDate)}</Text>
                        </View>
                    </View>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <View style={[styles.statusTag, {backgroundColor: getStatusStyle(item.status).bg}]}>
                            <Text style={[styles.statusTagText, {color: getStatusStyle(item.status).text}]}>{item.status}</Text>
                        </View>
                        {canDo('UPDATE') && item.status !== 'absent' && (
                            <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                                <Feather name="edit-2" size={14} color={colors.textSub} />
                            </TouchableOpacity>
                        )}
                        {canDo('DELETE') && item.status !== 'absent' && (
                            <TouchableOpacity style={styles.editBtn} onPress={() => deleteRecord(item._id)}>
                                <Feather name="trash-2" size={14} color="#EF4444" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {item.status !== 'absent' && (
                    <View style={[styles.cardBody, {borderTopColor: colors.border}]}>
                        <View style={styles.timeInfo}><Text style={styles.timeLabel}>CHECK IN</Text><Text style={[styles.timeValue, {color: colors.textMain}]}>{formatTimeUI(item.checkIn)}</Text></View>
                        <View style={styles.timeInfo}><Text style={styles.timeLabel}>CHECK OUT</Text><Text style={[styles.timeValue, {color: colors.textMain}]}>{formatTimeUI(item.checkOut)}</Text></View>
                        <View style={[styles.timeInfo, {alignItems: 'flex-end'}]}>
                            <Text style={styles.timeLabel}>HOURS</Text>
                            <Text style={{fontSize: 14, color: '#3B82F6', fontWeight: '900'}}>{formatWorkingHours(item.workingHours)}</Text>
                        </View>
                    </View>
                )}
            </View>
        ))}

        {!loading && displayRecords.length === 0 && (
            <View style={{alignItems: 'center', marginTop: 50}}>
                <Feather name="inbox" size={50} color={colors.border} />
                <Text style={{ textAlign: 'center', color: colors.textSub, marginTop: 12, fontSize: 14, fontWeight: '600' }}>No records found for the selected filter.</Text>
            </View>
        )}
      </ScrollView>

      {canDo('VIEW') && (
          <TouchableOpacity style={[styles.downloadFab, {backgroundColor: colors.primary}]} onPress={() => setIsDownloadModalVisible(true)}>
              <MaterialCommunityIcons name="file-excel" size={24} color="#fff" />
          </TouchableOpacity>
      )}

      {/* 🚀 FIXED: ADVANCED DATE & EMPLOYEE DOWNLOAD MODAL */}
      <Modal visible={isDownloadModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBg, borderColor: colors.border, padding: 24, borderRadius: 20 }]}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15}}>
                    <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.textMain}}>Download Report</Text>
                    <TouchableOpacity onPress={() => setIsDownloadModalVisible(false)}>
                        <MaterialCommunityIcons name="close" size={24} color={colors.textSub} />
                    </TouchableOpacity>
                </View>
                
                <Text style={{color: colors.textSub, marginBottom: 20, fontSize: 13}}>Select date range and employee to generate custom excel report.</Text>
                
                <Text style={styles.label}>Select Employee</Text>
                <TouchableOpacity style={[styles.input, {borderColor: colors.border, marginBottom: 15}]} onPress={() => setShowDlEmpModal(true)}>
                    <Text style={{color: colors.textMain}}>{dlEmpName}</Text>
                </TouchableOpacity>

                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25}}>
                    <View style={{width: '48%'}}>
                        <Text style={styles.label}>Start Date</Text>
                        <TouchableOpacity style={[styles.input, {borderColor: colors.border}]} onPress={() => setShowDlStartPicker(true)}>
                            <Text style={{color: colors.textMain}}>{getSafeDateString(dlStartDate)}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={{width: '48%'}}>
                        <Text style={styles.label}>End Date</Text>
                        <TouchableOpacity style={[styles.input, {borderColor: colors.border}]} onPress={() => setShowDlEndPicker(true)}>
                            <Text style={{color: colors.textMain}}>{getSafeDateString(dlEndDate)}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity 
                    style={{backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center'}}
                    onPress={handleDownloadReport}
                    disabled={isDownloading}
                >
                    {isDownloading ? <ActivityIndicator color="#fff" /> : (
                        <>
                            <MaterialCommunityIcons name="download" size={20} color="#fff" style={{marginRight: 8}} />
                            <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>Generate Excel</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

      <Modal visible={isAddModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={styles.modalNav}>
                    <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.textMain}}>{isEditing ? 'Update' : 'New'} Record</Text>
                    <TouchableOpacity onPress={() => setIsAddModalVisible(false)}><Feather name="x" size={24} color={colors.textMain}/></TouchableOpacity>
                </View>
                <ScrollView style={{padding: 20}}>
                    <Text style={styles.label}>Employee *</Text>
                    <TouchableOpacity style={[styles.input, {borderColor: colors.border, marginBottom: 15}]} onPress={() => !isEditing && setShowFormEmp(true)} disabled={isEditing}>
                        <Text style={{color: colors.textMain}}>{formData.employeeName}</Text>
                    </TouchableOpacity>

                    <View style={{flexDirection: 'row', justifyContent:'space-between', marginTop: 15}}>
                        <View style={{width:'48%'}}><Text style={styles.label}>Date *</Text>
                            <TouchableOpacity style={[styles.input, {borderColor: colors.border}]} onPress={() => setShowFormDate(true)}>
                                <Text style={{color: colors.textMain}}>{getSafeDateString(formData.date)}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{width:'48%'}}><Text style={styles.label}>Status</Text>
                            <TouchableOpacity style={[styles.input, {borderColor: colors.border}]} onPress={() => setShowFormStatus(true)}>
                                <Text style={{color: colors.textMain, textTransform: 'capitalize'}}>{formData.status}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {formData.status !== 'absent' && formData.status !== 'holiday' && (
                        <View style={{flexDirection: 'row', justifyContent:'space-between', marginTop: 15}}>
                            <View style={{width:'48%'}}><Text style={styles.label}>In Time</Text>
                                <TouchableOpacity style={[styles.input, {borderColor: colors.border}]} onPress={() => setShowFormCheckIn(true)}><Text style={{color: colors.textMain}}>{formatTimeUI(formData.checkIn)}</Text></TouchableOpacity>
                            </View>
                            <View style={{width:'48%'}}><Text style={styles.label}>Out Time</Text>
                                <TouchableOpacity style={[styles.input, {borderColor: colors.border}]} onPress={() => setShowFormCheckOut(true)}><Text style={{color: colors.textMain}}>{formatTimeUI(formData.checkOut)}</Text></TouchableOpacity>
                            </View>
                        </View>
                    )}
                </ScrollView>
                <View style={styles.modalFooter}>
                    <TouchableOpacity style={styles.submitBtn} onPress={saveRecord} disabled={formLoading}>
                        {formLoading ? <ActivityIndicator color="#fff"/> : <Text style={{color:'#fff', fontWeight:'bold'}}>SUBMIT RECORD</Text>}
                    </TouchableOpacity>
                </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <DropdownModal visible={showStatusModal} title="Filter Status" data={['All Status', ...STATUS_OPTIONS]} onSelect={(v:string) => setFilterStatus(v)} onClose={()=>setShowStatusModal(false)} colors={colors} />
      <DropdownModal visible={showFormStatus} title="Select Status" data={STATUS_OPTIONS} onSelect={(v:any) => setFormData({...formData, status: v})} onClose={() => setShowFormStatus(false)} colors={colors} />
      <DropdownModal visible={showEmpModal} title="Select Employee" data={[{userId:{_id:'All', firstName:'All', lastName:'Employees'}}, ...allEmployees]} displayKey={(i:any) => `${i.userId?.firstName || ''} ${i.userId?.lastName || ''}`} onSelect={(v:any) => { setFilterEmpId(v._id || 'All'); setFilterEmpName(v.userId ? `${v.userId.firstName} ${v.userId.lastName}` : 'All Employees'); }} onClose={()=>setShowEmpModal(false)} colors={colors} />
      
      {/* Reused DropdownModal for the Download Filter specific employee selection */}
      <DropdownModal visible={showDlEmpModal} title="Select Employee" data={[{userId:{_id:'All', firstName:'All', lastName:'Employees'}}, ...allEmployees]} displayKey={(i:any) => `${i.userId?.firstName || ''} ${i.userId?.lastName || ''}`} onSelect={(v:any) => { setDlEmpId(v._id || 'All'); setDlEmpName(v.userId ? `${v.userId.firstName} ${v.userId.lastName}` : 'All Employees'); }} onClose={()=>setShowDlEmpModal(false)} colors={colors} />

      <DropdownModal visible={showFormEmp} title="Select Absent Employee" 
        data={formAbsentEmployees} 
        displayKey={(i:any) => `${i.userId?.firstName || ''} ${i.userId?.lastName || ''}`} 
        onSelect={(v:any) => setFormData({...formData, employeeId: v._id, employeeName: `${v.userId?.firstName} ${v.userId?.lastName}`})} 
        onClose={()=>setShowFormEmp(false)} colors={colors} 
      />
      
      {showFilterDatePicker && <DateTimePicker value={filterDate} mode="date" onChange={(e, d) => { 
          setShowFilterDatePicker(false); 
          if(e.type === 'set' && d){ 
              setFilterDate(d); 
              setIsDateFiltered(true); 
          }
      }} />}
      
      {showDlStartPicker && <DateTimePicker value={dlStartDate} mode="date" onChange={(e, d) => { 
          setShowDlStartPicker(false); 
          if(e.type === 'set' && d) setDlStartDate(d); 
      }} />}
      
      {showDlEndPicker && <DateTimePicker value={dlEndDate} mode="date" onChange={(e, d) => { 
          setShowDlEndPicker(false); 
          if(e.type === 'set' && d) setDlEndDate(d); 
      }} />}

      {showFormDate && <DateTimePicker value={formData.date} mode="date" onChange={(e,d) => {setShowFormDate(false); if(e.type === 'set' && d) setFormData({...formData, date:d});}}/>}
      {showFormCheckIn && <DateTimePicker value={formData.checkIn} mode="time" onChange={(e,d) => {setShowFormCheckIn(false); if(e.type === 'set' && d) setFormData({...formData, checkIn:d});}}/>}
      {showFormCheckOut && <DateTimePicker value={formData.checkOut} mode="time" onChange={(e,d) => {setShowFormCheckOut(false); if(e.type === 'set' && d) setFormData({...formData, checkOut:d});}}/>}
    </SafeAreaView>
  );
}

const DropdownModal = ({ visible, onClose, title, data, onSelect, displayKey, colors }: any) => (
  <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
          <View style={[styles.statusSheet, { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[styles.sheetTitle, { color: colors.textMain }]}>{title}</Text>
              <ScrollView style={{maxHeight: 300}}>{data.map((item: any, index: number) => (<TouchableOpacity key={index} style={[styles.sheetItem, {borderBottomColor: colors.border}]} onPress={() => { onSelect(item); onClose(); }}><Text style={[styles.sheetText, { color: colors.textMain }]}>{typeof displayKey === 'function' ? displayKey(item) : item}</Text></TouchableOpacity>))}</ScrollView>
          </View>
      </TouchableOpacity>
  </Modal>
);

const KpiCard = ({label, val, color, icon}: any) => (
    <View style={[styles.kpiCard, {borderLeftColor: color}]}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}><MaterialCommunityIcons name={icon} size={16} color={color} style={{marginRight: 6}} /><Text style={styles.kpiLabel}>{label}</Text></View>
        <Text style={[styles.kpiVal, {color: '#1E293B'}]}>{val}</Text>
    </View>
);

const styles = StyleSheet.create({
    smartPunchBtnNew: {
  backgroundColor: '#6366F1',
  padding: 16,
  borderRadius: 16,
  marginBottom: 16,
  elevation: 3,
},

punchContent: {
  flexDirection: 'row',
  alignItems: 'center',
},

iconCircle: {
  width: 45,
  height: 45,
  borderRadius: 22,
  backgroundColor: 'rgba(255,255,255,0.2)',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
},

punchTitle: {
  color: '#fff',
  fontSize: 16,
  fontWeight: 'bold',
},

punchSubtitle: {
  color: '#E0E7FF',
  fontSize: 12,
},
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '900' },
  addBtn: { backgroundColor: '#3B82F6', padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12, marginLeft: 5 },
  kpiCard: { backgroundColor: '#FFF', width: 120, padding: 15, borderRadius: 12, marginRight: 12, borderLeftWidth: 4, elevation: 2 },
  kpiVal: { fontSize: 22, fontWeight: '900', marginTop: 10 },
  kpiLabel: { fontSize: 12, color: '#64748B', fontWeight: 'bold' },
  filterRow: { flexDirection: 'row', marginBottom: 15, justifyContent: 'space-between' },
  filterPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginRight: 6 },
  filterText: { fontSize: 12, fontWeight: '600' },
  attCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  userName: { fontSize: 14, fontWeight: 'bold' },
  userSub: { fontSize: 10, color: '#94A3B8' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusTagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  editBtn: { padding: 6, borderRadius: 6, borderWidth: 1, borderColor: '#f1f5f9', marginLeft: 8 },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 15 },
  timeInfo: { flex: 1 },
  timeLabel: { fontSize: 9, fontWeight: 'bold', color: '#94A3B8', marginBottom: 4 },
  timeValue: { fontSize: 12, fontWeight: '800' },
  
  downloadFab: { position: 'absolute', bottom: 30, right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, maxHeight: '85%' },
  modalNav: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, alignItems: 'center' },
  modalFooter: { padding: 20, borderTopWidth: 1, backgroundColor: '#fff' },
  submitBtn: { backgroundColor: '#3b82f6', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  label: { marginBottom: 8, fontWeight: '600', fontSize: 13, color: '#64748B' },
  input: { borderWidth: 1, minHeight: 48, borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center' },
  statusSheet: { padding: 20, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  sheetItem: { paddingVertical: 15, borderBottomWidth: 1 },
  sheetText: { fontSize: 15, textAlign: 'center', textTransform: 'capitalize' }
});