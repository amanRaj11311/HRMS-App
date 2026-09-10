import React, { useState, useEffect } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, 
  StatusBar, Platform, ActivityIndicator, Alert, SafeAreaView, RefreshControl, PermissionsAndroid, Image 
} from "react-native";
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import axios from 'axios'; 
import Geolocation from 'react-native-geolocation-service';
import { useTheme } from '../constants/theme'; 
import GlobalAppBar from '../components/GlobalAppBar';
import { API_BASE } from '../api/api';
import GeoTagAttendanceCamera from '../screens/GeoAttendanceCamera'; // adjust path to wherever you place it

const { width } = Dimensions.get("window");

export default function UnifiedDashboard({ navigation }: any) {
  const { colors, isLightMode } = useTheme(); 
  
  const [isPrivileged, setIsPrivileged] = useState(false); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [userName, setUserName] = useState("User");
  const [userRoleDisplay, setUserRoleDisplay] = useState("Employee");
  const [currentDate, setCurrentDate] = useState("");
  const [liveTime, setLiveTime] = useState("");

  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [adminStats, setAdminStats] = useState<any>({});
  const [recentEmployees, setRecentEmployees] = useState<any[]>([]);
  const [pendingLeavesList, setPendingLeavesList] = useState<any[]>([]); 
  const [announcements, setAnnouncements] = useState<any[]>([]);
  
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState({ present: 0, late: 0, halfDay: 0, wfh: 0, absent: 0, total: 0 });

  // 🚀 Dynamic Attendance Settings (backend-driven)
  const [attSettings, setAttSettings] = useState<any>(null);
  const [punchLoading, setPunchLoading] = useState(false);
const [selfCheckinAllowed, setSelfCheckinAllowed] = useState<boolean>(false);
  // 🚀 geo-tagged selfie check-in/out states
  const [showGeoCam, setShowGeoCam] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pendingAddress, setPendingAddress] = useState('');
  // 🚀 extra geo context for the camera screen's "DCS Geo Location" panel (Step 3 of workflow)
  const [pendingAccuracy, setPendingAccuracy] = useState<number | null>(null);
  const [pendingDistance, setPendingDistance] = useState<number | null>(null);
  const [pendingLocationName, setPendingLocationName] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      const today = new Date();
      setCurrentDate(today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
      
      const timer = setInterval(() => {
         setLiveTime(
           new Date().toLocaleTimeString('en-IN', {
             hour: 'numeric',
             minute: '2-digit',
             hour12: true,
           }).toUpperCase()
         );
      }, 1000);
      
      autoSyncAndInit();
      
      return () => clearInterval(timer);
    }, [])
  );

  const autoSyncAndInit = async () => {
      initDashboard();
      try {
          const token = await AsyncStorage.getItem('userToken');
          axios.get(`${API_BASE}/device/attendance?_t=${Date.now()}`, { 
              headers: { Authorization: `Bearer ${token}` } 
          }).catch(() => {}); 
      } catch (e) {} 
  };

  const initDashboard = async () => {
      const role = await AsyncStorage.getItem('userRole'); 
      const name = await AsyncStorage.getItem('userName');
      const permsStr = await AsyncStorage.getItem('userPermissions');
      
      let parsedPerms: string[] = [];
      if (permsStr) parsedPerms = JSON.parse(permsStr).map((p: string) => p.toUpperCase());
      
      const adminPerms = [
          'EMPLOYEE:CREATE', 'EMPLOYEE:UPDATE', 'EMPLOYEE:DELETE', 
          'ROLE:CREATE', 'ROLE:UPDATE', 'PAYROLL:CREATE', 
          'LEAVES:APPROVE', 'LEAVES:UPDATE', 'ATTENDANCE:UPDATE', 
          'ANALYTICS:VIEW'
      ];
      
      const isActuallyAdminOrHR = parsedPerms.some(p => adminPerms.includes(p));
      const roleStr = role ? role.toLowerCase() : '';
      const hasAdminRights = isActuallyAdminOrHR || roleStr === 'admin' || roleStr.includes('super') || roleStr === 'hr';
      
      setIsPrivileged(hasAdminRights);
      
      if (isActuallyAdminOrHR && roleStr.includes('employee')) setUserRoleDisplay('MANAGEMENT');
      else if (role) setUserRoleDisplay(role.toUpperCase());
      
      if (name) setUserName(name);
      setPermissions(parsedPerms);

      // 🚀 Individual self check-in/out permission (default true unless explicitly stored as 'false')
      const selfCheckinStr = await AsyncStorage.getItem('selfCheckinAllowed');
setSelfCheckinAllowed(selfCheckinStr === 'true');
      
      await fetchData(hasAdminRights);
  };

  const getSafeDateString = (d: Date) => {
      if (!d) return '--/--/----';
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const fetchData = async (isAdminUser: boolean, isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const ts = Date.now();

      // 🚀 FETCH ATTENDANCE SETTINGS (source of truth for check-in eligibility + geofence)
      const attSetRes = await axios.get(`${API_BASE}/settings/attendance?_t=${ts}`, config).catch(() => null);
      if (attSetRes?.data?.data) {
          setAttSettings(attSetRes.data.data);
      }

      const annRes = await axios.get(`${API_BASE}/announcements?limit=50&_t=${ts}`, config).catch(() => null);
      let rawAnn = annRes?.data?.data?.data || annRes?.data?.data || [];
      if (!Array.isArray(rawAnn)) rawAnn = [];
      const sortedAnn = rawAnn.sort((a:any, b:any) => (a.isPinned === b.isPinned) ? 0 : a.isPinned ? -1 : 1);
      setAnnouncements(sortedAnn);

      let activities: any[] = [];
      if (sortedAnn.length > 0) {
          activities.push({
              icon: 'bullhorn', color: '#3B82F6', title: 'New Announcement', desc: sortedAnn[0].title
          });
      }
      setRecentActivities(activities);

      const myAttRes = await axios.get(`${API_BASE}/attendance/self?limit=500&_t=${ts}`, config).catch(() => null);
      const myAttData = Array.isArray(myAttRes?.data?.data) ? myAttRes.data.data : [];
      
      const mappedAttData = myAttData.map((item: any) => {
        let updated = { ...item };
        let hasValidCheckOut = true;

        if (updated.checkIn?.time && updated.checkOut?.time) {
            const inMs = new Date(updated.checkIn.time).getTime();
            const outMs = new Date(updated.checkOut.time).getTime();
            if (Math.abs(outMs - inMs) <= 2000) {
                updated.checkOut.time = null; updated.workingHours = null; hasValidCheckOut = false; 
            }
        } else if (!updated.checkOut?.time) {
            hasValidCheckOut = false;
        }
        
        if (updated.checkIn?.time) {
            const punchIn = new Date(updated.checkIn.time);
            const hour = punchIn.getHours();
            const min = punchIn.getMinutes();
            const isLate = (hour > 9 || (hour === 9 && min > 15));

            if (hasValidCheckOut && updated.workingHours !== null && updated.workingHours !== undefined) {
                const hours = parseFloat(updated.workingHours);
                if (!isNaN(hours) && hours < 4) updated.status = 'half-day';
                else updated.status = isLate ? 'late' : 'present';
            } else {
                updated.status = isLate ? 'late' : 'present';
            }
        }
        return updated;
      });

      const now = new Date();
      const targetMonth = now.getMonth();
      const targetYear = now.getFullYear();
      
      const fetchedMonthRecords = mappedAttData.filter((r: any) => {
          const d = new Date(r.date || r.checkIn?.time);
          return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
      });

      const monthlyMap = new Map();
      fetchedMonthRecords.forEach((r: any) => {
          const d = new Date(r.date || r.checkIn?.time);
          monthlyMap.set(getSafeDateString(d), r);
      });

      let startDay = 1;
      if (mappedAttData.length > 0) {
          const earliestTime = Math.min(...mappedAttData.map((r: any) => new Date(r.date || r.checkIn?.time).getTime()));
          const earliestDate = new Date(earliestTime);
          if (earliestDate.getMonth() === targetMonth && earliestDate.getFullYear() === targetYear) {
              startDay = earliestDate.getDate();
          }
      }

      let p = 0, l = 0, h = 0, w = 0, a = 0;
      const lastDay = now.getDate();
      
      for (let i = startDay; i <= lastDay; i++) {
          const loopDate = new Date(targetYear, targetMonth, i);
          const dStr = getSafeDateString(loopDate);
          
          if (monthlyMap.has(dStr)) {
              const rec = monthlyMap.get(dStr);
              const status = String(rec.status || '').toLowerCase();
              if(status === 'present') p++;
              else if(status === 'late') l++;
              else if(status === 'half-day' || status === 'halfday') h++;
              else if(status === 'wfh' || status === 'remote' || status === 'work-from-home') w++;
              else if(status === 'absent') a++;
         } else {
              const dayOfWeek = loopDate.getDay();
              let isWeekOff = false;
              
              if (dayOfWeek === 0) {
                  isWeekOff = true; 
              } else if (dayOfWeek === 6) {
                  const cutoffDate = new Date(2026, 5, 8); 
                  if (loopDate > cutoffDate) {
                      isWeekOff = true;
                  }
              }

              if (!isWeekOff) {
                  a++; 
              }
          }
      }
      
      setMonthlyStats({ present: p, late: l, halfDay: h, wfh: w, absent: a, total: p+l+h+w+a });

      const todayStr = now.toDateString();
      let todayRec = mappedAttData.find((r: any) => new Date(r.date || r.checkIn?.time).toDateString() === todayStr);
      setTodayRecord(todayRec);

      if (isAdminUser) {
          const pad = (n: number) => n < 10 ? '0' + n : n;
          const todayDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

          const [empRes, allAttRes, leaveRes] = await Promise.all([
              axios.get(`${API_BASE}/employees?limit=500&sort=-createdAt&_t=${ts}`, config).catch(() => null),
              axios.get(`${API_BASE}/attendance?date=${todayDateStr}&limit=500&_t=${ts}`, config).catch(() => null),
              axios.get(`${API_BASE}/leaves?limit=500&_t=${ts}`, config).catch(() => null)
          ]);

          const allEmps = Array.isArray(empRes?.data?.data?.data) ? empRes.data.data.data : (Array.isArray(empRes?.data?.data) ? empRes.data.data : []);
          const totalEmployees = allEmps.length;
          const totalHR = allEmps.filter((e: any) => (e.department || '').toLowerCase().includes('hr') || (e.department || '').toLowerCase().includes('human resource')).length;
          
          const allAtt = Array.isArray(allAttRes?.data?.data?.data) ? allAttRes.data.data.data : (Array.isArray(allAttRes?.data?.data) ? allAttRes.data.data : []);
          const presentToday = allAtt.filter((att: any) => {
              if (new Date(att.date || att.checkIn?.time).toDateString() !== todayStr) return false;
              let status = (att.status || '').toLowerCase();
              if (att.checkIn?.time) {
                  const outMs = att.checkOut?.time ? new Date(att.checkOut.time).getTime() : null;
                  const inMs = new Date(att.checkIn.time).getTime();
                  const isVoid = outMs && (Math.abs(outMs - inMs) <= 2000);
                  const validOut = outMs && !isVoid;
                  
                  const punchIn = new Date(att.checkIn.time);
                  const hour = punchIn.getHours();
                  const min = punchIn.getMinutes();
                  const isLate = (hour > 9 || (hour === 9 && min > 20));

                  if (validOut && att.workingHours !== null && att.workingHours !== undefined) {
                      const hours = parseFloat(att.workingHours);
                      if (!isNaN(hours) && hours < 8) status = 'half-day';
                      else status = isLate ? 'late' : 'present';
                  } else {
                      status = isLate ? 'late' : 'present';
                  }
              }
              return ['present', 'late', 'half-day'].includes(status);
          }).length;

          const allLeaves = Array.isArray(leaveRes?.data?.data?.data) ? leaveRes.data.data.data : (Array.isArray(leaveRes?.data?.data) ? leaveRes.data.data : []);
          const pLeaves = allLeaves.filter((l: any) => (l.status || '').toLowerCase() === 'pending');

          setAdminStats({ totalEmployees, presentToday, pendingLeaves: pLeaves.length, totalHR });
          setRecentEmployees(allEmps.slice(0, 5)); 
          setPendingLeavesList(pLeaves.slice(0, 3)); 
      }
    } catch (e: any) { 
        console.log("Dashboard Fetch Error:", e);
    } finally { 
        setLoading(false); setRefreshing(false); 
    }
  };

  const updateLeaveStatus = async (leaveId: string, newStatus: string) => {
      Alert.alert("Confirm Action", `Are you sure you want to ${newStatus === 'approved' ? 'Accept' : 'Reject'} this leave?`, [
          { text: "Cancel", style: "cancel" },
          { 
              text: "Yes, Do it", 
              onPress: async () => {
                  try {
                      setLoading(true);
                      const token = await AsyncStorage.getItem('userToken');
                      await axios.put(`${API_BASE}/leaves/${leaveId}`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
                      initDashboard(); 
                  } catch (e: any) {
                      Alert.alert("Error", e.response?.data?.message || "Failed to update leave.");
                  } finally { setLoading(false); }
              } 
          }
      ]);
  };

  // 🚀 MATH FUNCTION: Haversine distance calculator for Geo-fence
  const getDistanceFromLatLonInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000;
  };

  // 🚀 free reverse-geocoding via OpenStreetMap Nominatim (no API key).
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'DCS-HRMS-App/1.0 (support@dcstechnosis.com)' } }
      );
      const data = await res.json();
      return data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (e) {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; // graceful fallback, flow still continues
    }
  };

  // 🚀 Step 1 (permission gate) — does this employee have Self Check-In/Check-Out
  // permission at all? Computed from RBAC permissions, independent of the admin's
  // global toggle (attSettings.checkinEnabled) and the individual flag (selfCheckinAllowed),
  // both of which are checked further down in handlePunch / at render time.
  const hasSelfCheckinPermission = permissions.some(p => p.includes('ATTENDANCE:SELF'));
const canSelfCheckin =
  hasSelfCheckinPermission &&
  selfCheckinAllowed === true &&
  attSettings?.checkinEnabled === true;
  const handlePunch = async () => {
    // ── Step 1: Permission check — must happen before anything else, including
    // starting the location workflow. If the employee has no Self Check-In/Check-Out
    // permission at all, stop here. (The button itself is also hidden for this case —
    // see the render logic below — this is a defensive second check.)
    if (!hasSelfCheckinPermission) {
      return Alert.alert(
        "Not Allowed",
        "Self Check-In / Check-Out permission is not available. Please contact HR/Admin for permission."
      );
    }

    // 1) Global backend-driven flag (admin toggles this org-wide)
    if (!attSettings || attSettings.checkinEnabled === false) {
      return Alert.alert(
        "Not Allowed",
        "Self check-in/out is disabled by admin. Please contact HR/admin."
      );
    }

    // 2) Individual (per-employee) flag — even if org-wide is enabled, this specific employee
    //    may be excluded from self check-in/out.
    if (selfCheckinAllowed === false) {
      return Alert.alert(
        "Not Allowed",
        "Self check-in/out is not enabled for your account. Please contact HR/admin."
      );
    }

    if (Platform.OS === 'android') {
        try {
            const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                return Alert.alert("Permission Denied", "Location permission is required for attendance.");
            }
        } catch (err) {
            console.warn(err);
        }
    }

    setCheckingLocation(true);
    Geolocation.getCurrentPosition(
        async (position: any) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            const accuracy = position.coords.accuracy ?? null;
            const locations = attSettings?.locations || [];

            let distanceFromAllowed: number | null = null;
            let nearestLocationName: string | null = null;

            // ── Case B: Geo-fence gate — camera stays closed until inside range ──
            if (attSettings?.locationEnabled) {
                if (locations.length === 0) {
                    setCheckingLocation(false);
                    return Alert.alert("Configuration Error", "Location restriction is enabled but no office locations are configured.");
                }

                let nearest = locations[0];
                let minDist = Infinity;
                for (const loc of locations) {
                    const dist = getDistanceFromLatLonInMeters(userLat, userLng, loc.latitude, loc.longitude);
                    if (dist < minDist) { minDist = dist; nearest = loc; }
                }

                const withinRange = minDist <= (nearest.radiusMeters || 100);
                distanceFromAllowed = minDist;
                nearestLocationName = nearest.name || 'the office location';

                if (!withinRange) {
                    setCheckingLocation(false);
                    return Alert.alert(
                        "Out of Range",
                        `You are outside the allowed location. You're ${Math.round(minDist)}m away from ${nearestLocationName}. Please move within ${nearest.radiusMeters || 100}m to check in/out.`
                    );
                }
            }
            const addr = await reverseGeocode(userLat, userLng);
            setPendingLocation({ latitude: userLat, longitude: userLng });
            setPendingAddress(addr);
            setPendingAccuracy(accuracy);
            setPendingDistance(distanceFromAllowed);
            setPendingLocationName(nearestLocationName);
            setCheckingLocation(false);
            setShowGeoCam(true);
        },
        (error: any) => {
            setCheckingLocation(false);
            Alert.alert("Location Error", error.message || "Failed to fetch current location. Make sure GPS is enabled.");
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

const handlePhotoCaptured = async (fileUri: string) => {
  setShowGeoCam(false);
  if (!pendingLocation) return; // safety guard

  setPunchLoading(true);
  try {
      const token = await AsyncStorage.getItem('userToken');
      const myEmpId = await AsyncStorage.getItem('employeeId');

      // ── Upload photo ──
      const form = new FormData();
      form.append('file', {
          uri: fileUri,
          name: `attendance_${Date.now()}.jpg`,
          type: 'image/jpeg',
      } as any);

      const uploadRes = await axios.post(`${API_BASE}/upload`, form, {
          headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data',
          },
      });

      const rawPath =
          uploadRes.data?.fileUrl ||
          uploadRes.data?.url ||
          uploadRes.data?.data?.fileUrl ||
          uploadRes.data?.data?.url;

      if (!rawPath) throw new Error('Upload did not return a file URL.');

      const apiOrigin = API_BASE.replace(/\/api\/?$/, '');
      const photoProof = /^https?:\/\//i.test(rawPath)
          ? rawPath
          : `${apiOrigin}${rawPath.startsWith('/') ? '' : '/'}${rawPath}`;

      // ── Check-in / checkout ──
      const isCheckingOut = todayRecord?.checkIn?.time && !todayRecord?.checkOut?.time;
      const endpoint = isCheckingOut ? '/attendance/checkout' : '/attendance/checkin';

      await axios.post(
          `${API_BASE}${endpoint}`,
          {
              employeeId: myEmpId,
              method: 'mobile',
              location: pendingLocation,
              photoProof,
          },
          { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert("Success", `Successfully checked ${isCheckingOut ? 'out' : 'in'}!`);
      await fetchData(isPrivileged, true);
  } catch (e: any) {
      Alert.alert("Error", e.response?.data?.message || e.message || "Failed to mark attendance.");
  } finally {
      setPunchLoading(false);
      setPendingLocation(null);
      setPendingAddress('');
      setPendingAccuracy(null);
      setPendingDistance(null);
      setPendingLocationName(null);
  }
};

  const hasPerm = (resourceKey: string) => {
      if (!resourceKey) return true;
      const keys = resourceKey.split('|'); 
      return keys.some(key => permissions.some(p => p.includes(key.toUpperCase())));
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    return hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  };
  
  const formatTime = (iso: any) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).toUpperCase();
  };

  const QUICK_LINKS = [
    { label: 'Attendance', icon: 'fingerprint', color: '#10B981', route: 'Attendance', perm: 'ATTENDANCE' },
    { label: 'Leaves', icon: 'calendar-plus', color: '#3B82F6', route: 'Leaves', perm: 'LEAVES' },
    { label: 'Employees', icon: 'account-group', color: '#F59E0B', route: 'Employees', perm: 'EMPLOYEE' },
    { label: 'Performance', icon: 'star', color: '#F43F5E', route: 'Performance', perm: 'PERFORMANCE' },
    { label: 'Leads', icon: 'account-multiple-plus', color: '#8B5CF6', route: 'Leads', perm: 'LEADS' },
    { label: 'Assets', icon: 'briefcase', color: '#14B8A6', route: 'Assets', perm: 'ASSET' },
    { label: 'Roles', icon: 'shield-account', color: '#64748B', route: 'RolesPermissions', perm: 'ROLE' },
    { label: 'Announce', icon: 'bullhorn', color: '#EAB308', route: 'Announcements', perm: 'ANNOUNCEMENT' },
    { label: 'Payslip', icon: 'file-document-outline', color: '#EC4899', route: 'Payslips', perm: 'SALARY-SLIP|PAYSLIP' } ,
    { label: 'Documents', icon: 'file-document', color: '#0EA5E9', route: 'Documents', perm: '' }, 
    { label: 'Analytics', icon: 'chart-line', color: '#22C55E', route: 'Analytics', perm: 'ANALYTICS', adminOnly: true }
  ];

  // 🎨 Premium KPI card — colored left accent, tinted glow shadow, richer icon tile
  const StatCard = ({ title, val, icon, color, bg, subText, actionLabel, onAction }: any) => (
    <View style={[
        styles.kpiCard,
        {
            backgroundColor: colors.cardBg,
            borderColor: colors.border,
            borderLeftColor: color,
            shadowColor: color,
        }
    ]}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <View style={[styles.kpiIcon, {backgroundColor: bg}]}>
                <MaterialCommunityIcons name={icon} size={23} color={color} />
            </View>
            {actionLabel && (
                <TouchableOpacity style={[styles.kpiActionBtn, {backgroundColor: color, shadowColor: color}]} onPress={onAction} activeOpacity={0.8}>
                    <Text style={styles.kpiActionText}>{actionLabel}</Text>
                </TouchableOpacity>
            )}
        </View>
        <Text style={[styles.kpiVal, {color: colors.textMain}]}>{val}</Text>
        {subText && <Text style={styles.kpiSubText}>{subText}</Text>}
        <Text style={styles.kpiLabel}>{title}</Text>
    </View>
  );

  const LegendItem = ({color, label, count}: any) => (
      <View style={{flexDirection: 'row', alignItems: 'center', width: '31%', marginBottom: 14}}>
          <View style={{width: 10, height: 10, borderRadius: 3, backgroundColor: color, marginRight: 8}}/>
          <View>
             <Text style={{fontSize: 10, color: colors.textSub, fontWeight: '600', letterSpacing: 0.2}}>{label}</Text>
             <Text style={{fontSize: 16, fontWeight: '900', color: colors.textMain, marginTop: 1}}>{count}</Text>
          </View>
      </View>
  );

  const syncBiometricAndRefresh = async () => {
    try {
        setRefreshing(true);
        const token = await AsyncStorage.getItem('userToken');
        const syncUrl = `${API_BASE}/device/attendance?_t=${Date.now()}`;
        
        await axios.get(syncUrl, { 
            headers: { 
                Authorization: `Bearer ${token}`,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Expires': '0'
            } 
        }).catch(() => {});

    } catch (error) {
       console.log('Error during biometric sync refresh', error);
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
    await initDashboard(); 
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} backgroundColor="transparent" translucent />
      <View style={{paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg}}>
         <GlobalAppBar navigation={navigation} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={syncBiometricAndRefresh} tintColor="#3B82F6" />}
      >
        <View style={styles.headerRow}>
          <View><Text style={[styles.dashboardTitle, {color: colors.textMain}]}>Dashboard</Text><Text style={styles.navDate}>{currentDate}</Text></View>
          <View style={[styles.liveClockBox, {backgroundColor: isLightMode ? '#EFF6FF' : 'rgba(59, 130, 246, 0.16)', borderColor: isLightMode ? '#DBEAFE' : 'rgba(59,130,246,0.3)'}]}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTimeText}>{liveTime}</Text>
          </View>
        </View>

        <View style={[styles.greetingBanner, { backgroundColor: isLightMode ? (isPrivileged ? '#EEF4FF' : '#ECFDF5') : 'rgba(30,58,138,0.22)', borderColor: isLightMode ? (isPrivileged ? '#DCE8FF' : '#D1FAE5') : 'rgba(59,130,246,0.25)' }]}>
          {/* decorative accent circles for a richer, premium banner feel */}
          <View pointerEvents="none" style={[styles.bannerBlobLarge, {backgroundColor: isPrivileged ? 'rgba(59,130,246,0.10)' : 'rgba(16,185,129,0.10)'}]} />
          <View pointerEvents="none" style={[styles.bannerBlobSmall, {backgroundColor: isPrivileged ? 'rgba(139,92,246,0.10)' : 'rgba(245,158,11,0.10)'}]} />

          <View style={[styles.avatarRing, {borderColor: isPrivileged ? 'rgba(59,130,246,0.35)' : 'rgba(16,185,129,0.35)'}]}>
            <View style={[styles.avatarLarge, {backgroundColor: isPrivileged ? '#2563EB' : '#059669'}]}>
              <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
            </View>
          </View>
          <View style={{marginLeft: 15, flex: 1}}>
              <Text style={[styles.helloText, {color: colors.textMain}]}>Good {getGreeting()}, {userName.split(' ')[0]} 👋</Text>
              <View style={[styles.rolePill, {backgroundColor: isPrivileged ? 'rgba(59,130,246,0.14)' : 'rgba(16,185,129,0.14)'}]}>
                <MaterialCommunityIcons name={isPrivileged ? 'shield-star' : 'account-check'} size={11} color={isPrivileged ? '#2563EB' : '#059669'} style={{marginRight: 4}} />
                <Text style={[styles.subText, {color: isPrivileged ? '#2563EB' : '#059669'}]}>{isPrivileged ? `${userRoleDisplay} Portal` : 'Employee Portal'}</Text>
              </View>
          </View>
        </View>

        {loading && !refreshing ? <ActivityIndicator size="large" color="#3B82F6" style={{marginTop: 50}} /> : (
          <>
            {isPrivileged ? (
                <View>
                    <View style={styles.statGrid}>
                        <StatCard title="Total Employees" val={adminStats.totalEmployees || 0} icon="account-group" color="#3B82F6" bg="rgba(59, 130, 246, 0.14)" />
                        <StatCard title="Present Today" val={adminStats.presentToday || 0} icon="check-decagram" color="#10B981" bg="rgba(16, 185, 129, 0.14)" subText={`${Math.max(0, (adminStats.totalEmployees || 0) - (adminStats.presentToday || 0))} Absent`} />
                        <StatCard title="Pending Leaves" val={adminStats.pendingLeaves || 0} icon="calendar-clock" color="#F59E0B" bg="rgba(245, 158, 11, 0.14)" actionLabel="VIEW ALL" onAction={() => navigation.navigate('Leaves')} />
                        <StatCard title="HR Managers" val={adminStats.totalHR || 0} icon="shield-account" color="#8B5CF6" bg="rgba(139, 92, 246, 0.14)" />
                    </View>

                    <View style={[styles.whiteSection, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                        <View style={styles.sectionHeader}>
                            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                <View style={[styles.sectionAccent, {backgroundColor: '#F59E0B'}]} />
                                <Text style={[styles.sectionTitle, {color: colors.textMain, marginBottom: 0}]}>Pending Requests</Text>
                            </View>
                        </View>
                        {pendingLeavesList.length > 0 ? pendingLeavesList.map((leave, i) => (
                            <View key={i} style={[styles.leaveActionCard, {borderColor: colors.border, backgroundColor: isLightMode ? '#FAFBFF' : 'transparent'}]}>
                                <View style={{flex: 1}}>
                                    <Text style={{fontWeight: '800', color: colors.textMain, fontSize: 14}}>{leave.employeeId?.userId?.firstName} {leave.employeeId?.userId?.lastName}</Text>
                                    <Text style={{fontSize: 11, color: colors.textSub, marginTop: 3}}>{typeof leave.leaveType === 'object' ? leave.leaveType?.name : leave.leaveType} Leave • {leave.totalDays} Day(s)</Text>
                                    <Text style={{fontSize: 10, color: colors.primary, marginTop: 5, fontWeight: '600'}}>{new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}</Text>
                                </View>
                                <View style={{flexDirection: 'row'}}>
                                    <TouchableOpacity style={[styles.actionBtn, {backgroundColor: 'rgba(16, 185, 129, 0.14)'}]} onPress={() => updateLeaveStatus(leave._id, 'approved')} activeOpacity={0.7}>
                                        <MaterialCommunityIcons name="check" size={18} color="#10B981" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.actionBtn, {backgroundColor: 'rgba(239, 68, 68, 0.14)', marginLeft: 8}]} onPress={() => updateLeaveStatus(leave._id, 'rejected')} activeOpacity={0.7}>
                                        <MaterialCommunityIcons name="close" size={18} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )) : (
                            <Text style={{color: colors.textSub, fontStyle: 'italic'}}>No pending leave requests.</Text>
                        )}
                    </View>

                    {recentEmployees.length > 0 && (
                        <View style={[styles.whiteSection, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                            <View style={styles.sectionHeader}>
                                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                    <View style={[styles.sectionAccent, {backgroundColor: '#3B82F6'}]} />
                                    <Text style={[styles.sectionTitle, {color: colors.textMain, marginBottom: 0}]}>Recent Employees</Text>
                                </View>
                                <TouchableOpacity onPress={()=>navigation.navigate('Employees')}><Text style={{color: colors.primary, fontSize: 12, fontWeight: '800'}}>View All</Text></TouchableOpacity>
                            </View>
                            <View style={{flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 9, marginBottom: 9}}>
                                <Text style={{flex: 2, fontSize: 10, color: colors.textSub, fontWeight: '800', letterSpacing: 0.3}}>EMPLOYEE</Text>
                                <Text style={{flex: 1.5, fontSize: 10, color: colors.textSub, fontWeight: '800', letterSpacing: 0.3}}>DEPARTMENT</Text>
                                <Text style={{flex: 1.5, fontSize: 10, color: colors.textSub, fontWeight: '800', letterSpacing: 0.3, textAlign: 'right'}}>DESIGNATION</Text>
                            </View>

                            {recentEmployees.map((emp, i) => (
                                <View key={i} style={[styles.empRow, {borderBottomColor: colors.border}, i === recentEmployees.length-1 && {borderBottomWidth: 0}]}>
                                    <View style={{flex: 3, flexDirection: 'row', alignItems: 'center'}}>
                                        <View style={styles.smallAvatar}><Text style={{color:'#fff', fontWeight:'800', fontSize: 12}}>{emp.userId?.firstName?.charAt(0) || 'U'}</Text></View>
                                        <View style={{marginLeft: 9, flex: 1}}>
                                            <Text style={{fontWeight:'800', color: colors.textMain, fontSize: 12}} numberOfLines={1}>{emp.userId?.firstName} {emp.userId?.lastName}</Text>
                                            <Text style={{fontSize: 10, color: colors.textSub}}>{emp.employeeId || 'N/A'}</Text>
                                        </View>
                                    </View>
                                    <View style={{flex: 1.5, justifyContent: 'center'}}>
                                        <Text style={{fontSize: 11, color: colors.textSub}} numberOfLines={2}>{emp.department || '---'}</Text>
                                    </View>
                                    <View style={{flex: 1.5, alignItems: 'flex-end', justifyContent: 'center'}}>
                                        <Text style={{fontSize: 11, color: colors.textSub, textAlign: 'right'}} numberOfLines={2}>{emp.designation || '---'}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            ) : (
                <View>
                    {!hasSelfCheckinPermission ? (
                        <View style={[styles.attendanceCard, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                           <View style={styles.cardHeaderRow}>
                               <MaterialCommunityIcons name="shield-check-outline" size={13} color="#94A3B8" style={{marginRight: 5}} />
                               <Text style={styles.cardHeader}>TODAY'S ATTENDANCE</Text>
                           </View>
                           <View style={{ flexDirection: 'row', backgroundColor: isLightMode ? '#EEF2FF' : 'rgba(99, 102, 241, 0.12)', padding: 14, borderRadius: 14, alignItems: 'center' }}>
                               <MaterialCommunityIcons name="lock-outline" size={20} color="#6366F1" style={{ marginRight: 10 }} />
                               <Text style={{ color: '#6366F1', fontSize: 13, flex: 1, fontWeight: '600' }}>
                                   Self Check-In / Check-Out permission is not available. Please contact HR/Admin for permission.
                               </Text>
                           </View>
                        </View>
                    ) : (
                    <View style={[styles.attendanceCard, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                       <View style={styles.cardHeaderRow}>
                           <MaterialCommunityIcons name="shield-check-outline" size={13} color="#94A3B8" style={{marginRight: 5}} />
                           <Text style={styles.cardHeader}>TODAY'S ATTENDANCE</Text>
                       </View>
                       <View style={[styles.statusBadge, {backgroundColor: isLightMode ? '#F8FAFC' : '#1E293B'}]}>
                          <View style={[styles.statusDot, {backgroundColor: todayRecord?.checkIn?.time ? (todayRecord.status === 'late' ? '#F59E0B' : '#10B981') : '#94A3B8'}]} />
                          <Text style={styles.statusLabel}>{todayRecord?.checkIn?.time ? (todayRecord.status || 'Present') : 'Not Checked In'}</Text>
                       </View>
                       <View style={styles.timeRow}>
                          <View style={styles.timeBox}><Text style={styles.timeLabel}>CHECK IN</Text><Text style={[styles.timeValue, {color: colors.primary}]}>{formatTime(todayRecord?.checkIn?.time)}</Text></View>
                          <View style={[styles.divider, {backgroundColor: colors.border}]} /><View style={styles.timeBox}><Text style={styles.timeLabel}>CHECK OUT</Text><Text style={[styles.timeValue, {color: colors.textMain}]}>{formatTime(todayRecord?.checkOut?.time)}</Text></View>
                          <View style={[styles.divider, {backgroundColor: colors.border}]} /><View style={styles.timeBox}><Text style={styles.timeLabel}>HOURS</Text><Text style={[styles.timeValue, {color: colors.textMain}]}>{todayRecord?.workingHours ? `${parseFloat(todayRecord.workingHours).toFixed(1)}h` : '—'}</Text></View>
                       </View>

                       {(todayRecord?.checkIn?.photoProof || todayRecord?.checkOut?.photoProof) && (
                           <TouchableOpacity
                               style={styles.photoHintRow}
                               onPress={() => navigation.navigate('Attendance')}
                               activeOpacity={0.7}
                           >
                               <Image
                                   source={{ uri: todayRecord.checkOut?.photoProof || todayRecord.checkIn?.photoProof }}
                                   style={styles.photoHintThumb}
                               />
                               <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700', flex: 1 }}>Photo proof captured — view in Attendance</Text>
                               <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primary} />
                           </TouchableOpacity>
                       )}
{canSelfCheckin ? (
  <TouchableOpacity 
    style={[
      styles.punchBtn,
      todayRecord?.checkIn?.time && !todayRecord?.checkOut?.time
        ? styles.punchBtnOut
        : styles.punchBtnIn
    ]} 
    onPress={handlePunch}
    disabled={punchLoading || checkingLocation}
    activeOpacity={0.85}
  >
    {(punchLoading || checkingLocation) ? (
      <ActivityIndicator color="#fff" />
    ) : (
      <>
        <MaterialCommunityIcons
          name={
            todayRecord?.checkIn?.time && !todayRecord?.checkOut?.time
              ? "logout"
              : "login"
          }
          size={22}
          color="#fff"
        />
        <Text style={styles.punchBtnText}>
          {todayRecord?.checkIn?.time && !todayRecord?.checkOut?.time
            ? "Check Out"
            : "Check In"}
        </Text>
      </>
    )}
  </TouchableOpacity>
) : (
  <View
    style={{
      flexDirection: 'row',
      backgroundColor: isLightMode
        ? '#EEF2FF'
        : 'rgba(99, 102, 241, 0.12)',
      padding: 14,
      borderRadius: 14,
      alignItems: 'center',
    }}
  >
    <MaterialCommunityIcons
      name="information"
      size={20}
      color="#6366F1"
      style={{ marginRight: 10 }}
    />

    <Text
      style={{
        color: '#6366F1',
        fontSize: 13,
        flex: 1,
        fontWeight: '600',
      }}
    >
      Self check-in/out is not enabled. Please contact HR/Admin.
    </Text>
  </View>
)}
                       {checkingLocation && (
                           <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10}}>
                               <MaterialCommunityIcons name="crosshairs-gps" size={13} color={colors.textSub} style={{marginRight: 5}} />
                               <Text style={{ color: colors.textSub, fontSize: 11, fontWeight: '600' }}>Checking your location...</Text>
                           </View>
                       )}
                    </View>
                    )}
                </View>
            )}

            {/* 🔒 Employees only — admins/HR manage attendance org-wide, not a personal monthly view */}
            {!isPrivileged && permissions.some(p => p.includes('ATTENDANCE:SELF')) && (
                <View style={{marginBottom: 25}}>
                    <Text style={[styles.sectionTitle, {color: colors.textMain}]}>📊 My Monthly Attendance</Text>
                    <View style={[styles.whiteSection, {backgroundColor: colors.cardBg, borderColor: colors.border, padding: 20}]}>
                       
                       <View style={{flexDirection: 'row', height: 26, borderRadius: 13, overflow: 'hidden', marginBottom: 25, backgroundColor: colors.border}}>
                           {monthlyStats.present > 0 && <View style={{flex: monthlyStats.present, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center'}}><Text style={styles.graphCountText}>{monthlyStats.present}</Text></View>}
                           {monthlyStats.late > 0 && <View style={{flex: monthlyStats.late, backgroundColor: '#F59E0B', justifyContent: 'center', alignItems: 'center'}}><Text style={styles.graphCountText}>{monthlyStats.late}</Text></View>}
                           {monthlyStats.halfDay > 0 && <View style={{flex: monthlyStats.halfDay, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center'}}><Text style={styles.graphCountText}>{monthlyStats.halfDay}</Text></View>}
                           {monthlyStats.wfh > 0 && <View style={{flex: monthlyStats.wfh, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center'}}><Text style={styles.graphCountText}>{monthlyStats.wfh}</Text></View>}
                           {monthlyStats.absent > 0 && <View style={{flex: monthlyStats.absent, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center'}}><Text style={styles.graphCountText}>{monthlyStats.absent}</Text></View>}
                       </View>

                       <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start'}}>
                           <LegendItem color="#10B981" label="Present" count={monthlyStats.present} />
                           <LegendItem color="#F59E0B" label="Late" count={monthlyStats.late} />
                           <LegendItem color="#3B82F6" label="Half Day" count={monthlyStats.halfDay} />
                           <LegendItem color="#8B5CF6" label="WFH" count={monthlyStats.wfh} />
                           <LegendItem color="#EF4444" label="Absent" count={monthlyStats.absent} />
                       </View>
                    </View>
                </View>
            )}

            <Text style={[styles.sectionTitle, {color: colors.textMain}]}>⚡ Quick Links</Text>
            <View style={styles.linkGrid}>
                {QUICK_LINKS.filter(l => hasPerm(l.perm)).map((link, i) => (
                    <TouchableOpacity key={i} style={[styles.compactLinkItem, {backgroundColor: colors.cardBg, borderColor: colors.border, shadowColor: link.color}]} onPress={() => navigation.navigate(link.route)} activeOpacity={0.75}>
                        <View style={[styles.linkIconBox, {backgroundColor: link.color + '18'}]}><MaterialCommunityIcons name={link.icon} size={23} color={link.color} /></View>
                        <Text style={[styles.linkLabel, {color: colors.textMain}]} numberOfLines={1}>{link.label}</Text>
                    </TouchableOpacity>
                ))}
                {QUICK_LINKS.filter(l => hasPerm(l.perm)).length === 0 && (
                    <Text style={{color: colors.textSub, fontStyle: 'italic', paddingLeft: 5}}>No modules assigned.</Text>
                )}
            </View>

            {((recentActivities || []).length > 0) && (
                <View style={{marginBottom: 25}}>
                    <Text style={[styles.sectionTitle, {color: colors.textMain}]}>⏳ Recent Activity</Text>
                    <View style={[styles.timelineContainer, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                        {(Array.isArray(recentActivities) ? recentActivities : []).map((act, i) => (
                            <View key={i} style={styles.timelineItem}>
                                {i !== recentActivities.length - 1 && <View style={[styles.timelineLine, {backgroundColor: colors.border}]} />}
                                <View style={[styles.timelineDot, {backgroundColor: act.color}]}><MaterialCommunityIcons name={act.icon} size={12} color="#fff" /></View>
                                <View style={styles.timelineContent}>
                                    <Text style={[styles.timelineTitle, {color: colors.textMain}]}>{act.title}</Text>
                                    <Text style={[styles.timelineDesc, {color: colors.textSub}]} numberOfLines={1}>{act.desc}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {hasPerm('ANNOUNCEMENT') && (
              <View style={{marginBottom: 20}}>
                <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, {color: colors.textMain, marginBottom: 0}]}>📢 Announcements</Text></View>
                {announcements.length > 0 ? announcements.map((ann, i) => (
                    <View key={i} style={[styles.annCard, {backgroundColor: colors.cardBg, borderColor: colors.border, borderLeftColor: ann.priority === 'urgent' ? '#EF4444' : '#3B82F6'}]}>
                        <Text style={[styles.annTitle, {color: colors.textMain}]}>{ann.title}</Text>
                        <Text style={[styles.annDesc, {color: colors.textSub}]}>{ann.description}</Text>
                    </View>
                )) : <Text style={{color: colors.textSub, fontStyle: 'italic'}}>No current announcements.</Text>}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {isFabOpen && (
          <TouchableOpacity style={[StyleSheet.absoluteFillObject, {backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10}]} activeOpacity={1} onPress={() => setIsFabOpen(false)}>
              <View style={styles.fabMenuContainer}>
                 {hasPerm('LEAVES') && (
                     <TouchableOpacity style={styles.fabMenuItem} onPress={() => {setIsFabOpen(false); navigation.navigate('Leaves');}}>
                         <Text style={styles.fabMenuText}>Add Leave</Text>
                         <View style={[styles.fabMenuIcon, {backgroundColor: '#3B82F6'}]}><MaterialCommunityIcons name="calendar-plus" size={20} color="#fff" /></View>
                     </TouchableOpacity>
                 )}
                 {hasPerm('LEADS') && (
                     <TouchableOpacity style={styles.fabMenuItem} onPress={() => {setIsFabOpen(false); navigation.navigate('Leads');}}>
                         <Text style={styles.fabMenuText}>Add Lead</Text>
                         <View style={[styles.fabMenuIcon, {backgroundColor: '#8B5CF6'}]}><MaterialCommunityIcons name="account-multiple-plus" size={20} color="#fff" /></View>
                     </TouchableOpacity>
                 )}
              </View>
          </TouchableOpacity>
      )}

      {pendingLocation && (
          <GeoTagAttendanceCamera
              visible={showGeoCam}
              onClose={() => { setShowGeoCam(false); setPendingLocation(null); }}
              onCapture={handlePhotoCaptured}
              latitude={pendingLocation.latitude}
              longitude={pendingLocation.longitude}
              address={pendingAddress}
              accuracy={pendingAccuracy}
              distanceFromAllowed={pendingDistance}
              allowedLocationName={pendingLocationName}
              locationBased={!!attSettings?.locationEnabled}
          />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 }, 
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  dashboardTitle: { fontSize: 25, fontWeight: '900', letterSpacing: -0.5 },
  navDate: { fontSize: 12, color: '#64748B', marginLeft: 2, marginTop: 3, fontWeight: '500' },
  liveClockBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, borderWidth: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6', marginRight: 6 },
  liveTimeText: { fontSize: 13, fontWeight: '800', color: '#3B82F6', letterSpacing: 0.3 },

  greetingBanner: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 24, marginBottom: 25, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  bannerBlobLarge: { position: 'absolute', width: 140, height: 140, borderRadius: 70, top: -60, right: -40 },
  bannerBlobSmall: { position: 'absolute', width: 80, height: 80, borderRadius: 40, bottom: -30, right: 60 },
  avatarRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  avatarLarge: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.25, shadowRadius: 6 },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 20 },
  helloText: { fontSize: 16, fontWeight: '800', marginBottom: 7 },
  rolePill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  subText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  kpiCard: { width: '48%', borderWidth: 1, borderLeftWidth: 4, padding: 16, borderRadius: 20, marginBottom: 14, elevation: 3, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.14, shadowRadius: 10 },
  kpiIcon: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  kpiActionBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, elevation: 2, shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.3, shadowRadius: 4 },
  kpiActionText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },
  kpiVal: { fontSize: 25, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 },
  kpiSubText: { fontSize: 10, color: '#EF4444', fontWeight: '800', marginTop: 2, marginBottom: 2 },
  kpiLabel: { fontSize: 11, color: '#64748B', fontWeight: '700', marginTop: 4 },
  
  attendanceCard: { padding: 22, borderRadius: 26, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.06, shadowRadius: 10, marginBottom: 25, borderWidth: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  cardHeader: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 22 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  statusLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'capitalize', letterSpacing: 0.2 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 22 },
  timeBox: { alignItems: 'center' },
  timeLabel: { fontSize: 9, color: '#94A3B8', fontWeight: '800', letterSpacing: 0.5 },
  timeValue: { fontSize: 17, fontWeight: '900', marginTop: 5 },
  divider: { width: 1, height: 32 },

  photoHintRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, backgroundColor: 'rgba(59,130,246,0.06)', padding: 10, borderRadius: 12 },
  photoHintThumb: { width: 36, height: 36, borderRadius: 10, marginRight: 10 },

  punchBtn: { padding: 17, borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  punchBtnIn: { backgroundColor: '#3B82F6', shadowColor: '#3B82F6', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.35, shadowRadius: 8 },
  punchBtnOut: { backgroundColor: '#EF4444', shadowColor: '#EF4444', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.35, shadowRadius: 8 },
  punchBtnText: { color: '#fff', fontWeight: '800', marginLeft: 10, fontSize: 16, letterSpacing: 0.2 },
  
  whiteSection: { padding: 20, borderRadius: 24, marginBottom: 25, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.06, shadowRadius: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginBottom: 15, letterSpacing: -0.2 },
  sectionAccent: { width: 4, height: 16, borderRadius: 2, marginRight: 8 },
  
  leaveActionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderWidth: 1, borderRadius: 15, marginBottom: 10 },
  actionBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },

  empRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1 },
  smallAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  
  linkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  compactLinkItem: { width: '22.5%', alignItems: 'center', marginBottom: 5, padding: 9, borderRadius: 18, borderWidth: 1, elevation: 2, shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.12, shadowRadius: 6 },
  linkIconBox: { width: 52, height: 52, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginBottom: 7 },
  linkLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  
  annCard: { padding: 16, borderRadius: 16, borderLeftWidth: 5, borderWidth: 1, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.04, shadowRadius: 4 },
  annTitle: { fontWeight: '800', fontSize: 15, marginBottom: 5 },
  annDesc: { fontSize: 13, lineHeight: 20 },

  timelineContainer: { padding: 20, borderRadius: 24, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.06, shadowRadius: 8 },
  timelineItem: { flexDirection: 'row', marginBottom: 15, position: 'relative' },
  timelineLine: { position: 'absolute', left: 11, top: 25, bottom: -20, width: 2 },
  timelineDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  timelineContent: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  timelineTitle: { fontSize: 13, fontWeight: '800' },
  timelineDesc: { fontSize: 11, marginTop: 2 },

  fabMain: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, zIndex: 11 },
  fabMenuContainer: { position: 'absolute', bottom: 100, right: 25, alignItems: 'flex-end' },
  fabMenuItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  fabMenuText: { color: '#fff', fontSize: 14, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 10, overflow: 'hidden' },
  fabMenuIcon: { width: 44, height: 43, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 3 },

  graphCountText: { color: '#fff', fontSize: 11, fontWeight: '800' }
});