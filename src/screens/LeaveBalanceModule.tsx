import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, 
  ActivityIndicator, Alert, Modal, StatusBar, Platform, RefreshControl, TextInput, KeyboardAvoidingView
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme';
import GlobalAppBar from '../components/GlobalAppBar'; 
import { API_BASE } from '../api/api';

export default function LeaveBalanceModule({ navigation }: any) {
  const { colors, isLightMode } = useTheme();
  
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balances, setBalances] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Form States
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editRecordId, setEditRecordId] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [showEmpModal, setShowEmpModal] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    employeeId: '',
    employeeName: 'Select Employee',
    employeeType: 'full-time',
    year: new Date().getFullYear().toString(),
    earnedTotal: '12', earnedUsed: '0',
    sickTotal: '4', sickUsed: '0',
    casualTotal: '0', casualUsed: '0',
    emergencyUsed: '0', unpaidUsed: '0',
    probationPeriodTime: '0',
    provisionalLeaveForMonth: '0',
    provisionalTotal: '0', provisionalUsed: '0'
  });

  // 🚀 ACTION PERMISSION CHECKER
  const canDo = (action: string) => permissions.includes(`LEAVE_BALANCE:${action.toUpperCase()}`);

  useFocusEffect(useCallback(() => {
    initScreen();
  }, []));

  const initScreen = async () => {
    setLoading(true);
    const permsStr = await AsyncStorage.getItem('userPermissions');
    const pArray = permsStr ? JSON.parse(permsStr).map((p: string) => p.toUpperCase()) : [];
    setPermissions(pArray);
    
    if (pArray.includes('LEAVE_BALANCE:CREATE') || pArray.includes('LEAVE_BALANCE:UPDATE')) {
        await fetchEmployees();
    }
    await fetchBalances(false, pArray);
  };

  const fetchEmployees = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(`${API_BASE}/employees?limit=500`, { headers: { Authorization: `Bearer ${token}` } });
      setAllEmployees((res.data?.data?.data || res.data?.data || []).filter((e:any) => !e.isDeleted));
    } catch (e) {
      console.log("Error fetching employees", e);
    }
  };

  const fetchBalances = async (isSilent = false, currentPerms = permissions) => {
    try {
      if (!isSilent) setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      
      const canViewAll = currentPerms.includes('LEAVE_BALANCE:VIEW');
      const url = canViewAll 
          ? `${API_BASE}/leave-balances?limit=500&_t=${Date.now()}` 
          : `${API_BASE}/leave-balances/self?limit=500&_t=${Date.now()}`;

      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      let data = res.data?.data || [];
      data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setBalances(data);
    } catch (e) {
      console.log("Fetch Error:", e);
    } finally { 
      setLoading(false); setRefreshing(false); 
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBalances(true);
  };

  const saveBalance = async () => {
    if (!formData.employeeId || !formData.year.trim()) {
        return Alert.alert("Validation", "Employee and Year are required.");
    }

    try {
      setFormLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const payload: any = {
        employeeId: formData.employeeId,
        year: formData.year,
        emergency: { used: Number(formData.emergencyUsed) || 0 },
        unpaid: { used: Number(formData.unpaidUsed) || 0 }
      };

      if (formData.employeeType === 'provisional') {
          payload.probationPeriodTime = Number(formData.probationPeriodTime) || 0;
          payload.provisionalLeaveForMonth = Number(formData.provisionalLeaveForMonth) || 0;
          payload.provisional = { total: Number(formData.provisionalTotal) || 0, used: Number(formData.provisionalUsed) || 0 };
      } else {
          payload.earned = { total: Number(formData.earnedTotal) || 0, used: Number(formData.earnedUsed) || 0 };
          payload.sick = { total: Number(formData.sickTotal) || 0, used: Number(formData.sickUsed) || 0 };
          payload.casual = { total: Number(formData.casualTotal) || 0, used: Number(formData.casualUsed) || 0 };
      }

      if (isEditing) {
          await axios.put(`${API_BASE}/leave-balances/${editRecordId}`, payload, config);
      } else {
          await axios.post(`${API_BASE}/leave-balances`, payload, config);
      }
      
      setIsModalVisible(false);
      fetchBalances(true);
      Alert.alert("Success", `Leave Balance ${isEditing ? 'updated' : 'created'} successfully!`);
    } catch (err: any) { 
        Alert.alert("Error", err.response?.data?.message || "Failed to save record."); 
    } finally { 
        setFormLoading(false); 
    }
  };

  const deleteBalance = (id: string) => {
    Alert.alert("Delete Balance", "Are you sure you want to delete this record?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            try {
                const token = await AsyncStorage.getItem('userToken');
                await axios.delete(`${API_BASE}/leave-balances/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                fetchBalances(true);
            } catch (e) {
                Alert.alert("Error", "Failed to delete record.");
            }
        }}
    ]);
  };

  const openAddModal = () => {
      setIsEditing(false);
      setEditRecordId('');
      setFormData({
        employeeId: '',
        employeeName: 'Select Employee',
        employeeType: 'full-time',
        year: new Date().getFullYear().toString(),
        earnedTotal: '12', earnedUsed: '0',
        sickTotal: '4', sickUsed: '0',
        casualTotal: '0', casualUsed: '0',
        emergencyUsed: '0', unpaidUsed: '0',
        probationPeriodTime: '0',
        provisionalLeaveForMonth: '0',
        provisionalTotal: '0', provisionalUsed: '0'
      });
      setIsModalVisible(true);
  };

  const openEditModal = (item: any) => {
      setIsEditing(true);
      setEditRecordId(item._id);
      
      const empType = item.employeeId?.employeeType || 'full-time';
      
      setFormData({
        employeeId: item.employeeId?._id || '',
        employeeName: item.employeeId ? `${item.employeeId.userId?.firstName || ''} ${item.employeeId.userId?.lastName || ''}`.trim() : 'Unknown',
        employeeType: empType,
        year: String(item.year || new Date().getFullYear()),
        earnedTotal: String(item.earned?.total || '0'), earnedUsed: String(item.earned?.used || '0'),
        sickTotal: String(item.sick?.total || '0'), sickUsed: String(item.sick?.used || '0'),
        casualTotal: String(item.casual?.total || '0'), casualUsed: String(item.casual?.used || '0'),
        emergencyUsed: String(item.emergency?.used || '0'), unpaidUsed: String(item.unpaid?.used || '0'),
        probationPeriodTime: String(item.probationPeriodTime || '0'),
        provisionalLeaveForMonth: String(item.provisionalLeaveForMonth || '0'),
        provisionalTotal: String(item.provisional?.total || '0'), provisionalUsed: String(item.provisional?.used || '0')
      });
      setIsModalVisible(true);
  };

  const filteredBalances = balances.filter(item => {
      const searchStr = searchQuery.toLowerCase();
      const matchName = item.employeeId ? `${item.employeeId.userId?.firstName} ${item.employeeId.userId?.lastName}`.toLowerCase().includes(searchStr) : false;
      const matchYear = String(item.year).includes(searchStr);
      return matchName || matchYear;
  });

  // 🚀 LOGIC: Remove employees from dropdown if they ALREADY have a balance for the selected year
  const availableEmployeesForDropdown = allEmployees.filter(emp => {
      const alreadyHasBalanceForSelectedYear = balances.some(b => 
          (b.employeeId?._id === emp._id || b.employeeId === emp._id) && 
          String(b.year) === String(formData.year)
      );
      // Agar pehle se balance hai us saal ka, toh hide kardo
      return !alreadyHasBalanceForSelectedYear;
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
              <Text style={[styles.title, {color: colors.textMain}]}>Leave Balance</Text>
              <Text style={{color: colors.textSub, fontSize: 12, marginTop: 2}}>Manage all Leave Balance - {filteredBalances.length} shown</Text>
            </View>
            {canDo('CREATE') && (
                <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
                    <Feather name="plus" size={16} color="#FFF" />
                    <Text style={styles.addBtnText}>Add Balance</Text>
                </TouchableOpacity>
            )}
        </View>

        {loading && !refreshing ? <ActivityIndicator size="large" color="#3B82F6" style={{marginTop: 50}}/> : filteredBalances.map((item, index) => {
            const empName = item.employeeId ? `${item.employeeId.userId?.firstName || ''} ${item.employeeId.userId?.lastName || ''}`.trim() : 'Unknown';
            const email = item.employeeId?.userId?.email || 'N/A';
            const empType = item.employeeId?.employeeType?.toLowerCase() === 'provisional' ? 'provisional' : 'full-time';
            const isProv = empType === 'provisional';

            return (
            <View key={index} style={[styles.card, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                <View style={styles.cardHeader}>
                    <View style={styles.userInfo}>
                        <View style={styles.avatar}><Text style={styles.avatarText}>{empName.charAt(0).toUpperCase()}</Text></View>
                        <View style={{flex: 1}}>
                            <Text style={[styles.userName, {color: colors.textMain}]} numberOfLines={1}>{empName}</Text>
                            <Text style={styles.userSub} numberOfLines={1}>{email}</Text>
                        </View>
                    </View>
                    <View style={{alignItems: 'flex-end'}}>
                        <View style={[styles.typeBadge, {backgroundColor: isProv ? '#E0F2FE' : '#DCFCE7'}]}>
                            <Text style={[styles.typeBadgeText, {color: isProv ? '#0EA5E9' : '#16A34A'}]}>{empType}</Text>
                        </View>
                        <Text style={[styles.yearText, {color: colors.textMain}]}>{item.year}</Text>
                    </View>
                </View>

                <View style={[styles.statsGrid, {borderTopColor: colors.border}]}>
                    <StatBox label="EARNED" used={isProv ? 'N/A' : item.earned?.used} total={isProv ? 'N/A' : item.earned?.total} colors={colors} />
                    <StatBox label="SICK" used={isProv ? 'N/A' : item.sick?.used} total={isProv ? 'N/A' : item.sick?.total} colors={colors} />
                    <StatBox label="CASUAL" used={isProv ? 'N/A' : item.casual?.used} total={isProv ? 'N/A' : item.casual?.total} colors={colors} />
                    {isProv && <StatBox label="PROVISIONAL" used={item.provisional?.used} total={item.provisional?.total} colors={colors} />}
                    <StatBox label="EMERGENCY" used={item.emergency?.used} total={null} isSingle colors={colors} />
                    <StatBox label="UNPAID" used={item.unpaid?.used} total={null} isSingle colors={colors} />
                </View>

                {/* 🚀 ACTION BUTTONS: Rendered securely based on Permissions */}
                {(canDo('UPDATE') || canDo('DELETE')) && (
                    <View style={[styles.actionRow, {borderTopColor: colors.border}]}>
                        {canDo('UPDATE') && (
                            <TouchableOpacity style={[styles.actionBtn, {backgroundColor: colors.primary + '15'}]} onPress={() => openEditModal(item)}>
                                <Feather name="edit-2" size={15} color={colors.primary} />
                                <Text style={[styles.actionBtnText, {color: colors.primary}]}>Edit</Text>
                            </TouchableOpacity>
                        )}
                        {canDo('DELETE') && (
                            <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#FEE2E2', marginLeft: 10}]} onPress={() => deleteBalance(item._id)}>
                                <Feather name="trash-2" size={15} color="#DC2626" />
                                <Text style={[styles.actionBtnText, {color: '#DC2626'}]}>Delete</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        )})}

        {!loading && filteredBalances.length === 0 && (
            <View style={{alignItems: 'center', marginTop: 50}}>
                <Feather name="inbox" size={50} color={colors.border} />
                <Text style={{ textAlign: 'center', color: colors.textSub, marginTop: 12, fontSize: 14, fontWeight: '600' }}>No balance records found.</Text>
            </View>
        )}
      </ScrollView>

      {/* --- ADD/EDIT MODAL --- */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={styles.modalNav}>
                    <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.textMain}}>{isEditing ? 'Edit Leave Balance' : 'Add Leave Balance'}</Text>
                    <TouchableOpacity onPress={() => setIsModalVisible(false)}><Feather name="x" size={24} color={colors.textMain}/></TouchableOpacity>
                </View>

                <ScrollView style={{padding: 20}} showsVerticalScrollIndicator={false}>
                    
                    <View style={styles.rowInput}>
                        <View style={{flex: 1, marginRight: 10}}>
                            <Text style={styles.label}>Employee *</Text>
                            <TouchableOpacity style={[styles.inputBox, {borderColor: colors.border, backgroundColor: isEditing ? (isLightMode ? '#F1F5F9' : '#334155') : colors.background}]} onPress={() => !isEditing && setShowEmpModal(true)} disabled={isEditing}>
                                <Text style={{color: colors.textMain}} numberOfLines={1}>{formData.employeeName}</Text>
                                {!isEditing && <Feather name="chevron-down" size={16} color={colors.textSub} />}
                            </TouchableOpacity>
                        </View>
                        <View style={{flex: 0.5}}>
                            <Text style={styles.label}>Year *</Text>
                            <TextInput 
                                style={[styles.input, {borderColor: colors.border, color: colors.textMain, backgroundColor: colors.background}]} 
                                value={formData.year} onChangeText={t => setFormData({...formData, year: t})} keyboardType="numeric"
                            />
                        </View>
                    </View>

                    {formData.employeeType === 'full-time' ? (
                        <>
                            <View style={styles.rowInput}>
                                <View style={{flex: 1, marginRight: 10}}><Text style={styles.label}>Total Earned Leave</Text><TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} value={formData.earnedTotal} onChangeText={t => setFormData({...formData, earnedTotal: t})} keyboardType="numeric"/></View>
                                <View style={{flex: 1}}><Text style={styles.label}>Used Earned Leave</Text><TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} value={formData.earnedUsed} onChangeText={t => setFormData({...formData, earnedUsed: t})} keyboardType="numeric"/></View>
                            </View>
                            <View style={styles.rowInput}>
                                <View style={{flex: 1, marginRight: 10}}><Text style={styles.label}>Total Sick Leave</Text><TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} value={formData.sickTotal} onChangeText={t => setFormData({...formData, sickTotal: t})} keyboardType="numeric"/></View>
                                <View style={{flex: 1}}><Text style={styles.label}>Used Sick Leave</Text><TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} value={formData.sickUsed} onChangeText={t => setFormData({...formData, sickUsed: t})} keyboardType="numeric"/></View>
                            </View>
                            <View style={styles.rowInput}>
                                <View style={{flex: 1, marginRight: 10}}><Text style={styles.label}>Total Casual Leave</Text><TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} value={formData.casualTotal} onChangeText={t => setFormData({...formData, casualTotal: t})} keyboardType="numeric"/></View>
                                <View style={{flex: 1}}><Text style={styles.label}>Used Casual Leave</Text><TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} value={formData.casualUsed} onChangeText={t => setFormData({...formData, casualUsed: t})} keyboardType="numeric"/></View>
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={styles.rowInput}>
                                <View style={{flex: 1, marginRight: 10}}><Text style={styles.label}>Probation Period (Months)</Text><TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} value={formData.probationPeriodTime} onChangeText={t => setFormData({...formData, probationPeriodTime: t})} keyboardType="numeric"/></View>
                                <View style={{flex: 1}}><Text style={styles.label}>Provisional Leave / Month</Text><TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} value={formData.provisionalLeaveForMonth} onChangeText={t => setFormData({...formData, provisionalLeaveForMonth: t})} keyboardType="numeric"/></View>
                            </View>
                            <View style={styles.rowInput}>
                                <View style={{flex: 1, marginRight: 10}}><Text style={styles.label}>Total Provisional</Text><TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} value={formData.provisionalTotal} onChangeText={t => setFormData({...formData, provisionalTotal: t})} keyboardType="numeric"/></View>
                                <View style={{flex: 1}}><Text style={styles.label}>Used Provisional</Text><TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} value={formData.provisionalUsed} onChangeText={t => setFormData({...formData, provisionalUsed: t})} keyboardType="numeric"/></View>
                            </View>
                        </>
                    )}

                    <View style={styles.rowInput}>
                        <View style={{flex: 1, marginRight: 10}}><Text style={styles.label}>Used Emergency Leave *</Text><TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} value={formData.emergencyUsed} onChangeText={t => setFormData({...formData, emergencyUsed: t})} keyboardType="numeric"/></View>
                        <View style={{flex: 1}}><Text style={styles.label}>Used Unpaid Leave *</Text><TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} value={formData.unpaidUsed} onChangeText={t => setFormData({...formData, unpaidUsed: t})} keyboardType="numeric"/></View>
                    </View>

                </ScrollView>
                
                <View style={[styles.modalFooter, {borderTopColor: colors.border}]}>
                    <TouchableOpacity style={[styles.submitBtn, {backgroundColor: colors.primary}]} onPress={saveBalance} disabled={formLoading}>
                        {formLoading ? <ActivityIndicator color="#fff"/> : <Text style={{color:'#fff', fontWeight:'bold', fontSize: 16}}>{isEditing ? 'Save Changes' : 'Add Leave Balance'}</Text>}
                    </TouchableOpacity>
                </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 🚀 DROPDOWN: Shows only employees who DO NOT have a balance for the selected year */}
      <DropdownModal 
        visible={showEmpModal} 
        title="Select Employee" 
        data={availableEmployeesForDropdown} 
        displayKey={(i:any) => `${i.userId?.firstName || ''} ${i.userId?.lastName || ''} - (${i.employeeType || 'full-time'})`} 
        onSelect={(v:any) => setFormData({...formData, employeeId: v._id, employeeName: `${v.userId?.firstName || ''} ${v.userId?.lastName || ''}`, employeeType: v.employeeType || 'full-time'})} 
        onClose={()=>setShowEmpModal(false)} colors={colors} 
        emptyMessage={`All available employees already have a balance for ${formData.year}`}
      />

    </SafeAreaView>
  );
}

const StatBox = ({label, used, total, isSingle, colors}: any) => (
    <View style={styles.statBox}>
        <Text style={[styles.statLabel, {color: colors.textSub}]}>{label}</Text>
        <Text style={[styles.statValue, {color: colors.textMain}]}>
            {used === 'N/A' || used === undefined ? 'N/A' : (isSingle ? used : `${used} / ${total}`)}
        </Text>
    </View>
);

const DropdownModal = ({ visible, onClose, title, data, onSelect, displayKey, colors, emptyMessage }: any) => (
  <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
          <View style={[styles.statusSheet, { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[styles.sheetTitle, { color: colors.textMain }]}>{title}</Text>
              <ScrollView style={{maxHeight: 300}}>
                  {data.length === 0 ? (
                      <Text style={{color: colors.textSub, textAlign: 'center', padding: 20}}>{emptyMessage || 'No data found'}</Text>
                  ) : (
                      data.map((item: any, index: number) => (
                          <TouchableOpacity key={index} style={[styles.sheetItem, {borderBottomColor: colors.border}]} onPress={() => { onSelect(item); onClose(); }}>
                              <Text style={[styles.sheetText, { color: colors.textMain }]}>{typeof displayKey === 'function' ? displayKey(item) : item}</Text>
                          </TouchableOpacity>
                      ))
                  )}
              </ScrollView>
          </View>
      </TouchableOpacity>
  </Modal>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '900' },
  addBtn: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13, marginLeft: 6 },
  
  card: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 14, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  userName: { fontSize: 15, fontWeight: 'bold' },
  userSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 4 },
  typeBadgeText: { fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' },
  yearText: { fontSize: 16, fontWeight: '900' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, paddingTop: 15, paddingBottom: 5 },
  statBox: { width: '33%', marginBottom: 10 },
  statLabel: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  statValue: { fontSize: 14, fontWeight: '800', marginTop: 4 },

  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, paddingTop: 12, marginTop: 5 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { fontSize: 12, fontWeight: 'bold', marginLeft: 6 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, maxHeight: '85%', overflow: 'hidden' },
  modalNav: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, alignItems: 'center' },
  modalFooter: { padding: 20, borderTopWidth: 1 },
  submitBtn: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  
  rowInput: { flexDirection: 'row', marginBottom: 15 },
  label: { marginBottom: 6, fontWeight: '600', fontSize: 12, color: '#64748B' },
  input: { borderWidth: 1, height: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 14 },
  inputBox: { borderWidth: 1, height: 48, borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  statusSheet: { padding: 20, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  sheetItem: { paddingVertical: 15, borderBottomWidth: 1 },
  sheetText: { fontSize: 15, textAlign: 'center', textTransform: 'capitalize' }
});