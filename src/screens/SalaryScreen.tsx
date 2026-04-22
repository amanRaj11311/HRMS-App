import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  TouchableOpacity, SafeAreaView, TextInput, Alert, Platform, StatusBar, Modal, Switch, RefreshControl, KeyboardAvoidingView
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme'; 
import GlobalAppBar from '../components/GlobalAppBar'; 

const API_BASE = 'https://hrms.dcstechnosis.com/api'; 

export default function SalaryScreen({ navigation }: any) {
  const { colors, isLightMode } = useTheme(); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [salaries, setSalaries] = useState<any[]>([]);
  
  // For Form Dropdowns
  const [employees, setEmployees] = useState<any[]>([]);
  const [percentages, setPercentages] = useState<any[]>([]);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showPercModal, setShowPercModal] = useState(false);
  
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: '',
    employeeName: 'Select Employee',
    salaryPercentageId: '',
    salaryPercentageName: 'Select Structure',
    grossSalary: '',
    leaveDeduction: '0',
    incentives: '0',
    previousMonthExtraPayAdjustment: '0',
    isOnCTCBasis: false
  });

  const hasPerm = (action: string) => permissions.includes(`SALARY:${action}`);
  const canView = hasPerm('VIEW');
  const canCreate = hasPerm('CREATE');

  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const permsStr = await AsyncStorage.getItem('userPermissions');
      
      // 🚀 FIXED: Convert all permissions to uppercase for strict matching
      const perms = permsStr ? JSON.parse(permsStr).map((p: string) => p.toUpperCase()) : [];
      setPermissions(perms);

      if (perms.includes('SALARY:VIEW')) {
          const config = { headers: { Authorization: `Bearer ${token}` } };
          
          const [salRes, empRes, percRes] = await Promise.all([
              axios.get(`${API_BASE}/salary?limit=100`, config),
              axios.get(`${API_BASE}/employees?limit=200`, config),
              axios.get(`${API_BASE}/salary-percentage?limit=50`, config)
          ]);

          setSalaries(salRes.data?.data?.data || salRes.data?.data || []);
          setEmployees(empRes.data?.data?.data || empRes.data?.data || []);
          setPercentages(percRes.data?.data?.data || percRes.data?.data || []);
      }
    } catch (error) {
      console.log("Salary Fetch Error", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const handleSaveSalary = async () => {
      if (!formData.employeeId || !formData.salaryPercentageId || !formData.grossSalary) {
          return Alert.alert("Required", "Please select an employee, a salary structure, and enter Gross Salary.");
      }
      try {
          setSaveLoading(true);
          const token = await AsyncStorage.getItem('userToken');
          const payload = {
              employeeId: formData.employeeId,
              salaryPercentageId: formData.salaryPercentageId,
              grossSalary: Number(formData.grossSalary),
              leaveDeduction: Number(formData.leaveDeduction),
              incentives: Number(formData.incentives),
              previousMonthExtraPayAdjustment: Number(formData.previousMonthExtraPayAdjustment),
              isOnCTCBasis: formData.isOnCTCBasis
          };

          await axios.post(`${API_BASE}/salary`, payload, { headers: { Authorization: `Bearer ${token}` } });
          Alert.alert("Success", "Salary configured successfully");
          setIsModalVisible(false);
          fetchData(true);
      } catch (err: any) {
          Alert.alert("Error", err.response?.data?.message || "Failed to save salary.");
      } finally {
          setSaveLoading(false);
      }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} translucent backgroundColor="transparent" />
      <View style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg }}>
        <GlobalAppBar navigation={navigation} />
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(true); }} colors={[colors.primary]} />}>
        <View style={styles.header}>
            <View>
              <Text style={[styles.title, {color: colors.textMain}]}>Salary Management</Text>
              <Text style={{color: colors.textSub, fontSize: 12, marginTop: 4}}>Manage all employee salaries</Text>
            </View>
            {canCreate && (
                <TouchableOpacity style={[styles.addBtn, {backgroundColor: colors.primary}]} onPress={() => {
                    setFormData({ employeeId: '', employeeName: 'Select Employee', salaryPercentageId: '', salaryPercentageName: 'Select Structure', grossSalary: '', leaveDeduction: '0', incentives: '0', previousMonthExtraPayAdjustment: '0', isOnCTCBasis: false });
                    setIsModalVisible(true);
                }}>
                    <Feather name="plus" size={16} color="#fff" />
                    <Text style={styles.addBtnText}>Add Salary</Text>
                </TouchableOpacity>
            )}
        </View>

        {loading ? <ActivityIndicator size="large" color={colors.primary} style={{marginTop: 50}} /> : (
            !canView ? (
                <View style={{alignItems: 'center', marginTop: 60}}>
                    <MaterialCommunityIcons name="shield-lock-outline" size={60} color={colors.border} />
                    <Text style={{color: colors.textSub, marginTop: 15, fontWeight: '600'}}>You don't have permission to view Salaries.</Text>
                </View>
            ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginHorizontal: 16}}>
                    <View style={[styles.table, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                        <View style={[styles.tableHeader, {backgroundColor: isLightMode ? '#F1F5F9' : '#1E293B', borderBottomColor: colors.border}]}>
                            <Text style={[styles.th, {width: 160, color: colors.textMain}]}>EMPLOYEE NAME</Text>
                            <Text style={[styles.th, {width: 100, color: colors.textMain}]}>GROSS SALARY</Text>
                            <Text style={[styles.th, {width: 100, color: colors.textMain}]}>CTC (YEARLY)</Text>
                            <Text style={[styles.th, {width: 120, color: colors.textMain}]}>NET PAY</Text>
                            <Text style={[styles.th, {width: 100, color: colors.textMain}]}>CTC BASIS</Text>
                        </View>
                        {salaries.map((item: any, index: number) => (
                            <View key={index} style={[styles.tableRow, {borderBottomColor: colors.border}]}>
                                <Text style={[styles.td, {width: 160, color: colors.primary, fontWeight: '700'}]} numberOfLines={1}>
                                    {item.employeeId?.userId?.firstName} {item.employeeId?.userId?.lastName}
                                </Text>
                                <Text style={[styles.td, {width: 100, color: colors.textMain}]}>₹{item.grossSalary}</Text>
                                <Text style={[styles.td, {width: 100, color: colors.textMain}]}>₹{item.grossSalary * 12}</Text>
                                <Text style={[styles.td, {width: 120, color: '#10B981', fontWeight: '800'}]}>₹{item.netSalary || item.earnedGrossSalary || 0}</Text>
                                <View style={{width: 100, paddingHorizontal: 10}}>
                                    <View style={{backgroundColor: item.isOnCTCBasis ? '#DCFCE7' : '#FEE2E2', paddingVertical: 4, borderRadius: 6, alignItems: 'center'}}>
                                        <Text style={{color: item.isOnCTCBasis ? '#16A34A' : '#EF4444', fontSize: 10, fontWeight: 'bold'}}>
                                            {item.isOnCTCBasis ? 'YES' : 'NO'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                        {salaries.length === 0 && <Text style={{padding: 20, textAlign: 'center', color: colors.textSub}}>No salaries configured yet.</Text>}
                    </View>
                </ScrollView>
            )
        )}
      </ScrollView>

      {/* ADD SALARY MODAL */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
              <View style={[styles.modalContent, {backgroundColor: colors.cardBg}]}>
                  <View style={styles.modalHeader}>
                      <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.textMain}}>Configure Salary</Text>
                      <TouchableOpacity onPress={() => setIsModalVisible(false)}><Feather name="x" size={24} color={colors.textSub} /></TouchableOpacity>
                  </View>
                  <ScrollView style={{padding: 20}}>
                      <Text style={[styles.label, {color: colors.textMain}]}>Employee *</Text>
                      <TouchableOpacity style={[styles.pickerBox, {borderColor: colors.border}]} onPress={() => setShowEmpModal(true)}>
                          <Text style={{color: formData.employeeId ? colors.textMain : colors.textSub, fontWeight: '600'}}>{formData.employeeName}</Text>
                          <Feather name="chevron-down" size={18} color={colors.textSub} />
                      </TouchableOpacity>
                      
                      <Text style={[styles.label, {color: colors.textMain}]}>Salary Structure *</Text>
                      <TouchableOpacity style={[styles.pickerBox, {borderColor: colors.border}]} onPress={() => setShowPercModal(true)}>
                          <Text style={{color: formData.salaryPercentageId ? colors.textMain : colors.textSub, fontWeight: '600'}}>{formData.salaryPercentageName}</Text>
                          <Feather name="chevron-down" size={18} color={colors.textSub} />
                      </TouchableOpacity>
                      
                      <Text style={[styles.label, {color: colors.textMain}]}>Gross Salary (₹) *</Text>
                      <TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} keyboardType="numeric" value={formData.grossSalary} onChangeText={(t) => setFormData({...formData, grossSalary: t})} placeholder="e.g. 50000" placeholderTextColor={colors.textSub} />

                      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, paddingVertical: 10, borderTopWidth: 1, borderColor: colors.border}}>
                          <Text style={{fontWeight: '700', color: colors.textMain}}>Is on CTC Basis?</Text>
                          <Switch value={formData.isOnCTCBasis} onValueChange={(val) => setFormData({...formData, isOnCTCBasis: val})} trackColor={{false: colors.border, true: colors.primary}} />
                      </View>
                      <View style={{height: 40}} />
                  </ScrollView>
                  <View style={[styles.modalFooter, {borderTopColor: colors.border}]}>
                      <TouchableOpacity style={[styles.saveBtn, {backgroundColor: colors.primary}]} onPress={handleSaveSalary} disabled={saveLoading}>
                          {saveLoading ? <ActivityIndicator color="#fff" /> : <Text style={{color: '#fff', fontWeight: 'bold'}}>Save Configuration</Text>}
                      </TouchableOpacity>
                  </View>
              </View>
          </KeyboardAvoidingView>
      </Modal>

      {/* Generic Select Modals */}
      <DropdownModal visible={showEmpModal} onClose={() => setShowEmpModal(false)} title="Select Employee" options={employees.map(e => ({ id: e._id, label: `${e.userId?.firstName} ${e.userId?.lastName}` }))} onSelect={(item: any) => setFormData({...formData, employeeId: item.id, employeeName: item.label})} colors={colors} />
      <DropdownModal visible={showPercModal} onClose={() => setShowPercModal(false)} title="Select Structure" options={percentages.map(p => ({ id: p._id, label: p.name }))} onSelect={(item: any) => setFormData({...formData, salaryPercentageId: item.id, salaryPercentageName: item.label})} colors={colors} />
    </SafeAreaView>
  );
}

const DropdownModal = ({ visible, onClose, title, options, onSelect, colors }: any) => (
  <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.calOverlay} onPress={onClose} activeOpacity={1}>
          <View style={[styles.dropdownList, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Text style={{ padding: 18, fontSize: 16, fontWeight: '900', borderBottomWidth: 1, borderBottomColor: colors.border, color: colors.textMain }}>{title}</Text>
              <ScrollView style={{maxHeight: 300}}>
                {options.map((opt: any, index: number) => (
                  <TouchableOpacity key={index} style={{padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border}} onPress={() => { onSelect(opt); onClose(); }}>
                      <Text style={{ color: colors.textMain, fontWeight: '600', fontSize: 15 }}>{opt.label}</Text>
                  </TouchableOpacity>
              ))}</ScrollView>
          </View>
      </TouchableOpacity>
  </Modal>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 20, fontWeight: '900' },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 6, fontSize: 13 },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 40 },
  tableHeader: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1 },
  th: { fontSize: 11, fontWeight: '800', paddingHorizontal: 12, letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 16, borderBottomWidth: 1, alignItems: 'center' },
  td: { fontSize: 13, paddingHorizontal: 12, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 15 },
  input: { borderWidth: 1, borderRadius: 10, height: 48, paddingHorizontal: 15 },
  pickerBox: { borderWidth: 1, borderRadius: 10, height: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15 },
  modalFooter: { padding: 20, borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  saveBtn: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  dropdownList: { borderWidth: 1, borderRadius: 16, elevation: 5, width: '90%', overflow: 'hidden' }
});