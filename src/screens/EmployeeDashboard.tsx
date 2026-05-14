import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import axios from 'axios'; 
import { useTheme } from '../constants/theme'; 
import GlobalAppBar from '../components/GlobalAppBar';
// 🚀 FIXED: Centralized API Base Import
import { API_BASE } from '../api/api'; 

const { width } = Dimensions.get("window");

const LEAVE_LIMITS = {
  casual: 12,
  sick: 8, 
  earned: 15
};

export default function EmployeeDashboard({ navigation }: any) {
  const { colors, isLightMode, toggleTheme } = useTheme(); 
  const styles = getDynamicStyles(colors, isLightMode);

  const [currentDate, setCurrentDate] = useState("");
  const [liveTime, setLiveTime] = useState("");
  const [searchQuery, setSearchQuery] = useState(''); 
  
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isDayComplete, setIsDayComplete] = useState(false);
  const [isLateCheckIn, setIsLateCheckIn] = useState(false); 
  const [checkInTime, setCheckInTime] = useState("—");
  const [checkOutTime, setCheckOutTime] = useState("—");
  const [workingHours, setWorkingHours] = useState("—");
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); 
  const [actionLoading, setActionLoading] = useState(false); 
  const [leavesList, setLeavesList] = useState<any[]>([]); 
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [userName, setUserName] = useState("Employee");
  
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const today = new Date();
    setCurrentDate(today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

    const timer = setInterval(() => {
      setLiveTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    }, 1000);

    fetchDashboardData();
    
    const autoUpdateInterval = setInterval(() => {
      fetchDashboardData(true);
    }, 25000);

    return () => {
        clearInterval(timer);
        clearInterval(autoUpdateInterval);
    };
  }, []);

  const formatTime = (isoString: string) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const fetchDashboardData = async (isSilent = false) => {
    try {
      if (!isSilent && leavesList.length === 0) setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const employeeId = await AsyncStorage.getItem('employeeId'); 
      const savedName = await AsyncStorage.getItem('userName');

      if (savedName && savedName !== "User") setUserName(savedName);
      if (!token || !employeeId) return;

      const config = { 
        headers: { 
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cookie': `hrms_token=${token}`    
        } 
      };

      // 🚀 FIXED: Using Global API_BASE
      const results = await Promise.allSettled([
        axios.get(`${API_BASE}/leaves?employeeId=${employeeId}&limit=500`, config), 
        axios.get(`${API_BASE}/attendance?employeeId=${employeeId}`, config),
        axios.get(`${API_BASE}/announcements?limit=30`, config) 
      ]);

      if (results[0].status === 'fulfilled') {
          const resData = results[0].value.data;
          let extractedLeaves = [];
          if (Array.isArray(resData?.data?.data)) extractedLeaves = resData.data.data;
          else if (Array.isArray(resData?.data)) extractedLeaves = resData.data;
          else if (Array.isArray(resData)) extractedLeaves = resData;
          setLeavesList(extractedLeaves); 
      }

      if (results[1].status === 'fulfilled') {
        const attData = results[1].value.data?.data;
        let todayRecord = null;

        if (Array.isArray(attData) && attData.length > 0) {
            const todayDateStr = new Date().toDateString(); 
            todayRecord = attData.find((record: any) => {
               if (!record) return false;
               const recordDateStr = new Date(record.date || record.checkIn?.time).toDateString();
               return recordDateStr === todayDateStr;
            });

            let validRecords = attData.filter((r: any) => r && (r.date || r.checkIn?.time));
            validRecords.sort((a: any, b: any) => {
               return new Date(a.date || a.checkIn?.time).getTime() - new Date(b.date || b.checkIn?.time).getTime();
            });

            const recentData = validRecords.slice(-7);
            const mappedChart = recentData.map((record: any) => {
                 const d = new Date(record.date || record.checkIn?.time);
                 const label = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
                 let hw = parseFloat(record.workingHours);
                 if (isNaN(hw)) hw = 0;
                 return { label, hours: hw };
            });
            setChartData(mappedChart);

        } else if (attData && typeof attData === 'object' && !Array.isArray(attData)) {
            todayRecord = attData; 
        }

        if (todayRecord) {
            const inTime = todayRecord.checkIn?.time;
            const outTime = todayRecord.checkOut?.time;

            const isRealCheckOut = outTime && inTime !== outTime;

            if (inTime) {
              setCheckInTime(formatTime(inTime));
              setIsCheckedIn(true); 
              
              const statusStr = String(todayRecord.status || todayRecord.checkIn?.status || "").toLowerCase();
              let isLate = statusStr.includes('late');
              
              if (!isLate) {
                  const checkInObj = new Date(inTime);
                  if (checkInObj.getHours() > 10 || (checkInObj.getHours() === 10 && checkInObj.getMinutes() > 15)) {
                      isLate = true;
                  }
              }
              setIsLateCheckIn(isLate);
            }

            if (isRealCheckOut) {
              setCheckOutTime(formatTime(outTime));
              setIsDayComplete(true); 
              if (todayRecord.workingHours !== undefined) {
                setWorkingHours(parseFloat(todayRecord.workingHours).toFixed(1) + "h");
              }
            } else {
              setCheckOutTime("—");
              setIsDayComplete(false);
              setWorkingHours("—");
            }
        } else {
            setCheckInTime("—");
            setCheckOutTime("—");
            setWorkingHours("—");
            setIsCheckedIn(false);
            setIsDayComplete(false);
            setIsLateCheckIn(false);
        }
      }

      if (results[2].status === 'fulfilled') {
          const fetchedAnns = results[2].value.data?.data || [];
          const sortedAnns = fetchedAnns.sort((a: any, b: any) => {
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          setAnnouncements(sortedAnns);
      }

    } catch (error: any) {
      console.error("Dashboard Fetch Error", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        // 🚀 FIXED: Using Global API_BASE
        await axios.get(`${API_BASE}/device/attendance`, { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          } 
        });
      }
    } catch (error) {
      console.log("Bio Sync on Refresh failed (Running Silently):", error);
    }
    fetchDashboardData(true);
  };

  const handleAttendance = async () => {
    try {
      setActionLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const employeeId = await AsyncStorage.getItem('employeeId'); 
      
      const config = { 
        headers: { 
          'Accept': 'application/json', 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cookie': `hrms_token=${token}` 
        },
        withCredentials: true 
      };

      if (!isCheckedIn) {
        // 🚀 FIXED: Using Global API_BASE
        const response = await axios.post(`${API_BASE}/checkin`, { employeeId }, config);
        if (response.data.success || response.status === 201) {
            Alert.alert("Success", "Punched In Successfully!");
            fetchDashboardData(); 
        }
      } else {
        // 🚀 FIXED: Using Global API_BASE
        const response = await axios.post(`${API_BASE}/checkout`, { employeeId }, config);
        if (response.data.success || response.status === 200) {
            Alert.alert("Success", "Punched Out Successfully!");
            fetchDashboardData(); 
        }
      }
    } catch (error: any) {
      Alert.alert("Not Allowed", error.response?.data?.message || "“ Punch-in/out allowed only via biometric machine ”");
    } finally {
      setActionLoading(false);
    }
  };

  const displayUserName = userName;
  const firstNameOnly = displayUserName ? displayUserName.split(" ")[0] : "Employee";

  const calculateLeaveUsage = (type: string) => {
    let totalUsed = 0;
    (leavesList || []).forEach((item: any) => {
      const status = (item.status || 'pending').toLowerCase().trim();
      const leaveType = (item.leaveType || item.type || 'casual').toLowerCase().trim();
      
      if (status === 'approved' && leaveType.includes(type.toLowerCase())) {
        const rawFrom = item.fromDate || item.startDate;
        const rawTo = item.toDate || item.endDate;
        
        let days = Number(item.totalDays || item.NumberofDays || item.numberOfDays || item.days);
        if (!days && rawFrom && rawTo) {
            const d1 = new Date(rawFrom);
            const d2 = new Date(rawTo);
            if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
                days = Math.round(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 3600 * 24)) + 1;
            } else { days = 0; }
        }
        totalUsed += days;
      }
    });
    return totalUsed;
  };

  const casualUsed = calculateLeaveUsage('casual');
  const sickUsed = calculateLeaveUsage('sick');
  const earnedUsed = calculateLeaveUsage('earned');

  const casualLeft = Math.max(0, LEAVE_LIMITS.casual - casualUsed);
  const sickLeft = Math.max(0, LEAVE_LIMITS.sick - sickUsed);
  const earnedLeft = Math.max(0, LEAVE_LIMITS.earned - earnedUsed);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Morning";
    if (hour < 17) return "Afternoon";
    if (hour < 21) return "Evening";
    return "Night";
  };

  const getUserInitials = (name: string) => {
    if (!name || name === "Employee") return "US";
    const parts = name.trim().split(" ");
    return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  const filteredAnnouncements = announcements.filter(ann => 
    searchQuery === '' || 
    (ann.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (ann.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allQuickLinks = [
    { icon: "fingerprint", label: "Attendance", color: "#10B981", route: "Attendance" },
    { icon: "calendar-plus", label: "Apply Leave", color: "#3B82F6", route: "Leaves" },
    { icon: "file-document-outline", label: "Payslips", color: "#8B5CF6", route: "Payslips" },
    { icon: "star", label: "Performance", color: "#F59E0B", route: "Performance" },
    { icon: "account-circle", label: "My Profile", color: "#EC4899", route: "Settings" },
    { icon: "folder", label: "Documents", color: "#14B8A6", route: "Documents" }
  ];

  const filteredQuickLinks = allQuickLinks.filter(link => 
    searchQuery === '' || link.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && !refreshing && leavesList.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} backgroundColor="transparent" translucent={true} />
      
      <GlobalAppBar 
        navigation={navigation} 
        showSearch={true} 
        searchQuery={searchQuery} 
        onSearchChange={setSearchQuery} 
      />

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        
        {!searchQuery && (
          <>
            <View style={styles.headerRow}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                   <MaterialCommunityIcons name="view-dashboard" size={24} color={colors.primary} style={{ marginRight: 8 }} />
                   <Text style={styles.dashboardTitle}>Dashboard</Text>
                </View>
                <Text style={styles.navDate}>{currentDate}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                 <View style={styles.liveClockBox}>
                    <Text style={styles.liveTimeText}>{liveTime}</Text>
                 </View>
                 
                 <TouchableOpacity 
                   style={styles.manualRefreshBtn} 
                   onPress={onRefresh} 
                   disabled={refreshing}
                 >
                    <MaterialCommunityIcons name={refreshing ? "loading" : "refresh"} size={14} color={colors.primary} />
                    <Text style={[styles.manualRefreshText, {color: colors.primary}]}>
                      {refreshing ? "Refreshing..." : "Refresh"}
                    </Text>
                 </TouchableOpacity>
              </View>
            </View>

            <View style={styles.greetingBanner}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarText}>{getUserInitials(displayUserName)}</Text>
              </View>
              <View style={styles.greetingInfo}>
                 <Text style={styles.helloText}>
                 Good {getGreeting()}, {firstNameOnly}! 👋
                 </Text>
                 <Text style={styles.subText}>Active Session • {currentDate}</Text>
              </View>
            </View>

            <View style={styles.card}>
               <Text style={styles.cardHeader}>💎 TODAY'S ATTENDANCE</Text>
               
               <View style={[
                   styles.statusBadge, 
                   isDayComplete ? { backgroundColor: isLightMode ? '#F3E8FF' : '#4C1D95' } 
                   : (isCheckedIn && isLateCheckIn) ? { backgroundColor: isLightMode ? '#FEF3C7' : '#78350F' }
                   : null
               ]}>
                  <View style={[
                      styles.statusDot, 
                      {backgroundColor: isDayComplete ? '#A855F7' : (isCheckedIn ? (isLateCheckIn ? '#F59E0B' : '#10B981') : colors.textSub)}
                  ]} />
                  <Text style={[
                      styles.statusLabel, 
                      isDayComplete ? { color: isLightMode ? '#A855F7' : '#C084FC' }
                      : (isCheckedIn && isLateCheckIn) ? { color: '#F59E0B' }
                      : null
                  ]}>
                     {isDayComplete ? 'Checked Out' : isCheckedIn ? (isLateCheckIn ? 'Checked In (Late)' : 'Present') : 'Not Checked In'}
                  </Text>
               </View>

               <View style={styles.timeRow}>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeLabel}>CHECK IN</Text>
                    <Text style={[styles.timeValue, { color: checkInTime !== "—" ? colors.primary : colors.textMain }]}>{checkInTime}</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.timeBox}>
                    <Text style={styles.timeLabel}>CHECK OUT</Text>
                    <Text style={[styles.timeValue, isDayComplete && { color: colors.textMain }]}>{checkOutTime}</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.timeBox}>
                    <Text style={styles.timeLabel}>HOURS</Text>
                    <Text style={[styles.timeValue, isDayComplete && { color: colors.textMain }]}>{workingHours}</Text>
                  </View>
               </View>
               {isDayComplete ? (
                  <View style={styles.dayCompleteContainer}>
                    <MaterialCommunityIcons name="check-circle" size={24} color="#10B981" />
                    <Text style={styles.dayCompleteText}>Day complete! See you tomorrow.</Text>
                  </View>
               ) : (
                 <TouchableOpacity 
                    style={[styles.actionBtn, isCheckedIn ? styles.checkOutBtn : styles.checkInBtn]} 
                    onPress={handleAttendance}
                    disabled={actionLoading}
                 >
                    {actionLoading ? <ActivityIndicator color="#FFF" /> : (
                      <>
                        <MaterialCommunityIcons name={isCheckedIn ? "logout" : "login"} size={22} color="#FFF" />
                        <Text style={styles.actionBtnText}>{isCheckedIn ? "Check Out" : "Check In"}</Text>
                      </>
                    )}
                 </TouchableOpacity>
               )}
            </View>

            <View style={styles.sectionHeader}>
               <Text style={styles.sectionTitle}>🌴 Leave Balance</Text>
               <TouchableOpacity onPress={() => navigation.navigate('Leaves')}><Text style={styles.viewAllLink}>Apply leave →</Text></TouchableOpacity>
            </View>
            
            <View style={styles.leaveGridContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leaveGrid}>
                <LeaveCard type="Casual" used={casualUsed} left={casualLeft} color="#3B82F6" icon="palm-tree" colors={colors} styles={styles} />
                <LeaveCard type="Sick" used={sickUsed} left={sickLeft} color="#EF4444" icon="emoticon-sick-outline" colors={colors} styles={styles} />
                <LeaveCard type="Earned" used={earnedUsed} left={earnedLeft} color="#10B981" icon="check-decagram-outline" colors={colors} styles={styles} />
              </ScrollView>
            </View>
          </>
        )}

        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📢 Announcements</Text>
        </View>
        <ScrollView style={[styles.announcementList, { maxHeight: 400 }]} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
            {filteredAnnouncements.length > 0 ? (
              filteredAnnouncements.map((ann, idx) => (
                <AnnouncementItem 
                  key={idx} 
                  ann={ann} 
                  colors={colors} 
                  styles={styles} 
                />
              ))
            ) : (
              <Text style={{color: colors.textSub, textAlign: 'center', marginTop: 10, marginBottom: 20}}>No announcements found.</Text>
            )}
        </ScrollView>

        <View style={[styles.sectionHeader, {marginTop: 10}]}>
            <Text style={styles.sectionTitle}>⚡ Quick Links</Text>
        </View>
        <View style={styles.quickLinksGrid}>
            {filteredQuickLinks.map((link, idx) => (
              <QuickLink key={idx} icon={link.icon} label={link.label} color={link.color} onPress={() => navigation.navigate(link.route)} colors={colors} styles={styles} />
            ))}
            {filteredQuickLinks.length === 0 && (
              <Text style={{color: colors.textSub, textAlign: 'center', width: '100%', marginTop: 10}}>No links found.</Text>
            )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const LeaveCard = ({ type, used, left, color, icon, colors, styles }: any) => (
  <View style={[styles.leaveCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
    <View style={styles.leaveTopRow}>
      <View style={[styles.iconBg, {backgroundColor: color + '15'}]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.leaveType, {color: colors.textMain}]}>{type}</Text>
    </View>
    <View style={styles.leaveBottomRow}>
      <Text style={styles.leaveUsedText}>Used: {used}</Text>
      <Text style={[styles.leaveLeftText, { color }]}>{left} left</Text>
    </View>
  </View>
);

const QuickLink = ({ icon, label, color, onPress, colors, styles }: any) => (
  <TouchableOpacity style={[styles.quickLinkItem, {backgroundColor: colors.cardBg, borderColor: colors.border}]} onPress={onPress}>
    <View style={[styles.quickIconCircle, {backgroundColor: color + '15'}]}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />
    </View>
    <Text style={[styles.quickLinkLabel, {color: colors.textMain}]}>{label}</Text>
  </TouchableOpacity>
);

const AnnouncementItem = ({ ann, colors, styles}: any) => {
    const isGeneral = ann.type?.toLowerCase() === 'general';
    const isHoliday = ann.type?.toLowerCase() === 'holiday';
    const tagBg = isGeneral ? '#dbeafe' : (isHoliday ? '#dcfce7' : '#fef3c7');
    const tagColor = isGeneral ? '#2563eb' : (isHoliday ? '#16a34a' : '#d97706');

    const p = (ann.priority || '').toLowerCase();
    let prioBg = '#f1f5f9';
    let prioColor = '#64748b';
    if (p === 'high' || p === 'urgent') { prioBg = '#fef2f2'; prioColor = '#dc2626'; }
    else if (p === 'medium') { prioBg = '#fff7ed'; prioColor = '#ea580c'; }

    const displayDate = ann.createdAt ? new Date(ann.createdAt).toLocaleDateString('en-GB') : "Recent"; 

    return (
      <View style={[styles.announcementCard, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap'}}>
              {ann.isPinned && (
                  <View style={{backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 6, marginBottom: 4, flexDirection: 'row', alignItems: 'center'}}>
                      <Feather name="paperclip" size={10} color="#d97706" style={{marginRight: 3}} />
                      <Text style={{color: '#d97706', fontSize: 10, fontWeight: 'bold'}}>PINNED</Text>
                  </View>
              )}
              <View style={{backgroundColor: tagBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginRight: 6, marginBottom: 4}}>
                  <Text style={{color: tagColor, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase'}}>{ann.type || 'GENERAL'}</Text>
              </View>
              {ann.priority && (
                  <View style={{backgroundColor: prioBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginBottom: 4}}>
                      <Text style={{color: prioColor, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase'}}>{ann.priority}</Text>
                  </View>
              )}
          </View>
          <Text style={[styles.annTitle, {color: colors.textMain}]}>{ann.title}</Text>
          <Text style={[styles.annDesc, {color: colors.textSub}]}>{ann.description}</Text>
          <Text style={styles.annDate}>{displayDate}</Text>
      </View>
    );
};

const getDynamicStyles = (colors: any, isLight: boolean) => StyleSheet.create({
  container: { 
      flex: 1, 
      backgroundColor: colors.background,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 
  },
  scrollContent: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  dashboardTitle: { fontSize: 24, fontWeight: '900', color: colors.textMain },
  navDate: { fontSize: 13, color: colors.textSub, marginTop: 2, marginLeft: 32 },
  liveClockBox: { alignItems: 'flex-end', backgroundColor: colors.primary + '20', padding: 8, borderRadius: 12 },
  liveTimeText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  greetingBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: isLight ? '#E0F2F1' : '#064E3B20', padding: 16, borderRadius: 16, marginBottom: 25, borderWidth: 1, borderColor: isLight ? '#B2DFDB' : '#065F46' },
  avatarLarge: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#B2DFDB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '800', color: '#00695C' },
  greetingInfo: { marginLeft: 12 },
  helloText: { fontSize: 16, fontWeight: '800', color: colors.textMain },
  subText: { fontSize: 11, color: isLight ? '#00796B' : '#34D399' },
  card: { backgroundColor: colors.cardBg, borderRadius: 20, padding: 20, marginBottom: 25, elevation: 3, borderWidth: 1, borderColor: colors.border },
  cardHeader: { fontSize: 11, fontWeight: "900", color: colors.textSub, textAlign: 'center', letterSpacing: 1, marginBottom: 12 },
  statusBadge: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: isLight ? '#F8FAFC' : '#1E293B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusLabel: { fontSize: 11, fontWeight: '700', color: colors.textSub },
  timeRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
  timeBox: { alignItems: 'center' },
  divider: { width: 1, height: 35, backgroundColor: colors.border },
  timeLabel: { fontSize: 10, color: colors.textSub, marginBottom: 6, fontWeight: '700' },
  timeValue: { fontSize: 18, fontWeight: "800", color: colors.textMain },
  actionBtn: { width: '100%', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  checkInBtn: { backgroundColor: colors.primary },
  checkOutBtn: { backgroundColor: "#EF4444" },
  actionBtnText: { color: "#FFF", fontWeight: "800", marginLeft: 8, fontSize: 16 },
  dayCompleteContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  dayCompleteText: { marginLeft: 8, fontSize: 14, color: colors.textSub, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textMain },
  viewAllLink: { fontSize: 12, fontWeight: '700', color: colors.primary },
  leaveGridContainer: { marginBottom: 25 },
  leaveGrid: { flexDirection: 'row', paddingRight: 10 },
  leaveCard: { width: (width - 48) / 2.2, padding: 16, borderRadius: 16, borderWidth: 1, justifyContent: 'space-between', marginRight: 12 },
  leaveTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  iconBg: { padding: 6, borderRadius: 8, marginRight: 8 },
  leaveType: { fontSize: 12, fontWeight: '700' },
  leaveBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  leaveUsedText: { fontSize: 10, color: colors.textSub },
  leaveLeftText: { fontSize: 15, fontWeight: "900" },
  announcementCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  annTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  annDesc: { fontSize: 13, marginBottom: 8, lineHeight: 18 },
  annDate: { fontSize: 11, color: '#94a3b8' },
  quickLinksGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickLinkItem: { width: '48%', padding: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1 },
  quickIconCircle: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  quickLinkLabel: { marginLeft: 10, fontSize: 12, fontWeight: '700' },
  manualRefreshBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.primary + '15' },
  manualRefreshText: { fontSize: 11, fontWeight: '700', marginLeft: 4 },
});