import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, SafeAreaView, RefreshControl, StatusBar, Platform, Modal, TextInput, KeyboardAvoidingView, ScrollView, Alert
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { useTheme } from '../constants/theme';
import GlobalAppBar from '../components/GlobalAppBar'; 

const API_BASE = 'https://hrms.dcstechnosis.com/api';
const STATUS_OPTIONS = ['Pending', 'Success', 'Lost']; 

export default function LeadsScreen({ navigation }: any) {
  const { colors, isLightMode } = useTheme(); 
  const styles = getDynamicStyles(colors, isLightMode);

  // --- PERMISSIONS STATES ---
  const [permissions, setPermissions] = useState<string[]>([]);
  const [myEmpId, setMyEmpId] = useState<string>('');

  const [leads, setLeads] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  // 🚀 NEW: Tracking Modal State
  const [showActivitiesModal, setShowActivitiesModal] = useState(false);
  const [currentActivities, setCurrentActivities] = useState<any[]>([]);
  const [currentLeadDates, setCurrentLeadDates] = useState({ start: '', end: '' });
  
  const [isEditing, setIsEditing] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const [formData, setFormData] = useState({
    _id: '',
    name: '',
    phone: '',
    email: '',
    status: 'Pending',
    assignTo: '',
    assignToName: 'Select Employee',
    startingDate: new Date().toISOString().split('T')[0],
    endingDate: '',
    remarks: ''
  });

  const hasPerm = (action: string) => {
      return permissions.includes(`LEADS:${action.toUpperCase()}`);
  };

  const canViewAll = hasPerm('VIEW');
  const canCreate = hasPerm('CREATE');
  const canUpdate = hasPerm('UPDATE');
  const canDelete = hasPerm('DELETE');
  const canViewSelf = hasPerm('SELF');

  useFocusEffect(
    useCallback(() => {
      initScreen();
    }, [])
  );

  const initScreen = async () => {
    setLoading(true);
    const permsStr = await AsyncStorage.getItem('userPermissions');
    const empId = await AsyncStorage.getItem('employeeId');
    
    const rawArray = permsStr ? JSON.parse(permsStr) : [];
    const pArray = rawArray.map((p: string) => p.trim().toUpperCase());
    
    setPermissions(pArray);
    if (empId) setMyEmpId(empId);
    
    if (pArray.includes('LEADS:VIEW') || pArray.includes('LEADS:CREATE') || pArray.includes('LEADS:UPDATE')) {
        fetchEmployees();
    }
    
    fetchLeadsData(false, pArray, empId);
  };

  const fetchEmployees = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(`${API_BASE}/employees?limit=500`, { headers: { Authorization: `Bearer ${token}` } });
      const empData = res.data?.data?.data || res.data?.data || res.data || [];
      setEmployees(Array.isArray(empData) ? empData : []);
    } catch (e) {}
  };

  const fetchLeadsData = async (isSilent = false, currentPerms = permissions, empId = myEmpId) => {
    try {
      if (!isSilent) setLoading(true);
      
      const userCanViewAll = currentPerms.includes('LEADS:VIEW');
      const userCanViewSelf = currentPerms.includes('LEADS:SELF');

      if (!userCanViewAll && !userCanViewSelf) {
          setLeads([]);
          setLoading(false);
          setRefreshing(false);
          return;
      }

      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const cacheBuster = new Date().getTime();
      let url = `${API_BASE}/leads?limit=1000&_t=${cacheBuster}`;
      
      if (!userCanViewAll && userCanViewSelf && empId) {
          url = `${API_BASE}/leads?assignTo=${empId}&limit=200&_t=${cacheBuster}`;
      }

      const res = await axios.get(url, config);
      const leadsData = res.data?.data?.data || res.data?.data || res.data || [];
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      
    } catch (err: any) {
      console.log("Leads fetch error", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeadsData(true); 
  }, [permissions, myEmpId]);

  const handleDelete = (id: string, name: string) => {
    Alert.alert("Delete Lead", `Are you sure you want to delete lead '${name}'?`, [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('userToken');
            const res = await axios.delete(`${API_BASE}/leads/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            
            if (res.data && res.data.success === false) {
                Alert.alert("Error", res.data.message || "Backend prevented deletion.");
                return;
            }

            setLeads(prev => prev.filter(l => l._id !== id));
            Alert.alert("Success", "Lead deleted successfully");
          } catch (err: any) { 
              Alert.alert("Error", err.response?.data?.message || "Failed to delete."); 
          }
        }
      }
    ]);
  };

  const handleStartDateChange = (event: any, date?: Date) => {
    setShowStartDatePicker(Platform.OS === 'ios');
    if (date && event.type === 'set') {
      setFormData({ ...formData, startingDate: date.toISOString().split('T')[0] });
    }
  };

  const handleEndDateChange = (event: any, date?: Date) => {
    setShowEndDatePicker(Platform.OS === 'ios');
    if (date && event.type === 'set') {
      setFormData({ ...formData, endingDate: date.toISOString().split('T')[0] });
    }
  };

  const submitForm = async () => {
    if (!formData.name) {
      Alert.alert("Required", "Please provide a Name for the lead.");
      return;
    }

    try {
      setFormLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const payload: any = { 
          name: formData.name,
          phoneNumber: formData.phone,
          email: formData.email,
          status: formData.status.toLowerCase(),
          remarks: formData.remarks
      };

      if (formData.assignTo && formData.assignTo !== 'None' && formData.assignTo !== 'Select Employee') {
          payload.assignTo = formData.assignTo;
      }
      if (formData.startingDate) payload.startingDate = formData.startingDate;
      if (formData.endingDate) payload.endingDate = formData.endingDate;

      let res;
      if (isEditing) {
        res = await axios.put(`${API_BASE}/leads/${formData._id}`, payload, config);
      } else {
        res = await axios.post(`${API_BASE}/leads`, payload, config);
      }
      
      if (res.data && (res.data.success === false || res.data.status === 'error')) {
          Alert.alert("Save Failed", res.data.message || "Backend validation failed.");
          setFormLoading(false);
          return;
      }

      setIsModalVisible(false);
      await fetchLeadsData(true); 
      Alert.alert("Success", `Lead ${isEditing ? 'updated' : 'created'} successfully.`);
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || err.message || "Failed to save lead.");
    } finally { 
      setFormLoading(false); 
    }
  };

  const filteredLeads = leads.filter(lead => {
     if(!searchQuery) return true;
     const q = searchQuery.toLowerCase();
     return (lead.name || '').toLowerCase().includes(q) || 
            (lead.email || '').toLowerCase().includes(q) ||
            (lead.phoneNumber || lead.phone || lead.mobile || '').toLowerCase().includes(q);
  });

  const employeeOptions = ['None', ...employees.map(e => {
      const user = e.userId || {};
      return `${user.firstName || ''} ${user.lastName || ''} (${e.employeeId || e._id.substring(0,4)})`;
  })];

  const handleEmployeeSelect = (selection: string) => {
      if (selection === 'None' || selection === 'Select Employee') {
          setFormData({ ...formData, assignTo: '', assignToName: 'None' });
      } else {
          const matchedEmp = employees.find(e => {
             const user = e.userId || {};
             const str = `${user.firstName || ''} ${user.lastName || ''} (${e.employeeId || e._id.substring(0,4)})`;
             return str === selection;
          });
          if (matchedEmp) {
              setFormData({ ...formData, assignTo: matchedEmp._id, assignToName: selection });
          }
      }
  };

  const totalLeads = leads.length;
  const successLeads = leads.filter(l => (l.status || '').toLowerCase() === 'success').length;
  const pendingLeads = leads.filter(l => (l.status || '').toLowerCase() === 'pending').length;
  const lostLeads = leads.filter(l => (l.status || '').toLowerCase() === 'lost').length;

  const renderLeadCard = ({ item }: { item: any }) => {
    const getStatusColor = (status: string) => {
      const s = (status || '').toLowerCase();
      if (s === 'success' || s === 'won') return { bg: isLightMode ? '#D1FAE5' : '#064E3B', text: '#10B981' };
      if (s === 'lost' || s === 'failed') return { bg: isLightMode ? '#FEE2E2' : '#7F1D1D', text: '#EF4444' };
      return { bg: isLightMode ? '#FEF3C7' : '#78350F', text: '#F59E0B' };
    };

    const statusStyle = getStatusColor(item.status);
    const assignedUser = item.assignTo?.userId || {};
    const assignedName = assignedUser.firstName ? `${assignedUser.firstName} ${assignedUser.lastName}` : '---';

    return (
      <View key={item._id} style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
              <View style={[styles.avatarBox, { backgroundColor: isLightMode ? '#F1F5F9' : '#334155' }]}>
                  <Text style={{ fontWeight: '900', fontSize: 16, color: colors.primary }}>
                      {item.name ? item.name.charAt(0).toUpperCase() : 'L'}
                  </Text>
              </View>
              <View style={{flex: 1, marginLeft: 12}}>
                <Text style={[styles.leadName, {color: colors.textMain}]} numberOfLines={1}>{item.name || 'Unnamed Lead'}</Text>
                <Text style={[styles.leadEmail, {color: colors.textSub}]} numberOfLines={1}>{item.email || 'No Email'}</Text>
              </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, {color: statusStyle.text}]}>{(item.status || 'PENDING').toUpperCase()}</Text>
          </View>
        </View>

        <View style={[styles.dateBox, { backgroundColor: isLightMode ? '#F8FAFC' : '#1E293B' }]}>
          <View style={{flex: 1}}>
              <Text style={styles.dateLabel}>CONTACT</Text>
              <Text style={[styles.dateValue, {color: colors.primary}]} numberOfLines={1}>{item.phoneNumber || item.phone || item.mobile || 'N/A'}</Text>
          </View>
          <View style={{flex: 1, alignItems: 'flex-end', borderLeftWidth: 1, borderLeftColor: colors.border}}>
              <Text style={styles.dateLabel}>ASSIGNED TO</Text>
              <Text style={[styles.dateValue, {color: colors.textMain}]} numberOfLines={1}>{assignedName}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={{flex: 1}}>
              <Text style={{color: colors.textSub, fontSize: 11, fontWeight: '600'}}>
                 Started: {item.startingDate ? new Date(item.startingDate).toLocaleDateString() : 'N/A'}
              </Text>
          </View>
          
          <View style={styles.actionContainer}>
            {/* 🚀 NEW: TRACKING EYE BUTTON */}
            {(canViewAll || canViewSelf) && (
                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: isLightMode ? '#EFF6FF' : 'rgba(59,130,246,0.15)', marginRight: 8}]} onPress={() => {
                    setCurrentActivities(item.activities || []);
                    setCurrentLeadDates({ start: item.startingDate, end: item.endingDate });
                    setShowActivitiesModal(true);
                }}>
                    <Feather name="eye" size={16} color="#3B82F6" />
                </TouchableOpacity>
            )}

            {canUpdate && (
                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: isLightMode ? '#F1F5F9' : '#334155', marginRight: 8}]} onPress={() => {
                   const empIdForAssign = typeof item.assignTo === 'object' ? item.assignTo?._id : item.assignTo;

                   setFormData({
                    _id: item._id, 
                    name: item.name || '', 
                    phone: item.phoneNumber || item.phone || item.mobile || '',
                    email: item.email || '', 
                    status: item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Pending', 
                    assignTo: empIdForAssign || '', 
                    assignToName: assignedName !== '---' ? assignedName : 'Select Employee', 
                    startingDate: item.startingDate ? item.startingDate.split('T')[0] : '', 
                    endingDate: item.endingDate ? item.endingDate.split('T')[0] : '', 
                    remarks: item.remarks || ''
                   });
                   setIsEditing(true); setIsModalVisible(true);
                }}>
                    <Feather name="edit-2" size={16} color={colors.textMain} />
                </TouchableOpacity>
            )}
            
            {canDelete && (
                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: isLightMode ? '#FEE2E2' : '#7F1D1D'}]} onPress={() => handleDelete(item._id, item.name)}>
                  <Feather name="trash-2" size={16} color="#EF4444" />
                </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} backgroundColor="transparent" translucent={true} />
      
      <View style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg }}>
        <GlobalAppBar navigation={navigation} showSearch={true} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <View style={styles.pageHeader}>
          <View style={{ flex: 1 }}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <MaterialCommunityIcons name="account-multiple-plus" size={26} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.pageTitle, { color: colors.textMain }]}>Leads</Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.textSub }]}>{canViewAll ? "Manage sales leads and follow ups" : "Your assigned leads"}</Text>
          </View>
          
          {canCreate && (
              <TouchableOpacity style={styles.applyBtn} onPress={() => { 
                  setIsEditing(false); 
                  setFormData({ _id: '', name: '', phone: '', email: '', status: 'Pending', assignTo: '', assignToName: 'Select Employee', startingDate: new Date().toISOString().split('T')[0], endingDate: '', remarks: ''});
                  setIsModalVisible(true); 
              }}>
                <MaterialCommunityIcons name="plus" size={16} color="#fff" style={{marginRight: 4}} />
                <Text style={styles.applyBtnText}>New</Text>
              </TouchableOpacity>
          )}
        </View>

        {(canViewAll || canViewSelf) && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiWrapper} contentContainerStyle={{paddingVertical: 5}}>
              <View style={[styles.kpiCard, { backgroundColor: colors.cardBg, borderLeftColor: '#3B82F6' }]}>
                <View style={styles.kpiLabelRow}>
                    <MaterialCommunityIcons name="layers" size={16} color="#3B82F6" style={{marginRight: 6}} />
                    <Text style={styles.kpiLabel}>Total</Text>
                </View>
                <Text style={[styles.kpiVal, { color: colors.textMain }]}>{totalLeads}</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBg, borderLeftColor: '#10B981' }]}>
                <View style={styles.kpiLabelRow}>
                    <MaterialCommunityIcons name="check-decagram" size={16} color="#10B981" style={{marginRight: 6}} />
                    <Text style={styles.kpiLabel}>Success</Text>
                </View>
                <Text style={[styles.kpiVal, { color: colors.textMain }]}>{successLeads}</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBg, borderLeftColor: '#F59E0B' }]}>
                <View style={styles.kpiLabelRow}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color="#F59E0B" style={{marginRight: 6}} />
                    <Text style={styles.kpiLabel}>Pending</Text>
                </View>
                <Text style={[styles.kpiVal, { color: colors.textMain }]}>{pendingLeads}</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBg, borderLeftColor: '#EF4444' }]}>
                <View style={styles.kpiLabelRow}>
                    <MaterialCommunityIcons name="close-circle-outline" size={16} color="#EF4444" style={{marginRight: 6}} />
                    <Text style={styles.kpiLabel}>Lost</Text>
                </View>
                <Text style={[styles.kpiVal, { color: colors.textMain }]}>{lostLeads}</Text>
              </View>
            </ScrollView>
        )}

        {loading && !refreshing ? (
            <ActivityIndicator size="large" color={colors.primary} style={{marginTop: 50}} />
        ) : (
            filteredLeads.map(lead => renderLeadCard({ item: lead }))
        )}

        {!loading && filteredLeads.length === 0 && (
            <View style={styles.emptyContainer}>
               <MaterialCommunityIcons name="inbox" size={60} color={colors.border} />
               <Text style={styles.emptyText}>{searchQuery ? 'No leads found matching your search.' : (canCreate ? "No leads found. Click 'Add Lead' to create one." : "No leads assigned to you.")}</Text>
            </View>
        )}
      </ScrollView>

      {/* 🚀 TRACKING / ACTIVITIES MODAL */}
      <Modal visible={showActivitiesModal} transparent animationType="fade">
        <View style={styles.calOverlay}>
          <View style={[styles.dropdownList, { backgroundColor: colors.cardBg, borderColor: colors.border, width: '90%', maxHeight: '80%', padding: 20 }]}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: colors.textMain }}>Tracking</Text>
                  <TouchableOpacity onPress={() => setShowActivitiesModal(false)}>
                      <MaterialCommunityIcons name="close" size={24} color={colors.textSub} />
                  </TouchableOpacity>
              </View>
              
              <ScrollView showsVerticalScrollIndicator={false}>
                  {/* START NODE */}
                  <View style={{flexDirection: 'row'}}>
                      <View style={{alignItems: 'center', width: 30}}>
                          <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6', marginTop: 4}} />
                          <View style={{width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 4, minHeight: 20}} />
                      </View>
                      <View style={{flex: 1, paddingBottom: 20}}>
                          <Text style={{fontSize: 12, color: colors.textSub, fontWeight: 'bold'}}>{currentLeadDates.start ? new Date(currentLeadDates.start).toLocaleDateString([], {day: 'numeric', month: 'numeric', year: 'numeric'}) : 'N/A'}</Text>
                          <Text style={{fontSize: 14, color: colors.textMain, fontWeight: '600'}}>Start</Text>
                      </View>
                  </View>

                  {/* ACTIVITIES NODES */}
                  {currentActivities.length === 0 ? (
                      <View style={{flexDirection: 'row'}}>
                          <View style={{alignItems: 'center', width: 30}}>
                              <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border, marginTop: 4}} />
                              <View style={{width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 4, minHeight: 20}} />
                          </View>
                          <View style={{flex: 1, paddingBottom: 20}}>
                              <Text style={{fontSize: 13, color: colors.textSub, fontStyle: 'italic'}}>No activities yet.</Text>
                          </View>
                      </View>
                  ) : (
                      currentActivities.map((act, index) => (
                          <View key={act._id || index} style={{flexDirection: 'row'}}>
                              <View style={{alignItems: 'center', width: 30}}>
                                  <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', marginTop: 4}} />
                                  <View style={{width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 4, minHeight: 20}} />
                              </View>
                              <View style={{flex: 1, paddingBottom: 20}}>
                                  <Text style={{fontSize: 12, color: colors.textSub, fontWeight: 'bold'}}>
                                      {new Date(act.createdAt).toLocaleString([], {day: 'numeric', month: 'numeric', year: 'numeric'})} ({new Date(act.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                                  </Text>
                                  <Text style={{fontSize: 14, color: colors.textMain, marginTop: 2}}>
                                      <Text style={{fontWeight: '900', textTransform: 'lowercase'}}>{act.type || 'other'}</Text> — {act.note}
                                  </Text>
                              </View>
                          </View>
                      ))
                  )}

                  {/* END NODE */}
                  <View style={{flexDirection: 'row'}}>
                      <View style={{alignItems: 'center', width: 30}}>
                          <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', marginTop: 4}} />
                      </View>
                      <View style={{flex: 1}}>
                          <Text style={{fontSize: 12, color: colors.textSub, fontWeight: 'bold'}}>{currentLeadDates.end ? new Date(currentLeadDates.end).toLocaleDateString([], {day: 'numeric', month: 'numeric', year: 'numeric'}) : '---'}</Text>
                          <Text style={{fontSize: 14, color: colors.textMain, fontWeight: '600'}}>End</Text>
                      </View>
                  </View>
              </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 🚀 ADD/EDIT LEAD MODAL */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
       <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.mOverlay}
        >
          <View style={[styles.mCard, { backgroundColor: colors.cardBg }]}>
            
            <View style={[styles.mHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.mTitle, {color: colors.textMain}]}>{isEditing ? 'Edit Lead' : 'Add Lead'}</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}><MaterialCommunityIcons name="close" size={24} color={colors.textSub}/></TouchableOpacity>
            </View>

           <ScrollView 
              showsVerticalScrollIndicator={false} 
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 24, paddingBottom: 20 }} 
           >
              
              <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Name *</Text>
              <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.name} onChangeText={(t)=>setFormData({...formData, name:t})} placeholderTextColor={colors.textSub} placeholder="Lead Name"/>

              <View style={{flexDirection: 'row', justifyContent:'space-between', marginTop: 15}}>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Status *</Text>
                    <TouchableOpacity style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => setShowStatusModal(true)}>
                        <Text style={{color: colors.textMain, textTransform:'capitalize'}}>{formData.status}</Text>
                        <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSub} />
                    </TouchableOpacity>
                  </View>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Phone</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.phone} onChangeText={(t)=>setFormData({...formData, phone:t})} keyboardType="phone-pad" placeholderTextColor={colors.textSub} placeholder="1234567890"/>
                  </View>
              </View>

              <View style={{flexDirection: 'row', justifyContent:'space-between', marginTop: 15}}>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Email</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.email} onChangeText={(t)=>setFormData({...formData, email:t})} keyboardType="email-address" placeholderTextColor={colors.textSub} placeholder="mail@example.com" autoCapitalize="none"/>
                  </View>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Assign To</Text>
                    {canViewAll ? (
                        <TouchableOpacity style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => setShowAssignModal(true)}>
                            <Text style={{color: colors.textMain}} numberOfLines={1}>{formData.assignToName}</Text>
                            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSub} />
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border, justifyContent: 'center'}]}>
                            <Text style={{color: colors.textSub}} numberOfLines={1}>{formData.assignToName}</Text>
                        </View>
                    )}
                  </View>
              </View>

              <View style={{flexDirection: 'row', justifyContent:'space-between', marginTop: 15}}>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Starting Date</Text>
                    <TouchableOpacity style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => setShowStartDatePicker(true)}>
                      <Text style={{color: colors.textMain}}>{formData.startingDate || 'Select'}</Text>
                      <MaterialCommunityIcons name="calendar" size={20} color={colors.textSub} />
                    </TouchableOpacity>
                  </View>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Ending Date</Text>
                    <TouchableOpacity style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => setShowEndDatePicker(true)}>
                      <Text style={{color: colors.textMain}}>{formData.endingDate || 'Select'}</Text>
                      <MaterialCommunityIcons name="calendar" size={20} color={colors.textSub} />
                    </TouchableOpacity>
                  </View>
              </View>

              <Text style={[styles.inputLabel, {color: colors.textSub}]}>Remarks</Text>
              <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain, height: 80, textAlignVertical: 'top', paddingTop: 12}]} multiline value={formData.remarks} onChangeText={(t)=>setFormData({...formData, remarks:t})} placeholderTextColor={colors.textSub} placeholder="Enter any notes or remarks here..."/>

              {showStartDatePicker && (<DateTimePicker value={formData.startingDate ? new Date(formData.startingDate) : new Date()} mode="date" display="default" onChange={handleStartDateChange}/>)}
              {showEndDatePicker && (<DateTimePicker value={formData.endingDate ? new Date(formData.endingDate) : new Date()} mode="date" display="default" onChange={handleEndDateChange}/>)}
            </ScrollView>

            <View style={styles.modalFooterRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalVisible(false)}>
                <Text style={[styles.cancelBtnText, {color: colors.textSub}]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.subBtn, {backgroundColor: colors.primary}]} onPress={submitForm} disabled={formLoading}>
                {formLoading ? <ActivityIndicator color="#fff" size="small"/> : <Text style={styles.subBtnText}>{isEditing ? 'Update' : 'Save'}</Text>}
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>
      
      <DropdownModal visible={showStatusModal} onClose={() => setShowStatusModal(false)} title="Select Status" options={STATUS_OPTIONS} selectedValue={formData.status} onSelect={(v: any) => setFormData({...formData, status:v})} colors={colors} styles={styles} />
      <DropdownModal visible={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign To" options={employeeOptions} selectedValue={formData.assignToName} onSelect={handleEmployeeSelect} colors={colors} styles={styles} />
      
    </SafeAreaView>
  );
}

const DropdownModal = ({ visible, onClose, title, options, onSelect, selectedValue, colors, styles }: any) => (
  <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.calOverlay} onPress={onClose} activeOpacity={1}>
          <View style={[styles.dropdownList, { backgroundColor: colors.cardBg, borderColor: colors.border, width: '90%', maxHeight: 400 }]}>
              <Text style={{ padding: 18, fontSize: 16, fontWeight: '900', borderBottomWidth: 1, borderBottomColor: colors.border, color: colors.textMain }}>{title}</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {options.map((opt: string, index: number) => (
                  <TouchableOpacity key={index} style={{padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border}} onPress={() => { onSelect(opt); onClose(); }}>
                      <Text style={{ color: selectedValue === opt ? colors.primary : colors.textMain, fontWeight: selectedValue === opt ? '800' : '600', fontSize: 15, textTransform: 'capitalize' }}>{opt}</Text>
                  </TouchableOpacity>
              ))}</ScrollView>
          </View>
      </TouchableOpacity>
  </Modal>
);

const getDynamicStyles = (colors: any, isLightMode: boolean) => {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 16, paddingBottom: 40 },
    
    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 5 },
    pageTitle: { fontSize: 24, fontWeight: 'bold' },
    subtitle: { fontSize: 13, marginTop: 4, marginLeft: 34 },
    applyBtn: { backgroundColor: '#3B82F6', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, elevation: 3 },
    applyBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
    
    kpiWrapper: { flexDirection: 'row', marginBottom: 20 },
    kpiCard: { width: 120, padding: 15, borderRadius: 12, marginRight: 12, borderLeftWidth: 4, elevation: 2 },
    kpiLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    kpiVal: { fontSize: 22, fontWeight: '900', marginTop: 5 },
    kpiLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748B' },

    card: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12, elevation: 1 },

    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    avatarBox: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    leadName: { fontWeight: 'bold', fontSize: 16, marginBottom: 2 },
    leadEmail: { fontSize: 12, fontWeight: '600' },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    statusText: { fontSize: 10, fontWeight: '800', textTransform:'uppercase' },
    dateBox: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 16, justifyContent: 'space-between' },
    dateLabel: { fontSize: 9, color: '#64748B', marginBottom: 4, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    dateValue: { fontSize: 13, fontWeight: 'bold' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    actionContainer: { minWidth: 60, alignItems: 'flex-end', justifyContent: 'center', flexDirection: 'row' },
    actionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    
    emptyContainer: { alignItems: 'center', marginTop: 60 },
    emptyText: { textAlign: 'center', marginTop: 15, fontSize: 15, fontWeight: '600', paddingHorizontal: 20, color: colors.textSub },

    mOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-end', margin: 0, padding: 0, zIndex: 10 },
    mCard: {
      width: '100%',
      maxHeight: '90%', 
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingBottom: Platform.OS === 'ios' ? 20 : 0,
      alignSelf: 'center',
    },    
    mHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, padding: 24, paddingBottom: 16 },
    mTitle: { fontSize: 20, fontWeight: '900' },
    inputLabel: { fontSize: 12, fontWeight: '800', marginBottom: 8, marginTop: 12, color: '#64748B' },
    dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, height: 48 },
    inputObj: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 14, fontWeight: '600' },
    modalFooterRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', padding: 24, borderTopWidth: 1, borderColor: '#F1F5F9', marginTop: 10 },
    cancelBtn: { paddingVertical: 12, paddingHorizontal: 20, marginRight: 10 },
    cancelBtnText: { fontWeight: '800', fontSize: 14 },
    subBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 100 },
    subBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
    
    calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 1000 },
    dropdownList: { position: 'relative', borderWidth: 1, borderRadius: 16, elevation: 5, overflow: 'hidden' }
  });
};