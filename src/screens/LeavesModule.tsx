import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  TouchableOpacity, SafeAreaView, Alert, Platform, Image, StatusBar, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Dimensions
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme'; 
import GlobalAppBar from '../components/GlobalAppBar'; 
import {showLocalNotification} from '../services/notificationService';
import { API_BASE } from '../api/api';

const { width } = Dimensions.get("window");

const TABS = ['All', 'Pending', 'Approved', 'Rejected'];
const LEAVE_LIMITS = { casual: 12, sick: 8, earned: 15 };
const LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Unpaid Leave'];

export default function LeavesModule({ navigation }: any) {
  const { colors, isLightMode } = useTheme();
  const styles = getDynamicStyles(colors, isLightMode); 
  
  // --- CORE STATES ---
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [myEmpId, setMyEmpId] = useState<string>('');

  const [allLeaves, setAllLeaves] = useState<any[]>([]); 
  const [myLeaves, setMyLeaves] = useState<any[]>([]); 
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]); 
  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<string>('All'); 
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [isApplyModalVisible, setIsApplyModalVisible] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to' | null>(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const [leaveForm, setLeaveForm] = useState({ 
    employeeId: '', employeeName: 'Select Employee', type: 'Casual Leave', fromDate: '', toDate: '', reason: '', isHalfDay: false, duration: 0
  });
  const [formErrors, setFormErrors] = useState({ toDate: '', reason: '' });
  const [showFormEmp, setShowFormEmp] = useState(false);

  const hasPerm = (action: string) => {
      return permissions.some(p => p.trim().toUpperCase() === `LEAVES:${action.toUpperCase()}`);
  };

  const canViewAll = hasPerm('VIEW');
  const canCreateForOthers = hasPerm('CREATE');
  const canApplySelf = hasPerm('SELF');
  
  const canApply = canCreateForOthers || canApplySelf;
  const canActionLeaves = hasPerm('VIEW') || hasPerm('UPDATE');

  useFocusEffect(useCallback(() => {
    initScreen();
  }, []));

  const fetchEmployees = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(`${API_BASE}/employees?limit=500`, { headers: { Authorization: `Bearer ${token}` } });
      let empData = [];
      if (Array.isArray(res.data?.data?.data)) empData = res.data.data.data;
      else if (Array.isArray(res.data?.data)) empData = res.data.data;
      setAllEmployees(empData.filter((e:any) => !e.isDeleted));
    } catch (e) {}
  };

  const initScreen = async () => {
    const permsStr = await AsyncStorage.getItem('userPermissions');
    const empId = await AsyncStorage.getItem('employeeId');
    const pArray = permsStr ? JSON.parse(permsStr) : [];
    
    setPermissions(pArray);
    if(empId) setMyEmpId(empId);
    
    if (pArray.some((p: string) => p.trim().toUpperCase() === 'LEAVES:CREATE') || pArray.some((p: string) => p.trim().toUpperCase() === 'LEAVES:VIEW')) {
        fetchEmployees();
    }
    
    fetchData(false, pArray, empId);
  };

  const fetchData = async (isRefresh = false, currentPerms = permissions, empId = myEmpId) => {
    try {
      if(!isRefresh) setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const userCanViewAll = currentPerms.some((p: string) => p.trim().toUpperCase() === 'LEAVES:VIEW');

      if (userCanViewAll) {
          const res = await axios.get(`${API_BASE}/leaves?limit=1000`, config);
          let data = Array.isArray(res.data?.data?.data) ? res.data.data.data : (Array.isArray(res.data?.data) ? res.data.data : []);
          setAllLeaves(data);
      } else {
          const res = await axios.get(`${API_BASE}/leaves?employeeId=${empId}&limit=200`, config);
          let data = Array.isArray(res.data?.data?.data) ? res.data.data.data : (Array.isArray(res.data?.data) ? res.data.data : []);
          setMyLeaves(data);
          calculateBalances(data);
      }
    } catch (err) {
      console.log("Failed to load leaves");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateBalances = (history: any[]) => {
      let cUsed = 0, sUsed = 0, eUsed = 0;
      history.forEach((item: any) => {
        const status = (item.status || 'pending').toLowerCase().trim();
        const type = (item.leaveType || 'casual').toLowerCase().trim();
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

        if (status === 'approved') {
            if (type.includes('casual')) cUsed += days;
            else if (type.includes('sick')) sUsed += days;
            else if (type.includes('earned')) eUsed += days;
        }
      });

      setLeaveBalances([
        { id: '1', type: 'Casual', rem: Math.max(0, LEAVE_LIMITS.casual - cUsed), used: cUsed, tot: LEAVE_LIMITS.casual, color: '#3B82F6', icon: 'palm-tree' },
        { id: '2', type: 'Sick', rem: Math.max(0, LEAVE_LIMITS.sick - sUsed), used: sUsed, tot: LEAVE_LIMITS.sick, color: '#EF4444', icon: 'emoticon-sick-outline' },
        { id: '3', type: 'Earned', rem: Math.max(0, LEAVE_LIMITS.earned - eUsed), used: eUsed, tot: LEAVE_LIMITS.earned, color: '#10B981', icon: 'check-decagram-outline' },
      ]);
  };

  useEffect(() => {
    let errors = { toDate: '', reason: '' };
    let validDuration = 0;

    if (leaveForm.fromDate && leaveForm.toDate) {
      const d1 = new Date(leaveForm.fromDate);
      const d2 = new Date(leaveForm.toDate);
      if (d2 < d1) {
        errors.toDate = 'End date cannot be before Start date';
      } else {
        const diffTime = Math.abs(d2.getTime() - d1.getTime());
        let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        if (leaveForm.isHalfDay) diffDays -= 0.5;
        validDuration = Math.max(0, diffDays);
      }
    }
    setLeaveForm(prev => ({ ...prev, duration: validDuration }));
    setFormErrors(errors);
  }, [leaveForm.fromDate, leaveForm.toDate, leaveForm.isHalfDay]);

  const executeLeaveSubmit = async () => {
    try {
      setSubmitLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const apiType = leaveForm.type.split(' ')[0].toLowerCase();
      
      const payload = {
          employeeId: (canCreateForOthers && leaveForm.employeeId) ? leaveForm.employeeId : myEmpId, 
          leaveType: apiType,
          startDate: leaveForm.fromDate, 
          endDate: leaveForm.toDate, 
          reason: leaveForm.reason,
          isHalfDay: leaveForm.isHalfDay,
          numberOfDays: leaveForm.duration, 
          totalDays: leaveForm.duration,    
          status: 'pending'                
      };

      const res = await axios.post(`${API_BASE}/leaves`, payload, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });

      if (res.data?.success) {
          const appliedByName =
            leaveForm.employeeName && leaveForm.employeeName !== 'Select Employee'
              ? leaveForm.employeeName
              : 'You';
          const leaveDateRange = `${leaveForm.fromDate} to ${leaveForm.toDate}`;
          showLocalNotification(
            'Leave Application Submitted',
            `${appliedByName} applied for ${leaveForm.type} (${leaveDateRange}).`,
          );
          Alert.alert("Success", "Leave Request Submitted Successfully!");
          setIsApplyModalVisible(false);
          setLeaveForm({ employeeId: '', employeeName: 'Select Employee', type: 'Casual Leave', fromDate: '', toDate: '', reason: '', isHalfDay: false, duration: 0 });
          fetchData(true); 
      }
    } catch (e: any) { 
        const errorMsg = e.response?.data?.message || e.message || "Unknown error";
        Alert.alert("Submit Failed", `Error: ${errorMsg}`); 
    } finally { 
        setSubmitLoading(false); 
    }
  };

  const handleSubmitLeave = () => {
    if (canCreateForOthers && !leaveForm.employeeId) {
        return Alert.alert("Validation", "Please select an Employee.");
    }
    if (formErrors.toDate || leaveForm.duration <= 0) {
        return Alert.alert("Validation", "Please fix the date errors before submitting.");
    }

    if (!canCreateForOthers) {
        const selectedBaseType = leaveForm.type.split(' ')[0]; 
        const balanceRecord = leaveBalances.find(b => b.type.toLowerCase() === selectedBaseType.toLowerCase());

        if (balanceRecord && leaveForm.duration > balanceRecord.rem) {
            const extraDays = leaveForm.duration - balanceRecord.rem;
            Alert.alert(
                "Leave Limit Exceeded",
                `Your remaining limit for ${leaveForm.type} is ${balanceRecord.rem} days. The extra ${extraDays} day(s) will be marked as Unpaid Leave.\n\nProceed?`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Proceed", onPress: executeLeaveSubmit }
                ]
            );
            return;
        }
    }

    executeLeaveSubmit();
  };

  const handleLeaveAction = async (leaveId: string, newStatus: 'approved' | 'rejected') => {
    try {
      setActionLoading(leaveId);
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const payload = { status: newStatus };
      await axios.put(`${API_BASE}/leaves/${leaveId}`, payload, config);

      setAllLeaves(prev => prev.map(l => l._id === leaveId ? { ...l, status: newStatus } : l));
      
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || "Failed to update status on server.";
      Alert.alert("Error", errorMsg);
    } finally {
      setActionLoading(null);
    }
  };

  const getEmployeeDetails = (leave: any) => {
    if (!leave || !leave.employeeId) return { firstName: 'Unknown', lastName: '', avatar: '' };
    if (typeof leave.employeeId === 'object' && leave.employeeId.userId) {
        return {
            firstName: leave.employeeId.userId.firstName || 'Unknown',
            lastName: leave.employeeId.userId.lastName || '',
            avatar: leave.employeeId.userId.avatar || ''
        };
    }
    return { firstName: 'Unknown', lastName: '', avatar: '' };
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '--';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr.split('T')[0];
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}/${d.getFullYear()}`;
    } catch(e) { return '--'; }
  };

  const getLeaveTypeColor = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('casual')) return { bg: '#E0F2FE', text: '#2563EB' }; 
    if (t.includes('earned')) return { bg: '#DCFCE7', text: '#16A34A' }; 
    if (t.includes('sick')) return { bg: '#FEE2E2', text: '#DC2626' };   
    return { bg: '#F1F5F9', text: '#64748B' }; 
  };

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'approved') return { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' };
    if (s === 'rejected') return { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' };
    if (s === 'pending') return { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' };
    return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
  };

  const openCalendar = (target: 'from' | 'to') => {
    setDatePickerTarget(target);
    const dateStr = target === 'from' ? leaveForm.fromDate : leaveForm.toDate;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) { setCalMonth(d.getMonth()); setCalYear(d.getFullYear()); }
    } else { setCalMonth(new Date().getMonth()); setCalYear(new Date().getFullYear()); }
    setShowDatePicker(true);
  };

  const renderCustomCalendar = () => {
    const safeYear = isNaN(calYear) ? new Date().getFullYear() : calYear;
    const safeMonth = isNaN(calMonth) ? new Date().getMonth() : calMonth;
    
    const daysInMonth = new Date(safeYear, safeMonth + 1, 0).getDate();
    let firstDay = new Date(safeYear, safeMonth, 1).getDay();
    if (isNaN(firstDay) || firstDay < 0) firstDay = 0;
    
    const daysArray = Array(firstDay).fill(null).concat([...Array(daysInMonth).keys()].map(d => d + 1));
    const fromDateObj = leaveForm.fromDate ? new Date(leaveForm.fromDate) : null;
    if (fromDateObj) fromDateObj.setHours(0, 0, 0, 0);
    const todayHighlight = new Date();
    todayHighlight.setHours(0, 0, 0, 0);

    return (
        <Modal visible={showDatePicker} transparent animationType="fade">
            <View style={styles.calOverlay}>
                <View style={[styles.calCard, { backgroundColor: colors.cardBg }]}>
                    <View style={styles.calTopHeader}>
                       <Text style={[styles.calTitle, {color: colors.textMain}]}>Select Date</Text>
                       <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                           <MaterialCommunityIcons name="close" size={24} color={colors.textSub} />
                       </TouchableOpacity>
                    </View>
                    
                    <View style={styles.calMonthNav}>
                       <TouchableOpacity style={styles.calNavBtn} onPress={() => {
                          if (safeMonth === 0) { setCalMonth(11); setCalYear(safeYear - 1); }
                          else { setCalMonth(safeMonth - 1); }
                       }}>
                          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.textMain} />
                       </TouchableOpacity>
                       <Text style={[styles.calMonthText, {color: colors.textMain}]}>{monthNames[safeMonth]} {safeYear}</Text>
                       <TouchableOpacity style={styles.calNavBtn} onPress={() => {
                          if (safeMonth === 11) { setCalMonth(0); setCalYear(safeYear + 1); }
                          else { setCalMonth(safeMonth + 1); }
                       }}>
                          <MaterialCommunityIcons name="chevron-right" size={26} color={colors.textMain} />
                       </TouchableOpacity>
                    </View>

                    <View style={styles.calWeekRow}>
                       {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <Text key={d} style={[styles.calWeekText, {color: colors.textSub}]}>{d}</Text>)}
                    </View>

                    <View style={styles.calGrid}>
                       {daysArray.map((day, idx) => {
                          if (!day) return <View key={idx} style={styles.calDayBox} />;
                          
                          const dateStr = `${safeYear}-${String(safeMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                          const currentDateObj = new Date(safeYear, safeMonth, day);
                          const isSelected = (datePickerTarget === 'from' ? leaveForm.fromDate : leaveForm.toDate) === dateStr;
                          
                          const isToday = currentDateObj.getTime() === todayHighlight.getTime();
                          let isInvalidToDate = false;
                          if (datePickerTarget === 'to' && fromDateObj) {
                              isInvalidToDate = currentDateObj < fromDateObj;
                          }
                          
                          return (
                             <TouchableOpacity 
                                key={idx} 
                                disabled={isInvalidToDate}
                                style={[
                                  styles.calDayBox, 
                                  isToday && !isSelected && { borderWidth: 1, borderColor: colors.primary },
                                  isSelected && {backgroundColor: colors.primary}
                                ]}
                                onPress={() => {
                                   if (datePickerTarget === 'from') { setLeaveForm({...leaveForm, fromDate: dateStr, toDate: ''}); } 
                                   else { setLeaveForm({...leaveForm, toDate: dateStr}); }
                                   setShowDatePicker(false);
                                }}
                             >
                                <Text style={[styles.calDayText, {color: isSelected ? '#FFF' : (isInvalidToDate ? colors.border : (isToday ? colors.primary : colors.textMain))}]}>{day}</Text>
                             </TouchableOpacity>
                          )
                       })}
                    </View>
                </View>
            </View>
        </Modal>
    );
  };

  const renderHRView = () => {
    const pendingCount = allLeaves.filter(l => (l.status || 'pending').toLowerCase() === 'pending').length;
    const approvedCount = allLeaves.filter(l => (l.status || '').toLowerCase() === 'approved').length;
    const rejectedCount = allLeaves.filter(l => (l.status || '').toLowerCase() === 'rejected').length;

    const tabsData = [
        { label: 'All', count: allLeaves.length },
        { label: 'Pending', count: pendingCount },
        { label: 'Approved', count: approvedCount },
        { label: 'Rejected', count: rejectedCount }
    ];

    const filteredLeaves = allLeaves.filter(leave => {
        const safeStatus = leave.status || 'pending';
        const matchTab = activeTab === 'All' ? true : safeStatus.toLowerCase() === activeTab.toLowerCase();
        const empData = getEmployeeDetails(leave);
        const searchLow = searchQuery.toLowerCase();
        const matchSearch = `${empData.firstName} ${empData.lastName}`.toLowerCase().includes(searchLow) || (leave.leaveType || '').toLowerCase().includes(searchLow);
        return matchTab && matchSearch;
    });

    return (
        <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 20}}>
                <View style={[styles.kpiCard, {borderLeftColor: '#F59E0B', backgroundColor: colors.cardBg}]}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                       <MaterialCommunityIcons name="clock-alert" size={16} color="#F59E0B" style={{marginRight: 6}} />
                       <Text style={styles.kpiLabel}>Pending</Text>
                    </View>
                    <Text style={[styles.kpiVal, {color: colors.textMain}]}>{pendingCount}</Text>
                </View>

                <View style={[styles.kpiCard, {borderLeftColor: '#10B981', backgroundColor: colors.cardBg}]}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                       <MaterialCommunityIcons name="check-decagram" size={16} color="#10B981" style={{marginRight: 6}} />
                       <Text style={styles.kpiLabel}>Approved</Text>
                    </View>
                    <Text style={[styles.kpiVal, {color: colors.textMain}]}>{approvedCount}</Text>
                </View>

                <View style={[styles.kpiCard, {borderLeftColor: '#EF4444', backgroundColor: colors.cardBg}]}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                       <MaterialCommunityIcons name="close-octagon" size={16} color="#EF4444" style={{marginRight: 6}} />
                       <Text style={styles.kpiLabel}>Rejected</Text>
                    </View>
                    <Text style={[styles.kpiVal, {color: colors.textMain}]}>{rejectedCount}</Text>
                </View>

                <View style={[styles.kpiCard, {borderLeftColor: '#3B82F6', backgroundColor: colors.cardBg}]}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                       <MaterialCommunityIcons name="format-list-bulleted" size={16} color="#3B82F6" style={{marginRight: 6}} />
                       <Text style={styles.kpiLabel}>Total</Text>
                    </View>
                    <Text style={[styles.kpiVal, {color: colors.textMain}]}>{allLeaves.length}</Text>
                </View>
            </ScrollView>

            <View style={styles.filterRow}>
              <View style={[styles.tabContainer, { backgroundColor: isLightMode ? '#F1F5F9' : '#1E293B' }]}>
                {tabsData.map(t => {
                  const isActive = activeTab === t.label;
                  return (
                    <TouchableOpacity key={t.label} style={[styles.tabBtn, isActive && { backgroundColor: '#3b82f6', elevation: 2, shadowColor: '#000', shadowOffset:{width:0, height:2}, shadowOpacity:0.1, shadowRadius:3 }]} onPress={() => setActiveTab(t.label)}>
                      <Text style={[styles.tabText, { color: isActive ? '#fff' : colors.textSub }]}>{t.label} {t.count > 0 ? `(${t.count})` : ''}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            {loading && !refreshing ? <ActivityIndicator size="large" color="#3b82f6" style={{marginTop: 50}} /> : filteredLeaves.map((leave) => {
               const emp = getEmployeeDetails(leave);
               const typeColor = getLeaveTypeColor(leave.leaveType);
               const statusColor = getStatusColor(leave.status);

               const fromDateStr = leave.fromDate || leave.startDate || leave.from;
               const toDateStr = leave.toDate || leave.endDate || leave.to;
               const totalDays = leave.numberOfDays ?? leave.days ?? '--';

               return (
                <View key={leave._id} style={[styles.appLeaveCard, { backgroundColor: colors.cardBg }]}>
                    <View style={styles.appCardHeader}>
                        <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                            <View style={[styles.appAvatarBox, {backgroundColor: isLightMode ? '#F1F5F9' : '#334155'}]}>
                               {emp.avatar && emp.avatar.includes('http') && !emp.avatar.includes('ui-avatars') ? ( <Image source={{ uri: emp.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} /> ) : ( <Text style={{fontWeight: '900', fontSize: 16, color: colors.primary}}>{emp.firstName?.charAt(0).toUpperCase()}</Text> )}
                            </View>
                            <View style={{marginLeft: 12, flex: 1}}>
                                <Text style={{fontWeight: 'bold', fontSize: 15, color: colors.textMain}} numberOfLines={1}>{emp.firstName} {emp.lastName}</Text>
                                <Text style={{fontSize: 11, color: colors.textSub, marginTop: 2}}>{formatDate(leave.createdAt)}</Text>
                            </View>
                        </View>
                        <View style={[styles.appTypeBadge, {backgroundColor: typeColor.bg}]}><Text style={{color: typeColor.text, fontSize: 10, fontWeight: '800'}}>{leave.leaveType}</Text></View>
                    </View>

                    <View style={[styles.appDateBox, { backgroundColor: isLightMode ? '#F8FAFC' : '#1e293b' }]}>
                        <View style={{flex: 1}}>
                            <Text style={styles.appDateLabel}>FROM</Text>
                            <Text style={[styles.appDateValue, {color: colors.textMain}]}>{formatDate(fromDateStr)}</Text>
                        </View>
                        <MaterialCommunityIcons name="arrow-right" size={18} color={colors.textSub} style={{opacity: 0.5}} />
                        <View style={{flex: 1, alignItems: 'center'}}>
                            <Text style={styles.appDateLabel}>TO</Text>
                            <Text style={[styles.appDateValue, {color: colors.textMain}]}>{formatDate(toDateStr)}</Text>
                        </View>
                        <View style={{flex: 1, alignItems: 'flex-end', borderLeftWidth: 1, borderLeftColor: colors.border}}>
                            <Text style={styles.appDateLabel}>DAYS</Text>
                            <Text style={[styles.appDateValue, {color: colors.primary, fontSize: 16}]}>{totalDays}</Text>
                        </View>
                    </View>

                    <View style={styles.appCardFooter}>
                        <View style={{flex: 1, paddingRight: 10}}>
                            <Text style={{fontSize: 13, color: colors.textMain, fontWeight: '500', lineHeight: 20}}>{leave.reason || 'No reason provided'}</Text>
                        </View>
                        
                        <View style={styles.actionArea}>
                           {actionLoading === leave._id ? (
                                <ActivityIndicator size="small" color="#3b82f6" />
                            ) : (leave.status || 'pending').toLowerCase() === 'pending' ? (
                                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                    {canActionLeaves && (
                                        <>
                                            <TouchableOpacity style={[styles.appActionBtn, { backgroundColor: '#DCFCE7' }]} onPress={() => handleLeaveAction(leave._id, 'approved')}>
                                              <Feather name="check" size={18} color="#16A34A" />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.appActionBtn, { backgroundColor: '#FEE2E2', marginLeft: 8 }]} onPress={() => handleLeaveAction(leave._id, 'rejected')}>
                                              <Feather name="x" size={18} color="#DC2626" />
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </View>
                            ) : (
                                <View style={[styles.appStatusBadge, { backgroundColor: statusColor.bg, borderColor: statusColor.border }]}>
                                    <Text style={{ color: statusColor.text, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{leave.status}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
               )
            })}

            {!loading && filteredLeaves.length === 0 && (
                <View style={{alignItems: 'center', marginTop: 40}}>
                    <Feather name="calendar" size={50} color={colors.border} />
                    <Text style={{ textAlign: 'center', color: colors.textSub, marginTop: 12, fontSize: 14, fontWeight: '600' }}>No {String(activeTab || 'All').toLowerCase()} leave requests found.</Text>
                </View>
            )}
        </>
    );
  };

  const renderEmployeeView = () => {
    const pendingCount = myLeaves.filter(i => (i.status || 'pending').toLowerCase() === 'pending').length;
    const approvedCount = myLeaves.filter(i => (i.status || '').toLowerCase() === 'approved').length;
    const rejectedCount = myLeaves.filter(i => (i.status || '').toLowerCase() === 'rejected').length;

    const tabsData = [
        { label: 'All', count: myLeaves.length },
        { label: 'Pending', count: pendingCount },
        { label: 'Approved', count: approvedCount },
        { label: 'Rejected', count: rejectedCount }
    ];

    const filteredHistory = myLeaves.filter(item => {
        const safeStatus = item.status || 'pending';
        const tabMatch = activeTab === 'All' ? true : safeStatus.toLowerCase() === activeTab.toLowerCase();
        const searchLower = searchQuery.toLowerCase().trim();
        const searchMatch = searchLower === '' || (item.reason || '').toLowerCase().includes(searchLower) || (item.leaveType || '').toLowerCase().includes(searchLower);
        return tabMatch && searchMatch;
    });

    return (
        <>
            <View style={styles.balContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 10 }}>
                {leaveBalances.map(b => (
                    <View key={b.id} style={[styles.balAppCard, { backgroundColor: colors.cardBg }]}>
                        <View style={styles.balTop}>
                            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                <View style={[styles.iconBox, { backgroundColor: b.color + '15' }]}><MaterialCommunityIcons name={b.icon} size={16} color={b.color} /></View>
                                <Text style={[styles.balTitle, {color: colors.textMain}]}>{b.type}</Text>
                            </View>
                        </View>
                        <View style={{flexDirection: 'row', alignItems: 'baseline'}}>
                            <Text style={[styles.balNum, { color: b.color }]}>{b.rem}</Text>
                            <Text style={[styles.balSub, {color: colors.textSub}]}> left</Text>
                        </View>
                        <View style={[styles.barBg, {backgroundColor: isLightMode ? '#F1F5F9' : '#334155'}]}><View style={[styles.barFill, { width: `${Math.min((b.used/b.tot)*100, 100)}%`, backgroundColor: b.color }]} /></View>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                            <Text style={[styles.balFoot, {color: colors.textSub}]}>Used: {b.used}</Text>
                            <Text style={[styles.balFoot, {color: colors.textSub}]}>Total: {b.tot}</Text>
                        </View>
                    </View>
                ))}
                </ScrollView>
            </View>

            <View style={styles.filterRow}>
              <View style={[styles.tabContainer, { backgroundColor: isLightMode ? '#F1F5F9' : '#1E293B' }]}>
                {tabsData.map(t => {
                  const isActive = activeTab === t.label;
                  return (
                    <TouchableOpacity key={t.label} style={[styles.tabBtn, isActive && { backgroundColor: '#3b82f6', elevation: 2, shadowColor: '#000', shadowOffset:{width:0, height:2}, shadowOpacity:0.1, shadowRadius:3 }]} onPress={() => setActiveTab(t.label)}>
                      <Text style={[styles.tabText, { color: isActive ? '#fff' : colors.textSub }]}>{t.label} {t.count > 0 ? `(${t.count})` : ''}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            <View style={styles.listSection}>
                {loading && !refreshing ? <ActivityIndicator size="large" color="#3b82f6" style={{marginTop: 50}} /> : filteredHistory.map((item, index) => {
                    const typeColor = getLeaveTypeColor(item.leaveType);
                    const statusColor = getStatusColor(item.status);
                    return (
                    <View key={index} style={[styles.appLeaveCard, { backgroundColor: colors.cardBg }]}>
                        <View style={styles.appCardHeader}>
                            <View style={[styles.appTypeBadge, {backgroundColor: typeColor.bg}]}><Text style={{color: typeColor.text, fontSize: 11, fontWeight: '800'}}>{item.leaveType || 'Casual'}</Text></View>
                            <View style={[styles.appStatusBadge, { backgroundColor: statusColor.bg, borderColor: statusColor.border }]}><Text style={[styles.statusText, { color: statusColor.text }]}>{item.status || 'Pending'}</Text></View>
                        </View>
                        <View style={[styles.appDateBox, { backgroundColor: isLightMode ? '#F8FAFC' : '#1e293b' }]}>
                            <View style={{flex: 1}}><Text style={styles.appDateLabel}>FROM</Text><Text style={[styles.appDateValue, {color: colors.textMain}]}>{formatDate(item.fromDate || item.startDate)}</Text></View>
                            <MaterialCommunityIcons name="arrow-right" size={18} color={colors.textSub} style={{opacity: 0.5}} />
                            <View style={{flex: 1, alignItems: 'center'}}><Text style={styles.appDateLabel}>TO</Text><Text style={[styles.appDateValue, {color: colors.textMain}]}>{formatDate(item.toDate || item.endDate)}</Text></View>
                            <View style={{flex: 1, alignItems: 'flex-end', borderLeftWidth: 1, borderLeftColor: colors.border}}><Text style={styles.appDateLabel}>DAYS</Text><Text style={[styles.appDateValue, {color: colors.primary, fontSize: 16}]}>{item.numberOfDays ?? item.days ?? '--'}</Text></View>
                        </View>
                        <View style={[styles.appCardFooter, {flexDirection: 'column', alignItems: 'flex-start'}]}>
                            <Text style={{fontSize: 13, color: colors.textMain, fontWeight: '500', lineHeight: 20, marginBottom: 8}}>{item.reason}</Text>
                            <Text style={{fontSize: 11, color: colors.textSub, fontWeight: '600'}}>Applied: {formatDate(item.createdAt)}</Text>
                        </View>
                    </View>
                )})}
                
                {!loading && filteredHistory.length === 0 && (
                    <View style={{alignItems: 'center', marginTop: 40}}>
                        <Feather name="calendar" size={50} color={colors.border} />
                        <Text style={{ textAlign: 'center', color: colors.textSub, marginTop: 12, fontSize: 14, fontWeight: '600' }}>No {String(activeTab || 'All').toLowerCase()} leave requests found.</Text>
                    </View>
                )}
            </View>
        </>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} backgroundColor="transparent" translucent={true} />
      
      <View style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg }}>
        <GlobalAppBar navigation={navigation} showSearch={true} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} colors={[colors.primary]} />}
      >
        
        {!searchQuery && (
            <View style={styles.pageHeader}>
              <View style={{ flexShrink: 1, marginRight: 10 }}>
                <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap'}}>
                    <MaterialCommunityIcons name="calendar-month-outline" size={26} color={colors.primary} style={{ marginRight: 8 }} />
                    <Text style={[styles.pageTitle, { color: colors.textMain }]} numberOfLines={2}>{canViewAll ? "Leave Management" : "My Leaves"}</Text>
                </View>
                <Text style={[styles.pageSubtitle, { color: colors.textSub }]} numberOfLines={1}>{canViewAll ? "Manage leave requests" : "Apply for leave and track requests"}</Text>
              </View>
              
              {canApply && (
                  <TouchableOpacity style={styles.applyBtn} onPress={() => {
                    setLeaveForm({ employeeId: '', employeeName: 'Select Employee', type: 'Casual Leave', fromDate: '', toDate: '', reason: '', isHalfDay: false, duration: 0 });
                    setIsApplyModalVisible(true);
                  }}>
                    <MaterialCommunityIcons name="plus" size={10} color="#FFF" style={{marginRight: 4}}/>
                    <Text style={styles.applyBtnText}>Add Leaves</Text>
                  </TouchableOpacity>
              )}
            </View>
        )}

        {canViewAll ? renderHRView() : renderEmployeeView()}

      </ScrollView>

      {/* APPLY LEAVE MODAL */}
      <Modal visible={isApplyModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.mOverlay}>
          <View style={[styles.mCard, { backgroundColor: colors.cardBg }]}>
            
            <View style={[styles.mHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.mTitle, {color: colors.textMain}]}>Apply Leave</Text>
              <TouchableOpacity onPress={() => setIsApplyModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
               
               {canCreateForOthers && (
                  <View style={{ zIndex: 20, marginBottom: 10 }}>
                     <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Employee *</Text>
                     <TouchableOpacity style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => { setShowFormEmp(!showFormEmp); setShowTypeDropdown(false); }}>
                       <Text style={[styles.dropdownText, {color: leaveForm.employeeId ? colors.textMain : colors.textSub}]}>{leaveForm.employeeName}</Text>
                       <MaterialCommunityIcons name={showFormEmp ? "chevron-up" : "chevron-down"} size={20} color={colors.textSub} />
                     </TouchableOpacity>

                     {showFormEmp && (
                       <View style={[styles.dropdownList, {backgroundColor: colors.cardBg, borderColor: colors.border, maxHeight: 200}]}>
                         <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
                           {(allEmployees || []).map((emp: any, index: number) => {
                               const fName = emp.userId?.firstName || emp.firstName || 'Unknown';
                               const lName = emp.userId?.lastName || emp.lastName || '';
                               return (
                               <TouchableOpacity key={index} style={[styles.dropdownItem, {borderBottomColor: colors.border}]} onPress={() => { 
                                   setLeaveForm({...leaveForm, employeeId: emp._id, employeeName: `${fName} ${lName}`}); 
                                   setShowFormEmp(false); 
                               }}>
                                   <Text style={[styles.dropdownItemText, { color: colors.textMain }]}>{fName} {lName}</Text>
                               </TouchableOpacity>
                           )})}
                         </ScrollView>
                       </View>
                     )}
                  </View>
               )}

               <View style={{ zIndex: 10, position: 'relative' }}>
                 <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Leave Type</Text>
                 <TouchableOpacity style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => { setShowTypeDropdown(!showTypeDropdown); setShowFormEmp(false); }}>
                   <Text style={[styles.dropdownText, {color: colors.textMain}]}>{leaveForm.type}</Text>
                   <MaterialCommunityIcons name={showTypeDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.textSub} />
                 </TouchableOpacity>

                 {showTypeDropdown && (
                   <View style={[styles.dropdownList, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                     {LEAVE_TYPES.map((t, idx) => (
                       <TouchableOpacity key={idx} style={[styles.dropdownItem, {borderBottomColor: colors.border}]} onPress={() => { setLeaveForm({...leaveForm, type: t}); setShowTypeDropdown(false); }}>
                         <Text style={[styles.dropdownItemText, {color: colors.textMain}]}>{t}</Text>
                       </TouchableOpacity>
                     ))}
                   </View>
                 )}
               </View>

               <View style={[styles.row, { zIndex: 1, marginTop: 15 }]}>
                  <View style={{flex:1, marginRight:10}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>From Date *</Text>
                    <TouchableOpacity style={[styles.dateInputWrapper, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => openCalendar('from')}>
                      <Text style={[styles.inputObj, {color: leaveForm.fromDate ? colors.textMain : colors.textSub}]}>{leaveForm.fromDate || 'YYYY-MM-DD'}</Text>
                      <MaterialCommunityIcons name="calendar" size={18} color={colors.textSub} />
                    </TouchableOpacity>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>To Date *</Text>
                    <TouchableOpacity style={[styles.dateInputWrapper, {backgroundColor: colors.background, borderColor: formErrors.toDate ? 'red' : colors.border}]} onPress={() => openCalendar('to')}>
                      <Text style={[styles.inputObj, {color: leaveForm.toDate ? colors.textMain : colors.textSub}]}>{leaveForm.toDate || 'YYYY-MM-DD'}</Text>
                      <MaterialCommunityIcons name="calendar" size={18} color={colors.textSub} />
                    </TouchableOpacity>
                  </View>
               </View>
               
               {formErrors.toDate ? (
                 <Text style={{color: 'red', fontSize: 11, marginTop: 4, fontWeight: '500'}}>{formErrors.toDate}</Text>
               ) : null}

               {leaveForm.duration > 0 && !formErrors.toDate && (
                 <Text style={[styles.durationText, {color: colors.primary}]}>Duration: {leaveForm.duration} days</Text>
               )}

               <TouchableOpacity style={[styles.checkboxRow, { zIndex: 1 }]} onPress={() => setLeaveForm({...leaveForm, isHalfDay: !leaveForm.isHalfDay})}>
                 <MaterialCommunityIcons name={leaveForm.isHalfDay ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={leaveForm.isHalfDay ? colors.primary : colors.textSub} />
                 <Text style={[styles.checkboxLabel, {color: colors.textSub}]}>Half Day Leave</Text>
               </TouchableOpacity>

               <Text style={[styles.inputLabel, {color: colors.textSub}]}>Reason *</Text>
               <TextInput style={[styles.inputObj, styles.textArea, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} placeholder="Please describe the reason..." placeholderTextColor={colors.textSub} multiline value={leaveForm.reason} onChangeText={t => setLeaveForm({...leaveForm, reason: t})} />
               
               <View style={styles.modalFooterRow}>
                 <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsApplyModalVisible(false)}>
                   <Text style={[styles.cancelBtnText, {color: colors.textSub}]}>Cancel</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                    style={[styles.subBtn, {backgroundColor: colors.primary, opacity: (leaveForm.fromDate && leaveForm.toDate && leaveForm.reason) ? 1 : 0.5}]} 
                    onPress={handleSubmitLeave} 
                    disabled={submitLoading || !(leaveForm.fromDate && leaveForm.toDate && leaveForm.reason)}
                 >
                   {submitLoading ? <ActivityIndicator color="#FFF" size="small"/> : <Text style={styles.subBtnText}>Submit</Text>}
                 </TouchableOpacity>
               </View>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {renderCustomCalendar()}
    </SafeAreaView>
  );
}

const getDynamicStyles = (colors: any, isLight: boolean) => {
  const bg = colors?.background || '#F8FAFC';
  const card = colors?.cardBg || colors?.card || '#FFF';
  const textMain = colors?.textMain || colors?.text || '#1E293B';
  const textSub = colors?.textSub || '#64748B';
  const primary = colors?.primary || '#3B82F6';
  const border = colors?.border || '#F1F5F9';

  return StyleSheet.create({
    container: { 
       flex: 1, 
       backgroundColor: bg,
    
    },
    
    scrollContent: { padding: 16, paddingBottom: 40 },
    
    kpiWrapper: { flexDirection: 'row', marginBottom: 20 },
    kpiCard: { 
        width: 120, 
        padding: 15, 
        borderRadius: 12, 
        marginRight: 12, 
        borderLeftWidth: 4, 
        elevation: 1 
    },
    kpiLabel: { fontSize: 12, color: textSub, fontWeight: 'bold' },
    kpiVal: { fontSize: 22, fontWeight: '900', marginTop: 10 },

    balContainer: { paddingVertical: 5, marginBottom: 15 },
    balAppCard: { width: width * 0.4, borderRadius: 20, padding: 16, marginRight: 15, elevation: 4, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 8 },
    balTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
    balTitle: { fontSize: 14, fontWeight: '800' },
    iconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    balNum: { fontSize: 26, fontWeight: '900', marginRight: 4 },
    balSub: { fontSize: 12, fontWeight: '700', marginBottom: 15 },
    barBg: { height: 8, borderRadius: 4, marginBottom: 12, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 4 },
    balFoot: { fontSize: 11, fontWeight: '700' },

    appLeaveCard: { borderRadius: 20, marginBottom: 16, padding: 18, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.06, shadowRadius: 6 },
    appCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    appAvatarBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    appTypeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    appStatusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
    appDateBox: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 16, justifyContent: 'space-between' },
    appDateLabel: { fontSize: 9, color: textSub, marginBottom: 4, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    appDateValue: { fontSize: 13, fontWeight: 'bold' },
    appCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    appActionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    
    filterRow: { flexDirection: 'row', marginBottom: 20, alignItems: 'center' },
    tabContainer: { flexDirection: 'row', borderRadius: 12, padding: 4, width: '100%' ,flexWrap: 'wrap'},
    tabBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: 10 ,paddingHorizontal: 12, margin: 2},
    tabText: { fontSize: 13, fontWeight: '700',flexShrink: 1  },
    
    statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

    applyBtn: { backgroundColor: primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, elevation: 3, marginTop: 5 },
    applyBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
    mOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-end', margin: 0, padding: 0, zIndex: 10 },
    mCard: { width: '100%', backgroundColor: card, padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Platform.OS === 'ios' ? 40 : 24, elevation: 10 },
    mHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, borderBottomWidth: 1, paddingBottom: 12 },
    mTitle: { fontSize: 18, fontWeight: '900' },
    inputLabel: { fontSize: 12, fontWeight: '800', marginBottom: 8, marginTop: 12, color: textSub },
    dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
    dropdownText: { fontSize: 14, fontWeight: '600' },
    dropdownList: { position: 'absolute', top: '100%', left: 0, right: 0, borderWidth: 1, borderRadius: 12, marginTop: 4, elevation: 5, zIndex: 100 },
    dropdownItem: { padding: 14, borderBottomWidth: 1 },
    dropdownItemText: { fontSize: 14, fontWeight: '600' },
    row: { flexDirection: 'row', marginTop: 5 },
    dateInputWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48 },
    inputObj: { fontSize: 14, fontWeight: '600' },
    durationText: { fontSize: 12, fontWeight: '800', marginTop: 8, marginLeft: 2 },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 4 },
    checkboxLabel: { fontSize: 14, marginLeft: 10, fontWeight: '700' },
    textArea: { borderWidth: 1, borderColor: border, borderRadius: 12, padding: 14, fontSize: 14, color: textMain, backgroundColor: isLight ? '#FFF' : bg, height: 90, textAlignVertical: 'top', marginTop: 4 },
    modalFooterRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 24 },
    cancelBtn: { paddingVertical: 12, paddingHorizontal: 20, marginRight: 10 },
    cancelBtnText: { fontWeight: '800', fontSize: 14 },
    subBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    subBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

    calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 1000 },
    calCard: { width: '100%', borderRadius: 24, padding: 20, elevation: 10 },
    calTopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    calTitle: { fontSize: 18, fontWeight: '900' },
    calMonthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    calNavBtn: { padding: 8, backgroundColor: isLight ? '#F1F5F9' : '#334155', borderRadius: 12 },
    calMonthText: { fontSize: 16, fontWeight: '800' },
    calWeekRow: { flexDirection: 'row', marginBottom: 10 },
    calWeekText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '800' },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calDayBox: { width: '14.28%', aspectRatio: 1.2, justifyContent: 'center', alignItems: 'center', marginVertical: 2, borderRadius: 12 },
    calDayText: { fontSize: 14, fontWeight: '700' },
    actionArea: { minWidth: 90, alignItems: 'flex-end', justifyContent: 'center' },
    
    // 🚀 FIXED LAYOUT: Using flexWrap ensures the title and button never collide
    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 5, flexWrap: 'wrap' },
    pageTitle: { fontSize: 24, fontWeight: 'bold' },
    pageSubtitle: { fontSize: 13, marginTop: 4, marginLeft: 34 },
    
    listSection: { flex: 1 }
  });
};