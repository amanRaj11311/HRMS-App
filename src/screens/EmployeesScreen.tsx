import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  TouchableOpacity, SafeAreaView, TextInput, Modal, Alert, Platform, Image, StatusBar, RefreshControl, KeyboardAvoidingView
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme'; 
import GlobalAppBar from '../components/GlobalAppBar'; 
import { API_BASE } from '../api/api';

const DEPARTMENTS = ['Engineering', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'DevOps', 'QA', 'Management'];
const EMPLOYEE_TYPES = ['full-time', 'part-time', 'intern', 'contract'];

const DESIGNATIONS = [
    'Software Developer', 'Senior Developer', 'Tech Lead', 'Project Manager', 
    'HR Manager', 'HR Executive', 'Designer', 'UI/UX Designer', 'DevOps Engineer', 
    'Finance Manager', 'Sales Executive', 'Marketing Manager', 'CEO', 'CTO', 'COO'
];

interface Employee {
  _id: string;
  userId?: { firstName: string; lastName: string; email: string; avatar?: string; role: string; };
  department: string;
  designation: string;
  employeeType: string;
  salary: any; 
  dateOfJoining: string;
  isDeleted?: boolean; 
  phone?: string;
  deviceId?: string;
  aadharNumber?: string;
  panNumber?: string;
  uanNumber?: string;
  esiNumber?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  address?: string;
}

export default function EmployeesScreen({ navigation }: any) {
  const { colors, isLightMode } = useTheme();
  
  const [permissions, setPermissions] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<any[]>([]); 
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false); 
  const [firstName, setFirstName] = useState<string>('User');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDept, setFilterDept] = useState<string>('All Departments');
  const [filterEmpType, setFilterEmpType] = useState<string>('All Types'); // 🚀 FIXED: Status ki jagah Emp Type Filter
  
  const [showFilterDeptModal, setShowFilterDeptModal] = useState(false);
  const [showFilterTypeModal, setShowFilterTypeModal] = useState(false); // 🚀 FIXED: Status modal replaced by Type modal
  
  const [showFormDeptModal, setShowFormDeptModal] = useState(false);
  const [showFormTypeModal, setShowFormTypeModal] = useState(false);
  const [showFormDesigModal, setShowFormDesigModal] = useState(false); 
  const [showFormRoleModal, setShowFormRoleModal] = useState(false); 
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [isCustomDept, setIsCustomDept] = useState(false);
  const [isCustomDesig, setIsCustomDesig] = useState(false);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [formData, setFormData] = useState({
    _id: '', firstName: '', lastName: '', email: '', password: '', 
    phone: '', department: 'Engineering', designation: DESIGNATIONS[0], employeeType: 'full-time', 
    roleId: '', roleName: 'Select Role', salary: '', dateOfJoining: '',
    deviceId: '', aadharNumber: '', panNumber: '', uanNumber: '', esiNumber: '',
    bankName: '', accountNumber: '', ifscCode: '', branchName: '', address: ''
  });

  const hasPerm = (action: string) => {
      return permissions.includes(`EMPLOYEE:${action.toUpperCase()}`);
  };

  const canViewAll = hasPerm('VIEW');
  const canCreate = hasPerm('CREATE');
  const canUpdate = hasPerm('UPDATE');
  const canDelete = hasPerm('DELETE');

  useFocusEffect(
    useCallback(() => {
      initScreen();
    }, [])
  );

  const initScreen = async () => {
    setLoading(true);
    const storedName = await AsyncStorage.getItem('userName');
    const permsStr = await AsyncStorage.getItem('userPermissions');
    
    if (storedName) setFirstName(storedName.split(' ')[0]);
    
    const rawArray = permsStr ? JSON.parse(permsStr) : [];
    const pArray = rawArray.map((p: string) => p.trim().toUpperCase());
    
    setPermissions(pArray);
    
    if (pArray.includes('EMPLOYEE:CREATE') || pArray.includes('EMPLOYEE:UPDATE') || pArray.includes('EMPLOYEE:VIEW')) {
        fetchRoles(); 
    }
    
    fetchData(false, pArray);
  };

  const fetchRoles = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      let res;
      try {
          res = await axios.get(`${API_BASE}/roles`, config);
      } catch (err) {
          res = await axios.get(`${API_BASE}/role`, config);
      }
      
      let fetchedRoles: any[] = [];
      const rd = res.data;

      if (Array.isArray(rd)) fetchedRoles = rd;
      else if (rd?.data && Array.isArray(rd.data)) fetchedRoles = rd.data;
      else if (rd?.data?.data && Array.isArray(rd.data.data)) fetchedRoles = rd.data.data;
      else if (rd?.roles && Array.isArray(rd.roles)) fetchedRoles = rd.roles;
      else if (typeof rd === 'object') {
          Object.values(rd).forEach((val: any) => {
              if (Array.isArray(val)) fetchedRoles = val;
          });
          if (fetchedRoles.length === 0 && rd.data) {
             Object.values(rd.data).forEach((val: any) => {
                 if (Array.isArray(val)) fetchedRoles = val;
             });
          }
      }

      if (fetchedRoles.length > 0) {
          setRoles(fetchedRoles);
      } else {
          setRoles([{ name: 'No Data Found in API' }]);
      }
    } catch (e) {
      setRoles([{ name: 'API Error' }]);
    }
  };

  const fetchData = async (isSilent = false, currentPerms = permissions) => {
    try {
      if (!isSilent) setLoading(true);
      
      const userCanViewAll = currentPerms.includes('EMPLOYEE:VIEW');

      if (!userCanViewAll) {
          setEmployees([]);
          setLoading(false);
          setRefreshing(false);
          return;
      }

      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const res = await axios.get(`${API_BASE}/employees?limit=500`, config);
      const data = res.data?.data?.data || res.data?.data || res.data || [];
      
      const validEmployees = (Array.isArray(data) ? data : []).filter(emp => emp.userId?.role !== 'HR');
      setEmployees(validEmployees);
      
    } catch (err: any) {
      console.log("Fetch Error", err);
    } finally {
      setLoading(false);
      setRefreshing(false); 
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRoles(); 
    fetchData(true);
  };

  const getSafeSalary = (val: any) => {
    if (!val) return '0';
    if (typeof val === 'object') return (val.netSalary || val.basic || '0').toString();
    return val.toString();
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert("Delete Employee", `Are you sure you want to mark ${name} as Inactive?`, [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Yes, Delete", style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('userToken');
            const res = await axios.delete(`${API_BASE}/employees/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            
            if (res.data && res.data.success === false) {
                Alert.alert("Error", res.data.message || "Backend prevented deletion.");
                return;
            }

            setEmployees(prev => prev.map(emp => emp._id === id ? { ...emp, isDeleted: true } : emp));
            Alert.alert("Status Updated", "Employee has been marked as Inactive.");
          } catch (err: any) { 
              Alert.alert("Error", err.response?.data?.message || "Failed to delete."); 
          }
        }
      }
    ]);
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date && event.type === 'set') {
      setSelectedDate(date);
      setFormData({ ...formData, dateOfJoining: date.toISOString().split('T')[0] });
    }
  };

  const submitForm = async () => {
    const isMissingBaseFields = !formData.firstName || !formData.email || !formData.phone || !formData.designation || !formData.department || !formData.employeeType;
    const isMissingNewUserFields = !isEditing && (!formData.roleId || !formData.password);

    if (isMissingBaseFields || isMissingNewUserFields) {
      Alert.alert("Required", "Please fill all mandatory fields marked with (*).");
      return;
    }

    if (!/^[a-zA-Z\s]+$/.test(formData.firstName)) return Alert.alert("Validation Error", "First Name can only contain letters.");
    if (formData.lastName && !/^[a-zA-Z\s]+$/.test(formData.lastName)) return Alert.alert("Validation Error", "Last Name can only contain letters.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return Alert.alert("Validation Error", "Please enter a valid email address.");
    if (!/^\d{10}$/.test(formData.phone)) return Alert.alert("Validation Error", "Phone number must be exactly 10 digits.");
    if (formData.salary && !/^\d+$/.test(formData.salary)) return Alert.alert("Validation Error", "Salary can only contain numbers.");
    if (formData.aadharNumber && !/^\d{12}$/.test(formData.aadharNumber)) return Alert.alert("Validation Error", "Aadhaar number must be exactly 12 digits.");
    if (formData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(formData.panNumber)) return Alert.alert("Validation Error", "Please enter a valid PAN number (e.g., ABCDE1234F).");
    if (formData.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(formData.ifscCode)) return Alert.alert("Validation Error", "Please enter a valid IFSC code.");

    try {
      setFormLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const payload: any = { 
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          department: formData.department,
          designation: formData.designation,
          employeeType: formData.employeeType,
          
          deviceId: formData.deviceId,
          aadharNumber: formData.aadharNumber,
          panNumber: formData.panNumber,
          uanNumber: formData.uanNumber,
          esiNumber: formData.esiNumber,
          bankName: formData.bankName,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
          branchName: formData.branchName,
          address: formData.address
      };

      if (formData.roleId) payload.roleId = formData.roleId;
      if (formData.password) payload.password = formData.password; 
      if (formData.salary) payload.salary = Number(formData.salary);
      if (formData.dateOfJoining) payload.dateOfJoining = formData.dateOfJoining;
      
      let res;
      if (isEditing) {
        res = await axios.put(`${API_BASE}/employees/${formData._id}`, payload, config);
      } else {
        res = await axios.post(`${API_BASE}/employees`, payload, config);
      }

      if (res.data && (res.data.success === false || res.data.status === 'error')) {
          Alert.alert("Save Failed", res.data.message || "Backend validation failed.");
          setFormLoading(false);
          return;
      }

      setIsModalVisible(false);
      await fetchData(true);
      Alert.alert("Success", `Employee ${isEditing ? 'updated' : 'added'} successfully.`);
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to save employee. Please check data.");
    } finally { setFormLoading(false); }
  };

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.userId?.firstName || ''} ${emp.userId?.lastName || ''}`.toLowerCase();
    const searchLow = (searchQuery || '').toLowerCase();
    
    // 🚀 FIXED: New Filter Logic for Employee Type instead of Status
    const matchesSearch = fullName.includes(searchLow) || (emp.userId?.email || '').toLowerCase().includes(searchLow);
    const matchesDept = filterDept === 'All Departments' || emp.department === filterDept;
    const matchesType = filterEmpType === 'All Types' || (emp.employeeType || '').toLowerCase() === filterEmpType.toLowerCase();
    
    return matchesSearch && matchesDept && matchesType;
  });

  const roleOptions = roles.length > 0 
      ? roles.map(r => r.name || r.roleName || r.title || r.role || 'Unnamed Role') 
      : ['Wait... Loading Roles'];

  const filterDeptOptions = ['All Departments', ...Array.from(new Set([...DEPARTMENTS, ...employees.map(emp => emp.department).filter(Boolean)]))];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} translucent backgroundColor="transparent" />
      
      <View style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg }}>
        <GlobalAppBar navigation={navigation} showSearch={true} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
       contentContainerStyle={{
  padding: 16,
  paddingBottom: 240, 
}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />}
      >
        <View style={styles.pageHeader}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <MaterialCommunityIcons name="account-group" size={26} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.pageTitle, { color: colors.textMain, flexShrink: 1 }]} numberOfLines={2}>Employees</Text>
            </View>
            <Text style={[styles.pageSubtitle, { color: colors.textSub }]} numberOfLines={1}>{canViewAll ? `Manage all employees • ${filteredEmployees.length} shown` : "You don't have view access"}</Text>
          </View>
          
          {canCreate && (
              <TouchableOpacity style={styles.applyBtn} onPress={() => { 
                  setIsEditing(false); 
                  setIsCustomDept(false); 
                  setIsCustomDesig(false); 
                  setFormData({ 
                      _id: '', firstName: '', lastName: '', email: '', password: '', phone: '', 
                      department: DEPARTMENTS[0], designation: DESIGNATIONS[0], employeeType: 'full-time', 
                      roleId: '', roleName: 'Select Role', salary: '', dateOfJoining: '',
                      deviceId: '', aadharNumber: '', panNumber: '', uanNumber: '', esiNumber: '',
                      bankName: '', accountNumber: '', ifscCode: '', branchName: '', address: ''
                  });
                  
                  if(roles.length === 0) fetchRoles(); 
                  setIsModalVisible(true); 
              }}>
                <MaterialCommunityIcons name="plus" size={16} color="#fff" style={{marginRight: 4}} />
                <Text style={styles.applyBtnText}>New</Text>
              </TouchableOpacity>
          )}
        </View>

        {canViewAll && (
            <View style={styles.filterRow}>
              <TouchableOpacity style={[styles.filterBtn, {borderColor: colors.border, backgroundColor: colors.cardBg, flex: 1, marginRight: 10}]} onPress={() => setShowFilterDeptModal(true)}>
                <Text style={{color: colors.textMain, fontSize: 13, fontWeight: '600'}} numberOfLines={1}>{filterDept === 'All Departments' ? 'All Depts' : filterDept}</Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSub} />
              </TouchableOpacity>

              {/* 🚀 FIXED: Emp Type Filter UI Button */}
              <TouchableOpacity style={[styles.filterBtn, {borderColor: colors.border, backgroundColor: colors.cardBg, flex: 1}]} onPress={() => setShowFilterTypeModal(true)}>
                <Text style={{color: colors.textMain, fontSize: 13, fontWeight: '600', textTransform: 'capitalize'}} numberOfLines={1}>{filterEmpType === 'All Types' ? 'All Types' : filterEmpType}</Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSub} />
              </TouchableOpacity>
            </View>
        )}

        {loading && !refreshing ? <ActivityIndicator size="large" color="#3B82F6" style={{marginTop: 50}} /> : filteredEmployees.map((emp) => {
           const user = emp.userId || { firstName: 'N/A', lastName: '', email: 'N/A', avatar: '' };
           const isActive = emp.isDeleted !== true; 
           const statusText = isActive ? 'Active' : 'Inactive';
           
           return (
          <View key={emp._id} style={[styles.appEmployeeCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.appCardHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                  <View style={[styles.appAvatarBox, { backgroundColor: isLightMode ? '#F1F5F9' : '#334155' }]}>
                    {user.avatar && user.avatar.includes('http') && !user.avatar.includes('ui-avatars') ? (
                        <Image source={{ uri: user.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                    ) : (
                        <Text style={{ fontWeight: '900', fontSize: 16, color: colors.primary }}>
                            {user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}
                        </Text>
                    )}
                  </View>
                  <View style={{flex: 1, marginLeft: 12}}>
                    <Text style={[styles.appNameText, {color: colors.textMain}]} numberOfLines={1}>{user.firstName} {user.lastName}</Text>
                    <Text style={[styles.appEmailText, {color: colors.textSub}]} numberOfLines={1}>{user.email}</Text>
                  </View>
              </View>
              <View style={[styles.appStatusBadge, {backgroundColor: isActive ? '#DCFCE7' : '#FEE2E2'}]}>
                <Text style={{color: isActive ? '#16A34A' : '#DC2626', fontSize: 10, fontWeight: '800', textTransform:'uppercase'}}>{statusText}</Text>
              </View>
            </View>

            <View style={[styles.appDateBox, { backgroundColor: isLightMode ? '#F8FAFC' : '#1E293B' }]}>
              <View style={{flex: 1}}>
                  <Text style={styles.appDateLabel}>DEPARTMENT</Text>
                  <Text style={[styles.appDateValue, {color: colors.primary}]} numberOfLines={1}>{emp.department || 'N/A'}</Text>
              </View>
              <View style={{flex: 1, alignItems: 'flex-end', borderLeftWidth: 1, borderLeftColor: colors.border}}>
                  <Text style={styles.appDateLabel}>DESIGNATION</Text>
                  <Text style={[styles.appDateValue, {color: colors.textMain}]} numberOfLines={1}>{emp.designation || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.appCardFooter}>
              <View style={{flex: 1}}>
                  <Text style={{color: colors.textSub, fontSize: 11, fontWeight: '600'}}>
                     {emp.phone ? `Ph: ${emp.phone}` : (emp.dateOfJoining ? `Joined: ${new Date(emp.dateOfJoining).toLocaleDateString()}` : '')}
                  </Text>
              </View>
              
              <View style={styles.actionArea}>
                {canUpdate && (
                    <TouchableOpacity style={[styles.appActionBtn, {backgroundColor: isLightMode ? '#F1F5F9' : '#334155', marginRight: 8}]} onPress={() => {
                       const safePhone = emp.phone ? String(emp.phone) : ((user as any).phone ? String((user as any).phone) : '');
                       setIsCustomDept(emp.department && !DEPARTMENTS.includes(emp.department) ? true : false);
                       setIsCustomDesig(emp.designation && !DESIGNATIONS.includes(emp.designation) ? true : false);

                       setFormData({
                        _id: emp._id, firstName: user.firstName, lastName: user.lastName,
                        email: user.email, password: '', phone: safePhone, 
                        department: emp.department || 'Engineering', designation: emp.designation || DESIGNATIONS[0], employeeType: emp.employeeType || 'full-time',
                        roleId: '', roleName: 'Update Role (Opt)', 
                        salary: getSafeSalary(emp.salary) !== '0' ? getSafeSalary(emp.salary) : '', 
                        dateOfJoining: emp.dateOfJoining ? emp.dateOfJoining.split('T')[0] : '',
                        
                        deviceId: emp.deviceId || '', aadharNumber: emp.aadharNumber || '', panNumber: emp.panNumber || '',
                        uanNumber: emp.uanNumber || '', esiNumber: emp.esiNumber || '', bankName: emp.bankName || '',
                        accountNumber: emp.accountNumber || '', ifscCode: emp.ifscCode || '', branchName: emp.branchName || '',
                        address: emp.address || ''
                       });
                       
                       if(roles.length === 0) fetchRoles();
                       
                       setIsEditing(true); setIsModalVisible(true);
                    }}><Feather name="edit-2" size={16} color={colors.textMain} /></TouchableOpacity>
                )}
                
                {canDelete && isActive && (
                    <TouchableOpacity style={[styles.appActionBtn, {backgroundColor: isLightMode ? '#FEE2E2' : '#7F1D1D'}]} onPress={() => handleDelete(emp._id, user.firstName)}>
                      <Feather name="trash-2" size={16} color="#EF4444" />
                    </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )})}

        {!loading && filteredEmployees.length === 0 && (
            <View style={{alignItems: 'center', marginTop: 50}}>
                <Feather name="users" size={50} color={colors.border} />
                <Text style={{ textAlign: 'center', color: colors.textSub, marginTop: 12, fontSize: 14, fontWeight: '600' }}>
                    {canViewAll ? "No employees match your criteria." : "Nothing to show here."}
                </Text>
            </View>
        )}
      </ScrollView>

      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.mOverlay}>
          <View style={[styles.mCard, { backgroundColor: colors.cardBg }]}>
            
            <View style={[styles.mHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.mTitle, {color: colors.textMain}]}>{isEditing ? 'Edit Employee' : 'Add Employee'}</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}><MaterialCommunityIcons name="close" size={24} color={colors.textSub}/></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{padding: 24, paddingBottom: 0}}>
              
              <Text style={{color: colors.primary, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1}}>Basic Info</Text>

              <View style={{flexDirection: 'row', justifyContent:'space-between'}}>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>First Name *</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.firstName} onChangeText={(t)=>setFormData({...formData, firstName: t.replace(/[^a-zA-Z\s]/g, '')})} placeholderTextColor={colors.textSub} placeholder="John"/>
                  </View>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Last Name (Opt)</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.lastName} onChangeText={(t)=>setFormData({...formData, lastName: t.replace(/[^a-zA-Z\s]/g, '')})} placeholderTextColor={colors.textSub} placeholder="Doe"/>
                  </View>
              </View>

              <Text style={[styles.inputLabel, {color: colors.textSub}]}>Email Address *</Text>
              <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.email} onChangeText={(t)=>setFormData({...formData, email: t.trim()})} keyboardType="email-address" placeholderTextColor={colors.textSub} placeholder="employee@company.com" autoCapitalize="none"/>
              
              <Text style={[styles.inputLabel, {color: colors.textSub}]}>Phone Number *</Text>
              <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.phone} maxLength={10} onChangeText={(t)=>setFormData({...formData, phone: t.replace(/[^0-9]/g, '')})} keyboardType="numeric" placeholderTextColor={colors.textSub} placeholder="9876543210"/>

              <Text style={[styles.inputLabel, {color: colors.textSub}]}>{isEditing ? 'Update Role (Opt)' : 'Assign Role *'}</Text>
              <TouchableOpacity style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => setShowFormRoleModal(true)}>
                  <Text style={{color: colors.textMain, fontWeight: '600'}} numberOfLines={1}>{formData.roleName}</Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSub} />
              </TouchableOpacity>

              <Text style={[styles.inputLabel, {color: colors.textSub}]}>
                  {isEditing ? "New Password (leave blank to keep)" : "Password *"}
              </Text>
              <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} secureTextEntry value={formData.password} onChangeText={(t)=>setFormData({...formData, password:t})} placeholderTextColor={colors.textSub} placeholder="Min 6 characters"/>

              <View style={{height: 1, backgroundColor: colors.border, marginVertical: 20}} />
              <Text style={{color: colors.primary, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1}}>Work Details</Text>

              <View style={{flexDirection: 'row', justifyContent:'space-between'}}>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Department *</Text>
                    {isCustomDept ? (
                        <View style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0}]}>
                            <TextInput 
                                style={{flex: 1, paddingHorizontal: 12, color: colors.textMain, fontSize: 14, fontWeight: '600'}} 
                                value={formData.department} 
                                onChangeText={(t)=>setFormData({...formData, department:t})} 
                                placeholder="Custom..." 
                                placeholderTextColor={colors.textSub}
                            />
                            <TouchableOpacity onPress={() => { setIsCustomDept(false); setFormData({...formData, department: DEPARTMENTS[0]}); }} style={{padding: 10}}>
                                <MaterialCommunityIcons name="close" size={18} color={colors.textSub} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => setShowFormDeptModal(true)}>
                            <Text style={{color: colors.textMain, fontWeight: '600'}} numberOfLines={1}>{formData.department}</Text>
                            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSub} />
                        </TouchableOpacity>
                    )}
                  </View>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Type *</Text>
                    <TouchableOpacity style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => setShowFormTypeModal(true)}>
                        <Text style={{color: colors.textMain, fontWeight: '600', textTransform: 'capitalize'}}>{formData.employeeType}</Text>
                        <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSub} />
                    </TouchableOpacity>
                  </View>
              </View>

              <Text style={[styles.inputLabel, {color: colors.textSub}]}>Designation *</Text>
              {isCustomDesig ? (
                  <View style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0}]}>
                      <TextInput 
                          style={{flex: 1, paddingHorizontal: 12, color: colors.textMain, fontSize: 14, fontWeight: '600'}} 
                          value={formData.designation} 
                          onChangeText={(t)=>setFormData({...formData, designation:t})} 
                          placeholder="Custom Designation..." 
                          placeholderTextColor={colors.textSub}
                      />
                      <TouchableOpacity onPress={() => { setIsCustomDesig(false); setFormData({...formData, designation: DESIGNATIONS[0]}); }} style={{padding: 10}}>
                          <MaterialCommunityIcons name="close" size={18} color={colors.textSub} />
                      </TouchableOpacity>
                  </View>
              ) : (
                  <TouchableOpacity style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => setShowFormDesigModal(true)}>
                      <Text style={{color: colors.textMain, fontWeight: '600'}} numberOfLines={1}>{formData.designation || 'Select Designation'}</Text>
                      <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSub} />
                  </TouchableOpacity>
              )}

              <View style={{flexDirection: 'row', justifyContent:'space-between', marginTop: 15}}>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Salary (₹) (Opt)</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.salary} onChangeText={(t)=>setFormData({...formData, salary: t.replace(/[^0-9]/g, '')})} keyboardType="numeric" placeholderTextColor={colors.textSub} placeholder="50000"/>
                  </View>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Joining Date (Opt)</Text>
                    <TouchableOpacity style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => setShowDatePicker(true)}>
                      <Text style={{color: colors.textMain, fontWeight: '600'}}>{formData.dateOfJoining || 'Select Date'}</Text>
                      <MaterialCommunityIcons name="calendar" size={20} color={colors.textSub} />
                    </TouchableOpacity>
                  </View>
              </View>

              <View style={{height: 1, backgroundColor: colors.border, marginVertical: 20}} />
              <Text style={{color: colors.primary, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1}}>Identity & Banking (Optional)</Text>

              <View style={{flexDirection: 'row', justifyContent:'space-between'}}>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Device ID</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.deviceId} onChangeText={(t)=>setFormData({...formData, deviceId:t})} placeholderTextColor={colors.textSub} placeholder="Device ID"/>
                  </View>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Aadhar Number</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.aadharNumber} maxLength={12} onChangeText={(t)=>setFormData({...formData, aadharNumber: t.replace(/[^0-9]/g, '')})} keyboardType="numeric" placeholderTextColor={colors.textSub} placeholder="123456789012"/>
                  </View>
              </View>

              <View style={{flexDirection: 'row', justifyContent:'space-between', marginTop: 15}}>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>PAN Number</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.panNumber} maxLength={10} onChangeText={(t)=>setFormData({...formData, panNumber: t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()})} autoCapitalize="characters" placeholderTextColor={colors.textSub} placeholder="ABCDE1234F"/>
                  </View>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>UAN Number</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.uanNumber} onChangeText={(t)=>setFormData({...formData, uanNumber: t.replace(/[^0-9]/g, '')})} keyboardType="numeric" placeholderTextColor={colors.textSub} placeholder="100XXXXXXXXX"/>
                  </View>
              </View>

              <View style={{flexDirection: 'row', justifyContent:'space-between', marginTop: 15}}>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>ESI Number</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.esiNumber} onChangeText={(t)=>setFormData({...formData, esiNumber: t.replace(/[^0-9]/g, '')})} keyboardType="numeric" placeholderTextColor={colors.textSub} placeholder="ESI Number"/>
                  </View>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Bank Name</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.bankName} onChangeText={(t)=>setFormData({...formData, bankName:t})} placeholderTextColor={colors.textSub} placeholder="HDFC Bank"/>
                  </View>
              </View>

              <View style={{flexDirection: 'row', justifyContent:'space-between', marginTop: 15}}>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Account Number</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.accountNumber} onChangeText={(t)=>setFormData({...formData, accountNumber: t.replace(/[^0-9]/g, '')})} keyboardType="numeric" placeholderTextColor={colors.textSub} placeholder="A/C Number"/>
                  </View>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>IFSC Code</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.ifscCode} maxLength={11} onChangeText={(t)=>setFormData({...formData, ifscCode: t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()})} autoCapitalize="characters" placeholderTextColor={colors.textSub} placeholder="HDFC0001234"/>
                  </View>
              </View>

              <View style={{marginTop: 15}}>
                  <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Branch Name</Text>
                  <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.branchName} onChangeText={(t)=>setFormData({...formData, branchName:t})} placeholderTextColor={colors.textSub} placeholder="Branch Name"/>
              </View>

              <Text style={[styles.inputLabel, {color: colors.textSub}]}>Full Address</Text>
              <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain, height: 70, textAlignVertical: 'top', paddingTop: 10}]} multiline value={formData.address} onChangeText={(t)=>setFormData({...formData, address:t})} placeholderTextColor={colors.textSub} placeholder="Enter full address..."/>

              {showDatePicker && (<DateTimePicker value={selectedDate} mode="date" display="default" onChange={handleDateChange}/>)}
              <View style={{height: 40}} />
            </ScrollView>

            <View style={styles.modalFooterRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalVisible(false)}>
                <Text style={[styles.cancelBtnText, {color: colors.textSub}]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.subBtn, {backgroundColor: colors.primary}]} onPress={submitForm} disabled={formLoading}>
                {formLoading ? <ActivityIndicator color="#fff" size="small"/> : <Text style={styles.subBtnText}>{isEditing ? 'Update Employee' : 'Save Employee'}</Text>}
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>
      
      <DropdownModal visible={showFormDeptModal} onClose={() => setShowFormDeptModal(false)} title="Select Department" options={[...DEPARTMENTS, 'Enter Custom...']} selectedValue={formData.department} onSelect={(v: any) => { if(v === 'Enter Custom...') { setIsCustomDept(true); setFormData({...formData, department: ''}); } else { setFormData({...formData, department:v}); } }} colors={colors}/>
      <DropdownModal visible={showFormTypeModal} onClose={() => setShowFormTypeModal(false)} title="Employee Type" options={EMPLOYEE_TYPES} selectedValue={formData.employeeType} onSelect={(v: any) => setFormData({...formData, employeeType:v})} colors={colors}/>
      <DropdownModal visible={showFormDesigModal} onClose={() => setShowFormDesigModal(false)} title="Select Designation" options={[...DESIGNATIONS, 'Enter Custom...']} selectedValue={formData.designation} onSelect={(v: any) => { if(v === 'Enter Custom...') { setIsCustomDesig(true); setFormData({...formData, designation: ''}); } else { setFormData({...formData, designation:v}); } }} colors={colors}/>
      
      <DropdownModal visible={showFilterDeptModal} onClose={() => setShowFilterDeptModal(false)} title="Filter by Department" options={filterDeptOptions} selectedValue={filterDept} onSelect={setFilterDept} colors={colors} />
      
      {/* 🚀 FIXED: Employee Type Filter Modal */}
      <DropdownModal visible={showFilterTypeModal} onClose={() => setShowFilterTypeModal(false)} title="Filter by Type" options={['All Types', ...EMPLOYEE_TYPES]} selectedValue={filterEmpType} onSelect={setFilterEmpType} colors={colors} />
      
      <DropdownModal 
          visible={showFormRoleModal} 
          onClose={() => setShowFormRoleModal(false)} 
          title="Select System Role" 
          options={roleOptions} 
          selectedValue={formData.roleName} 
          onSelect={(selectedName: any) => { 
              if (selectedName.includes('Wait...')) return; 
              if (selectedName.includes('API')) return; 
              
              const match = roles.find(r => (r.name || r.roleName || r.title || r.role) === selectedName);
              if (match) setFormData({...formData, roleId: match._id, roleName: selectedName}); 
          }} 
          colors={colors}
      />

    </SafeAreaView>
  );
}

const DropdownModal = ({ visible, onClose, title, options, onSelect, selectedValue, colors }: any) => (
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

const styles = StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 5, flexWrap: 'wrap' },
  pageTitle: { fontSize: 24, fontWeight: 'bold' },
  pageSubtitle: { fontSize: 13, marginTop: 4, marginLeft: 34 },
  applyBtn: { backgroundColor: '#3B82F6', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, elevation: 3, marginTop: 10 },
  applyBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  
  filterRow: { flexDirection: 'row', marginBottom: 20, justifyContent: 'space-between' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },

  appEmployeeCard: { borderRadius: 20, marginBottom: 16, padding: 18, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.06, shadowRadius: 6 },
  appCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  appAvatarBox: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  appNameText: { fontWeight: 'bold', fontSize: 16, marginBottom: 2 },
  appEmailText: { fontSize: 12, fontWeight: '600' },
  appStatusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  appDateBox: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 16, justifyContent: 'space-between' },
  appDateLabel: { fontSize: 9, color: '#64748B', marginBottom: 4, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  appDateValue: { fontSize: 13, fontWeight: 'bold' },
  appCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionArea: { minWidth: 60, alignItems: 'flex-end', justifyContent: 'center', flexDirection: 'row' },
  appActionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  
  mOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-end', margin: 0, padding: 0, zIndex: 10 },
  mCard: { width: '100%', maxHeight: '85%', padding: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Platform.OS === 'ios' ? 40 : 24, elevation: 10 },
  mHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, padding: 24, paddingBottom: 16 },
  mTitle: { fontSize: 20, fontWeight: '900' },
  inputLabel: { fontSize: 12, fontWeight: '800', marginBottom: 8, marginTop: 12, color: '#64748B' },
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, height: 48 },
  dropdownText: { fontSize: 14, fontWeight: '600' },
  inputObj: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 14, fontWeight: '600' },
  modalFooterRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', padding: 24, borderTopWidth: 1, borderColor: '#F1F5F9', marginTop: 10 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 20, marginRight: 10 },
  cancelBtnText: { fontWeight: '800', fontSize: 14 },
  subBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 100 },
  subBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  
  calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 1000 },
  dropdownList: { position: 'relative', borderWidth: 1, borderRadius: 16, elevation: 5, overflow: 'hidden' }
});