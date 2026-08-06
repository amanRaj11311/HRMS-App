import React, { useState, useCallback } from "react";
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  TouchableOpacity, SafeAreaView, RefreshControl, StatusBar, Platform, Dimensions,
  Modal, TextInput, KeyboardAvoidingView, Alert // 🚀 FIXED: Alert imported here
} from "react-native";
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import axios from 'axios'; 
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../constants/theme'; 
import GlobalAppBar from '../components/GlobalAppBar';
import { API_BASE } from '../api/api';

const { width } = Dimensions.get("window");

export default function CheckoutRequestsModule({ navigation }: any) {
  const { colors, isLightMode } = useTheme(); 
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('Pending'); 
  const [requests, setRequests] = useState<any[]>([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [permissions, setPermissions] = useState<string[]>([]);

  // --- REVIEW ACTION STATES ---
  const [isActionModalVisible, setIsActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'approved' | 'rejected'>('approved');
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const getInitialTime = (hours: number, minutes = 0) => {
    const d = new Date(); d.setHours(hours, minutes, 0, 0); return d;
  };
  
  const [actionForm, setActionForm] = useState({
    time: getInitialTime(18, 0),
    rejectionReason: ''
  });

  const canReview = permissions.includes('CHECKOUT_REQUEST:REVIEW') || permissions.includes('CHECKOUT_REQUEST:UPDATE') || permissions.includes('ATTENDANCE:VIEW');

  useFocusEffect(
    React.useCallback(() => {
      initScreen();
    }, [])
  );

  const initScreen = async () => {
    try {
      const permsStr = await AsyncStorage.getItem('userPermissions');
      const pArray = permsStr ? JSON.parse(permsStr).map((p: string) => p.toUpperCase().trim()) : [];
      setPermissions(pArray);
      fetchRequests(false, pArray);
    } catch (e) {
      console.log("Init Error", e);
      
    }
  };

  const fetchRequests = async (isRefresh = false, currentPerms = permissions) => {
    try {
      if (!isRefresh) setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const hasReviewAuth = currentPerms.includes('CHECKOUT_REQUEST:REVIEW') || currentPerms.includes('CHECKOUT_REQUEST:UPDATE') || currentPerms.includes('ATTENDANCE:VIEW');

      // 🚀 SMART ROUTING: Admins get all requests, Employees get only their own
      const url = hasReviewAuth 
        ? `${API_BASE}/checkout-requests?limit=500` 
        : `${API_BASE}/checkout-requests/self?limit=500`;

      const res = await axios.get(`${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`, config);
      let data = res.data?.data || [];
      
      // Sort to show latest first
      data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setRequests(data);

      const p = data.filter((r: any) => String(r.status).toLowerCase() === 'pending').length;
      const a = data.filter((r: any) => String(r.status).toLowerCase() === 'approved').length;
      const r = data.filter((r: any) => String(r.status).toLowerCase() === 'rejected').length;
      setStats({ pending: p, approved: a, rejected: r, total: data.length });

    } catch (e) {
      console.log("Error loading checkout logs", e);
    } finally {
      setLoading(false);
      
      setRefreshing(false);
    }
  };
 
  const submitReviewAction = async () => {
    if (actionType === 'rejected' && !actionForm.rejectionReason.trim()) {
       return Alert.alert("Required", "Please provide a reason for rejection.");
    }

    try {
      setActionLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      
      let payload: any = { status: actionType };
      
      if (actionType === 'approved') {
          const pad = (n: number) => n < 10 ? '0' + n : n;
          payload.checkOutTime = `${pad(actionForm.time.getHours())}:${pad(actionForm.time.getMinutes())}`;
      } else {
          payload.rejectionReason = actionForm.rejectionReason;
      }

      const res = await axios.put(`${API_BASE}/checkout-requests/${selectedReq._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        Alert.alert("Success", `Request has been ${actionType} successfully!`);
        setIsActionModalVisible(false);
        fetchRequests(true);
      }
    } catch (err: any) {
      // 🚀 FIXED: Adding Exact Backend Error to Console for debugging
      // console.error("❌ Checkout Action Backend Error:", err.response?.data || err.message);
      Alert.alert("Error", err.response?.data?.message || "Failed to submit action. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const openApproveModal = (req: any) => {
      setSelectedReq(req);
      setActionType('approved');
      
      // Pre-fill time if provided in request, else default to 18:00
      let d = getInitialTime(18, 0);
      if (req.checkOutTime || req.requestedCheckOutTime) {
          const timeStr = req.checkOutTime || req.requestedCheckOutTime;
          
          if (timeStr.includes('T')) {
              // If it's an ISO string (e.g. 2026-07-16T12:30:00.000Z)
              const dt = new Date(timeStr);
              if (!isNaN(dt.getTime())) d = dt;
          } else {
              // If it's HH:mm format
              const match = timeStr.match(/(\d{2}):(\d{2})/);
              if (match) {
                  d = getInitialTime(parseInt(match[1]), parseInt(match[2]));
              }
          }
      }
      setActionForm({ time: d, rejectionReason: '' });
      setIsActionModalVisible(true);
  };

  const openRejectModal = (req: any) => {
      setSelectedReq(req);
      setActionType('rejected');
      setActionForm({ time: getInitialTime(18, 0), rejectionReason: '' });
      setIsActionModalVisible(true);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr.split('T')[0] : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const formatTimeUI = (dateObj: Date) => {
      let h = dateObj.getHours();
      const m = String(dateObj.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  };

  // 🚀 PERFECT INDIAN 12-HOUR FORMAT FIX
  const formatRequestedTime = (timeStr: string) => {
      if (!timeStr) return '--:-- --';
      
      if (timeStr.includes('T')) {
          const d = new Date(timeStr);
          if (isNaN(d.getTime())) return timeStr;
          let h = d.getHours();
          const m = String(d.getMinutes()).padStart(2, '0');
          const ampm = h >= 12 ? 'PM' : 'AM';
          h = h % 12 || 12;
          return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
      }
      
      const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
      if (match) {
          let h = parseInt(match[1], 10);
          const m = match[2];
          const ampm = h >= 12 ? 'PM' : 'AM';
          h = h % 12 || 12;
          return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
      }
      
      return timeStr;
  };

  const getStatusColor = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' };
    if (s === 'rejected') return { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' };
    return { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' };
  };

  const filteredRequests = requests.filter((req: any) => {
    if (activeTab === 'All') return true;
    return String(req.status).toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} backgroundColor="transparent" translucent />
      <View style={{paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg}}>
         <GlobalAppBar navigation={navigation} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchRequests(true)} />}>
        <Text style={[styles.pageTitle, {color: colors.textMain}]}>{canReview ? 'Review Checkout Requests' : 'Checkout Requests'}</Text>
        <Text style={{color: '#64748B', fontSize: 12, marginBottom: 20}}>
          {canReview ? 'Review missed punch-out requests raised by employees' : 'Track your missed punch-out checkout requests'}
        </Text>

        {/* METRICS DASHBOARD PANEL */}
        <View style={styles.metricsRow}>
          <View style={[styles.statBox, {backgroundColor: colors.cardBg, borderLeftColor: '#EA580C'}]}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={[styles.statVal, {color: colors.textMain}]}>{stats.pending}</Text>
          </View>
          <View style={[styles.statBox, {backgroundColor: colors.cardBg, borderLeftColor: '#16A34A'}]}>
            <Text style={styles.statLabel}>Approved</Text>
            <Text style={[styles.statVal, {color: colors.textMain}]}>{stats.approved}</Text>
          </View>
          <View style={[styles.statBox, {backgroundColor: colors.cardBg, borderLeftColor: '#DC2626'}]}>
            <Text style={styles.statLabel}>Rejected</Text>
            <Text style={[styles.statVal, {color: colors.textMain}]}>{stats.rejected}</Text>
          </View>
        </View>

        {/* CUSTOM FILTER TABS */}
        <View style={[styles.tabBar, {backgroundColor: isLightMode ? '#F1F5F9' : '#1E293B'}]}>
          {['Pending', 'Approved', 'Rejected', 'All'].map((tab) => (
            <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab === tab && {backgroundColor: '#6366F1', elevation: 2}]} onPress={() => setActiveTab(tab)}>
              <Text style={{color: activeTab === tab ? '#FFF' : colors.textSub, fontWeight: 'bold', fontSize: 12}}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && !refreshing ? <ActivityIndicator size="large" color="#6366F1" style={{marginTop: 40}} /> : filteredRequests.map((item: any) => {
          const statusStyle = getStatusColor(item.status);
          const isPending = String(item.status).toLowerCase() === 'pending';
          
          return (
            <View key={item._id} style={[styles.logCard, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
              
              {/* 🚀 ADMIN VIEW: Show Employee Profile Info */}
              {canReview && item.employeeId?.userId && (
                  <View style={[styles.userInfoHeader, {borderBottomColor: colors.border}]}>
                      <View style={[styles.avatarBox, {backgroundColor: isLightMode ? '#F1F5F9' : '#334155'}]}>
                          <Text style={{fontWeight: '900', fontSize: 14, color: '#6366F1'}}>{item.employeeId.userId.firstName?.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View>
                          <Text style={{fontWeight: 'bold', fontSize: 14, color: colors.textMain}}>{item.employeeId.userId.firstName} {item.employeeId.userId.lastName}</Text>
                          <Text style={{fontSize: 10, color: '#94A3B8'}}>{item.employeeId.employeeId}</Text>
                      </View>
                  </View>
              )}

              <View style={styles.cardHeader}>
                <View>
                  <Text style={[styles.dateText, {color: colors.textMain}]}>{formatDate(item.date)}</Text>
                  {/* 🚀 Show the correctly formatted Indian time */}
                  <Text style={{color: '#94A3B8', fontSize: 11, marginTop: 2}}>Requested For: <Text style={{color: colors.primary, fontWeight: 'bold'}}>{formatRequestedTime(item.checkOutTime || item.requestedCheckOutTime)}</Text></Text>
                  {/* 🚀 Clarify when the request was actually applied */}
                  <Text style={{color: '#94A3B8', fontSize: 10, marginTop: 2}}>Applied On: {formatDate(item.createdAt)}</Text>
                </View>
                
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    {/* Status Badge */}
                    <View style={[styles.statusTag, {backgroundColor: statusStyle.bg, borderColor: statusStyle.border}]}>
                        <Text style={{color: statusStyle.text, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase'}}>{item.status}</Text>
                    </View>

                    {/* 🚀 ADMIN VIEW: Action Buttons for Pending Requests */}
                    {canReview && isPending && (
                        <View style={{flexDirection: 'row', marginLeft: 10}}>
                            <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#DCFCE7'}]} onPress={() => openApproveModal(item)}>
                                <Feather name="check" size={16} color="#16A34A" />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#FEE2E2', marginLeft: 8}]} onPress={() => openRejectModal(item)}>
                                <Feather name="x" size={16} color="#DC2626" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

              </View>

              <View style={{marginTop: 12, borderTopWidth: 1, borderColor: colors.border, paddingTop: 10}}>
                <Text style={{color: '#94A3B8', fontSize: 10, fontWeight: 'bold'}}>REASON</Text>
                <Text style={[styles.reasonText, {color: colors.textMain}]}>{item.reason || 'No reason specified'}</Text>
              </View>
              
              {(item.reviewerNote || item.rejectionReason) ? (
                <View style={{marginTop: 10, backgroundColor: isLightMode ? '#F8FAFC' : '#1E293B', padding: 10, borderRadius: 8}}>
                  <Text style={{color: '#94A3B8', fontSize: 10, fontWeight: 'bold'}}>{item.status === 'rejected' ? 'REJECTION REASON' : 'REVIEWER NOTE'}</Text>
                  <Text style={{color: colors.textMain, fontSize: 12, marginTop: 2}}>{item.reviewerNote || item.rejectionReason}</Text>
                </View>
              ) : null}
            </View>
          );
        })}

        {!loading && filteredRequests.length === 0 && (
          <View style={{alignItems: 'center', marginTop: 50}}>
            <MaterialCommunityIcons name="comment-question-outline" size={45} color={colors.border} />
            <Text style={{color: '#94A3B8', marginTop: 10, fontSize: 13}}>No checkout requests found.</Text>
          </View>
        )}
      </ScrollView>

      {/* 🚀 ADMIN ACTION MODAL (Approve / Reject) */}
      <Modal visible={isActionModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.requestCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            
            <View style={styles.modalHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <MaterialCommunityIcons name={actionType === 'approved' ? "check-decagram" : "close-octagon"} size={22} color={actionType === 'approved' ? '#16A34A' : '#DC2626'} style={{marginRight: 8}} />
                <Text style={[styles.mTitle, {color: colors.textMain}]}>{actionType === 'approved' ? 'Approve' : 'Reject'} Request</Text>
              </View>
              <TouchableOpacity onPress={() => setIsActionModalVisible(false)}>
                <Feather name="x" size={22} color={colors.textMain}/>
              </TouchableOpacity>
            </View>

            <View style={{padding: 20}}>
              
              <View style={{marginBottom: 15, padding: 12, backgroundColor: isLightMode ? '#F8FAFC' : '#1E293B', borderRadius: 10}}>
                  <Text style={{fontSize: 12, color: colors.textSub, fontWeight: 'bold'}}>Reason given:</Text>
                  <Text style={{fontSize: 14, color: colors.textMain, marginTop: 4}}>{selectedReq?.reason || 'N/A'}</Text>
              </View>

              {actionType === 'approved' ? (
                  <>
                      <Text style={styles.modalLabel}>Confirm Checkout Time *</Text>
                      <TouchableOpacity style={[styles.disabledInput, {borderColor: colors.border}]} onPress={() => setShowTimePicker(true)}>
                        <Text style={{color: colors.textMain, fontWeight: 'bold'}}>{formatTimeUI(actionForm.time)}</Text>
                        <Feather name="clock" size={16} color={colors.textSub} />
                      </TouchableOpacity>
                  </>
              ) : (
                  <>
                      <Text style={styles.modalLabel}>Rejection Reason *</Text>
                      <TextInput 
                          style={[styles.modalTextArea, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} 
                          placeholder="Why are you rejecting this request?" 
                          placeholderTextColor={colors.textSub} 
                          multiline 
                          value={actionForm.rejectionReason} 
                          onChangeText={t => setActionForm({...actionForm, rejectionReason: t})} 
                      />
                  </>
              )}
              
              <TouchableOpacity 
                  style={[styles.submitActionBtn, {backgroundColor: actionType === 'approved' ? '#10B981' : '#EF4444'}]} 
                  onPress={submitReviewAction} 
                  disabled={actionLoading}
              >
                {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={{color: '#FFF', fontWeight: 'bold', fontSize: 15}}>Confirm {actionType === 'approved' ? 'Approval' : 'Rejection'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {showTimePicker && <DateTimePicker value={actionForm.time} mode="time" onChange={(e, d) => { setShowTimePicker(false); if(e.type === 'set' && d) setActionForm({...actionForm, time: d}); }} />}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  pageTitle: { fontSize: 24, fontWeight: '900' },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { width: '31%', padding: 14, borderRadius: 14, borderLeftWidth: 4, elevation: 1 },
  statLabel: { fontSize: 11, color: '#94A3B8', fontWeight: 'bold' },
  statVal: { fontSize: 20, fontWeight: '900', marginTop: 4 },
  tabBar: { flexDirection: 'row', padding: 4, borderRadius: 12, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  
  logCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12, elevation: 1 },
  
  // 🚀 ADMIN VIEW STYLES
  userInfoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingBottom: 12, borderBottomWidth: 1 },
  avatarBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 15, fontWeight: 'bold' },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  reasonText: { fontSize: 13, marginTop: 4, lineHeight: 18 },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  requestCard: { width: '90%', borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, alignItems: 'center', borderColor: '#F1F5F9' },
  mTitle: { fontSize: 18, fontWeight: 'bold' },
  modalLabel: { fontWeight: '600', fontSize: 13, color: '#64748B', marginBottom: 6 },
  disabledInput: { borderWidth: 1, height: 48, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row' },
  modalTextArea: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14, height: 90, textAlignVertical: 'top', marginTop: 4 },
  submitActionBtn: { height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
});